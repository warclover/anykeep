/**
 * 收藏 API 路由
 * POST /api/bookmarks - 创建收藏
 * GET /api/bookmarks - 获取收藏列表
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/supabase/cached-auth";
import { detectPlatformFromUrl } from "@/lib/constants/platforms";
import {
  createBookmarkSchema,
  getBookmarksQuerySchema,
} from "@/lib/validation";
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
  quotaExceededError,
  databaseError,
  internalError,
} from "@/lib/utils/api-response";
import { crawlContent } from "@/lib/utils/crawler";
import { generateAIContent } from "@/lib/ai-generator";
import {
  smartFetchContent,
  prepareContentForAI,
} from "@/lib/utils/smart-content-fetcher";
import { isJinaReaderEnabled } from "@/lib/classification/config/ai-summary-config";
import {
  generateEmbedding,
  buildEmbeddingText,
} from "@/lib/utils/embedding-generator";
import { recommendFolder } from "@/lib/ai-generator";
import {
  classifyBookmarkV2,
  shouldUseV2Classification,
} from "@/lib/classification/server";
import { logger } from "@/lib/logger";
import type { BookmarkInsert } from "@/types/supabase";
import { BOOKMARK, STORAGE } from "@/lib/constants/messages";
import { BOOKMARK_LIST_FIELDS } from "@/lib/constants/query-fields";
import { PerformanceMonitor } from "@/lib/utils/performance-monitor";
import { bookmarkAITasks } from "@/lib/utils/async-task-retry";
// Phase 4 升级：微信文章自动抓取
import { autoFetchWechatArticle } from "@/lib/wechat-article";
// Phase 5 升级：B站视频字幕自动提取
import { autoFetchBilibiliTranscript } from "@/lib/bilibili-transcript";

/**
 * V4.2.3: HTTP 缓存配置（优化）
 * 书签数据更新频繁，使用更短的缓存时间以确保数据一致性
 * - private: 仅客户端缓存
 * - max-age=5: 5 秒内使用缓存（从 30 秒缩短，解决删除后仍显示的问题）
 * - stale-while-revalidate=10: 缓存过期后 10 秒内可后台刷新
 */
const CACHE_CONTROL_HEADER = "private, max-age=5, stale-while-revalidate=10";

/**
 * V4.2.7: 数据版本缓存配置
 * 用于让客户端判断是否需要重新获取数据
 */
const DATA_VERSION_HEADER = "X-Data-Version";

/**
 * V4.2.7: 生成数据版本号
 * 基于返回数据的最新 updated_at 时间戳
 */
function generateDataVersion(
  bookmarks: Array<{ updated_at?: string | null }> | null,
): string {
  if (!bookmarks || bookmarks.length === 0) {
    return Date.now().toString();
  }

  // 找到最新的 updated_at 时间戳
  let latestTimestamp = 0;
  for (const bookmark of bookmarks) {
    if (bookmark.updated_at) {
      const ts = new Date(bookmark.updated_at).getTime();
      if (ts > latestTimestamp) {
        latestTimestamp = ts;
      }
    }
  }

  return latestTimestamp > 0
    ? latestTimestamp.toString()
    : Date.now().toString();
}

/**
 * 异步补充书签标题（不阻塞主流程）
 * 当用户未输入标题时，后台爬取网页获取标题
 * @param bookmarkId - 书签ID
 * @param url - 网页URL
 * @param userId - 用户ID
 */
async function fetchAndUpdateTitle(
  bookmarkId: number,
  url: string,
  userId: string,
): Promise<{ title: string; description: string | null }> {
  try {
    logger.info(
      { bookmarkId, url, action: "async_title_start" },
      "Async Title: Starting fetch",
    );

    const crawlResult = await crawlContent(url);
    const title = crawlResult.title || url; // 兜底使用 URL

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    // 更新标题、平台和其他爬取到的信息
    // 关键：platform 在此处更新，确保异步爬取完成后平台标签正确
    const { error } = await supabase
      .from("bookmarks")
      .update({
        title,
        platform: crawlResult.platform, // 防御性更新：基于爬取结果校正平台
        description: crawlResult.description || null,
        source_name: crawlResult.sourceName || null,
        author: crawlResult.author || null,
        cover_url: crawlResult.coverUrl || null,
        word_count: crawlResult.wordCount || null,
        image_count: crawlResult.imageCount || null,
        publish_time: crawlResult.publishTime || null,
      })
      .eq("id", bookmarkId)
      .eq("user_id", userId);

    if (error) {
      throw error;
    }

    logger.info(
      {
        bookmarkId,
        title,
        platform: crawlResult.platform,
        action: "async_title_success",
      },
      "Async Title: Updated successfully (including platform)",
    );

    return { title, description: crawlResult.description || null };
  } catch (error) {
    // 标题获取失败，使用 URL 作为兜底
    logger.error(
      {
        bookmarkId,
        error: error instanceof Error ? error.message : String(error),
        action: "async_title_failed",
      },
      "Async Title: Fetch failed, using URL as fallback",
    );

    try {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();

      await supabase
        .from("bookmarks")
        .update({ title: url })
        .eq("id", bookmarkId)
        .eq("user_id", userId);
    } catch {
      // 忽略更新错误
    }

    return { title: url, description: null };
  }
}

/**
 * 异步生成书签向量嵌入（不阻塞主流程）
 * @param bookmarkId - 书签ID
 * @param title - 标题
 * @param summary - AI摘要
 * @param tags - AI标签
 * @param userId - 用户ID
 * @param folderId - 文件夹ID（用于 embedding 完成后更新 folder profile）
 */
async function generateBookmarkEmbedding(
  bookmarkId: number,
  title: string,
  summary: string | null,
  tags: string[] | null,
  userId: string,
  folderId?: number | null,
): Promise<void> {
  try {
    const text = buildEmbeddingText(title, summary, tags);
    if (!text || text.trim().length < 5) {
      logger.warn(
        { bookmarkId, action: "embedding_skip" },
        "Embedding: Text too short, skipping",
      );
      return;
    }

    const embedding = await generateEmbedding(text);

    // 动态导入 supabase client（避免循环依赖）
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    // pgvector 接受 number[] 格式，TypeScript 类型为 string
    const { error } = await supabase
      .from("bookmarks")
      .update({ embedding: embedding as unknown as string })
      .eq("id", bookmarkId)
      .eq("user_id", userId);

    if (error) {
      throw error;
    }

    logger.info(
      { bookmarkId, action: "embedding_success" },
      "Embedding: Generated successfully",
    );

    // Embedding 生成成功后，更新 folder profile（如果书签在文件夹中）
    if (folderId) {
      const { updateFolderProfilesOnBookmarkChange } = await import(
        "@/lib/classification/server"
      );
      updateFolderProfilesOnBookmarkChange([], folderId, userId).catch(
        (err) => {
          logger.warn(
            { error: err, folderId, bookmarkId },
            "Embedding: Failed to update folder profile after embedding",
          );
        },
      );
    }
  } catch (error) {
    // 向量生成失败不影响书签创建
    logger.error(
      {
        bookmarkId,
        error: error instanceof Error ? error.message : String(error),
        action: "embedding_failed",
      },
      "Embedding: Generation failed",
    );
  }
}

/**
 * 异步生成书签 AI 内容（摘要、标签）并触发后续任务
 * 完全不阻塞主流程，用户可以手动添加标签
 * V2: 支持内容类型自适应摘要
 * V2.1: 支持 Jina Reader 智能内容提取
 * @param bookmarkId - 书签ID
 * @param url - 书签URL（用于内容类型检测）
 * @param title - 标题
 * @param description - 描述
 * @param folderNames - 用户现有文件夹名称（用于标签参考）
 * @param userId - 用户ID
 * @param userSpecifiedFolderId - 用户是否指定了文件夹
 */
async function generateBookmarkAIContent(
  bookmarkId: number,
  url: string,
  title: string,
  description: string | null,
  folderNames: string[],
  userId: string,
  userSpecifiedFolderId: boolean,
): Promise<void> {
  try {
    const useJina = isJinaReaderEnabled();

    logger.info(
      {
        bookmarkId,
        url,
        title: title.substring(0, 30),
        useJinaReader: useJina,
        action: "async_ai_start",
      },
      "AI Content (async): Starting generation with content type detection",
    );

    // V2.1: 智能内容提取（Jina Reader + 原生降级）
    let contentForAI: string | undefined = description || undefined;

    if (useJina) {
      try {
        logger.info(
          { bookmarkId, url, action: "smart_fetch_start" },
          "AI Content (async): Fetching content with smart fetcher",
        );

        const fetchResult = await smartFetchContent(url, {
          timeout: 15000,
          maxContentLength: 50000,
        });

        if (fetchResult.success && fetchResult.content.length > 100) {
          // 准备内容用于 AI（截断到合适长度）
          contentForAI = prepareContentForAI(fetchResult, 4000);

          logger.info(
            {
              bookmarkId,
              source: fetchResult.source,
              format: fetchResult.format,
              wordCount: fetchResult.wordCount,
              estimatedTokens: fetchResult.estimatedTokens,
              preparedLength: contentForAI.length,
              fetchTime: fetchResult.fetchTime,
              action: "smart_fetch_success",
            },
            "AI Content (async): Content fetched successfully",
          );
        } else {
          logger.warn(
            {
              bookmarkId,
              error: fetchResult.error,
              contentLength: fetchResult.content.length,
              action: "smart_fetch_fallback",
            },
            "AI Content (async): Smart fetch failed, using description",
          );
        }
      } catch (fetchError) {
        logger.error(
          {
            bookmarkId,
            error:
              fetchError instanceof Error
                ? fetchError.message
                : String(fetchError),
            action: "smart_fetch_error",
          },
          "AI Content (async): Smart fetch error, using description",
        );
      }
    }

    // 1. 生成 AI 摘要和标签（V2: 包含内容类型检测）
    const aiResult = await generateAIContent({
      title,
      url,
      description: description || undefined,
      content: contentForAI,
      existingFolderNames: folderNames,
    });

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    // 2. 更新书签记录（包括状态更新为 ACTIVE + V2 内容类型）
    const { error: updateError } = await supabase
      .from("bookmarks")
      .update({
        ai_summary: aiResult.summary,
        ai_tags: aiResult.tags,
        ai_content_type: aiResult.contentType || null, // V2: AI检测的内容类型
        ai_content_type_confidence: aiResult.contentTypeConfidence || null, // V2: 置信度
        status: "COMPLETED", // AI 内容生成完成
      })
      .eq("id", bookmarkId)
      .eq("user_id", userId);

    if (updateError) {
      throw updateError;
    }

    logger.info(
      {
        bookmarkId,
        summary: aiResult.summary.substring(0, 50) + "...",
        tagCount: aiResult.tags.length,
        contentType: aiResult.contentType,
        contentTypeConfidence: aiResult.contentTypeConfidence,
        action: "async_ai_success",
      },
      "AI Content (async): Generated and saved with content type",
    );

    // 3. 获取书签当前的 folder_id（用于 embedding 完成后更新 profile）
    const { data: bookmarkData } = await supabase
      .from("bookmarks")
      .select("folder_id")
      .eq("id", bookmarkId)
      .single();

    const currentFolderId = bookmarkData?.folder_id ?? null;

    // 4. 生成向量嵌入（V4.2.7: 使用重试机制，失败时入队）
    bookmarkAITasks.generateEmbedding(
      () =>
        generateBookmarkEmbedding(
          bookmarkId,
          title,
          aiResult.summary,
          aiResult.tags,
          userId,
          currentFolderId,
        ),
      userId,
      bookmarkId,
    );

    // 5. AI 文件夹推荐（仅当用户未指定文件夹时）
    if (
      !userSpecifiedFolderId &&
      aiResult.summary &&
      aiResult.tags.length > 0
    ) {
      // Use V2 classification system if enabled
      // V4.2.7: Profile 更新已集成到 classifyBookmarkV2 内部（同步执行）
      // V4.2.7: 使用重试机制，失败时入队到 job_queue
      if (shouldUseV2Classification()) {
        bookmarkAITasks.classifyBookmark(
          async () => {
            await classifyBookmarkV2(
              bookmarkId,
              title,
              aiResult.summary,
              aiResult.tags,
              userId,
            );
          },
          userId,
          bookmarkId,
        );
      } else {
        // Legacy V1 classification（同样使用重试机制）
        bookmarkAITasks.classifyBookmark(
          () =>
            processAIFolderRecommendation(
              bookmarkId,
              title,
              aiResult.summary,
              aiResult.tags,
              userId,
            ),
          userId,
          bookmarkId,
        );
      }
    }
  } catch (error) {
    logger.error(
      {
        bookmarkId,
        error: error instanceof Error ? error.message : String(error),
        action: "async_ai_failed",
      },
      "AI Content (async): Generation failed",
    );
  }
}

/**
 * 异步处理 AI 文件夹推荐（不阻塞主流程）
 * 根据置信度自动归类或保存建议
 */
async function processAIFolderRecommendation(
  bookmarkId: number,
  title: string,
  summary: string,
  tags: string[],
  userId: string,
): Promise<void> {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    // 获取用户文件夹（包含 folder_profiles 用于 AI 上下文增强）
    const { data: userFolders } = await supabase
      .from("folders")
      .select(
        `
        id,
        name,
        folder_profiles(top_tags, bookmark_count)
      `,
      )
      .eq("user_id", userId)
      .eq("is_system", false)
      .is("deleted_at", null);

    if (!userFolders || userFolders.length === 0) {
      logger.info(
        { bookmarkId, action: "async_recommend_skip" },
        "AI Classification (async): No user folders, skipping",
      );
      return;
    }

    // 转换为增强的文件夹信息
    const enrichedFolders = userFolders.map((folder) => {
      // folder_profiles 是一对一关系，但 Supabase 返回数组
      const profile = Array.isArray(folder.folder_profiles)
        ? folder.folder_profiles[0]
        : folder.folder_profiles;
      return {
        id: folder.id,
        name: folder.name,
        topTags: (profile?.top_tags as string[] | null) || [],
        bookmarkCount: profile?.bookmark_count || 0,
      };
    });

    logger.info(
      {
        bookmarkId,
        title: title.substring(0, 30),
        folderCount: enrichedFolders.length,
        action: "async_recommend_start",
      },
      "AI Classification (async): Starting folder recommendation",
    );

    // 调用 AI 推荐（传入增强的文件夹信息）
    const aiRecommendation = await recommendFolder(
      title,
      summary,
      tags,
      enrichedFolders,
    );

    logger.info(
      {
        bookmarkId,
        folderId: aiRecommendation.folderId,
        folderName: aiRecommendation.folderName,
        confidence: aiRecommendation.confidence,
        suggestNew: aiRecommendation.suggestNew,
        action: "async_recommend_result",
      },
      "AI Classification (async): Recommendation received",
    );

    // 根据置信度处理
    if (aiRecommendation.confidence >= 80) {
      // 高置信度：自动归类
      let targetFolderId = aiRecommendation.folderId;

      if (aiRecommendation.suggestNew) {
        // 创建新文件夹
        const { data: newFolder, error: createError } = await supabase
          .from("folders")
          .insert({
            user_id: userId,
            name: aiRecommendation.folderName,
            sort_order: 0,
          })
          .select("id")
          .single();

        if (!createError && newFolder) {
          targetFolderId = newFolder.id;
          logger.info(
            {
              bookmarkId,
              folderId: newFolder.id,
              folderName: aiRecommendation.folderName,
              action: "async_create_folder",
            },
            "AI Classification (async): Created new folder",
          );
        }
      }

      if (targetFolderId) {
        // 移动收藏到推荐文件夹
        const { error: moveError } = await supabase
          .from("bookmarks")
          .update({ folder_id: targetFolderId })
          .eq("id", bookmarkId)
          .eq("user_id", userId);

        if (!moveError) {
          logger.info(
            {
              bookmarkId,
              folderId: targetFolderId,
              folderName: aiRecommendation.folderName,
              confidence: aiRecommendation.confidence,
              action: "async_auto_classify",
            },
            "AI Classification (async): Auto-classified (high confidence)",
          );
        }
      }
    } else if (aiRecommendation.confidence >= 60) {
      // 中置信度：保存建议
      const { error: suggestionError } = await supabase
        .from("classification_suggestions")
        .insert({
          user_id: userId,
          bookmark_id: bookmarkId,
          suggested_folder_id: aiRecommendation.folderId,
          suggested_folder_name: aiRecommendation.folderName,
          suggest_new_folder: aiRecommendation.suggestNew,
          confidence: aiRecommendation.confidence,
          reason: aiRecommendation.reason,
          status: "pending",
          batch_id: crypto.randomUUID(),
        });

      if (!suggestionError) {
        logger.info(
          {
            bookmarkId,
            confidence: aiRecommendation.confidence,
            folderName: aiRecommendation.folderName,
            action: "async_save_suggestion",
          },
          "AI Classification (async): Saved suggestion (medium confidence)",
        );
      }
    }
    // 低置信度：不做任何操作，保持在待整理文件夹
  } catch (error) {
    logger.error(
      {
        bookmarkId,
        error: error instanceof Error ? error.message : String(error),
        action: "async_recommend_failed",
      },
      "AI Classification (async): Failed",
    );
  }
}

/**
 * POST /api/bookmarks
 * 创建新收藏
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户身份（使用缓存认证，避免重复验证）
    const { user, error: authError } = await getCachedUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 创建 Supabase 客户端用于数据库操作
    const supabase = await createClient();

    // 2. 解析并验证请求体
    const body = await request.json();
    const validation = createBookmarkSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const {
      url,
      title,
      description,
      folderId,
      userTags,
      notes,
      coverUrl: userCoverUrl,
      sourceName: userSourceName, // 前端传来的来源名称
      author: userAuthor, // 前端传来的作者
      wordCount: userWordCount,
      imageCount: userImageCount,
      publishTime: userPublishTime, // 前端传来的发布时间
      // 注意：aiSummary/aiTags 已弃用（AI 改为完全异步生成）
    } = validation.data;

    // 3. 检查存储配额
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("storage_quota, storage_used")
      .eq("id", user.id)
      .single();

    if (profileError) {
      return databaseError(BOOKMARK.LOAD_ERROR, profileError);
    }

    if ((profile.storage_used ?? 0) >= (profile.storage_quota ?? 0)) {
      return quotaExceededError(STORAGE.QUOTA_EXCEEDED);
    }

    // 4. 识别平台类型
    const platform = detectPlatformFromUrl(url);

    // 5. 处理标题和描述
    // 优先使用前端传来的数据（来自 metadata API）
    let sourceName: string | undefined = userSourceName || undefined;
    let author: string | undefined = userAuthor || undefined;
    let coverUrl: string | undefined;
    let wordCount: number | undefined = userWordCount;
    let imageCount: number | undefined = userImageCount;
    let publishTime: string | undefined = userPublishTime || undefined;

    // 判断是否需要异步补充标题
    const needsAsyncTitleFetch = !title || title.trim() === "";
    // 使用临时占位符或用户提供的标题
    const finalTitle = needsAsyncTitleFetch
      ? "正在获取标题..."
      : (title as string);
    let finalDescription: string | null | undefined = description;

    // 仅当有描述需求且用户没有提供时，才同步爬取（快速返回）
    // 如果标题为空，完全异步处理（不阻塞创建响应）
    if (title && !description) {
      try {
        logger.info(
          {
            url,
            action: "crawl_start",
          },
          "Crawler: Auto-crawling for description only",
        );
        const crawlResult = await crawlContent(url);

        // 使用爬取的数据填充缺失字段（优先使用前端提供的值）
        finalDescription = description || crawlResult.description || null;
        sourceName = sourceName || crawlResult.sourceName;
        author = author || crawlResult.author;
        coverUrl = crawlResult.coverUrl;
        wordCount = wordCount ?? crawlResult.wordCount;
        imageCount = imageCount ?? crawlResult.imageCount;
        publishTime = publishTime || crawlResult.publishTime;

        logger.info(
          {
            title: finalTitle,
            platform: crawlResult.platform,
            hasSourceName: !!sourceName,
            hasAuthor: !!author,
            hasCover: !!coverUrl,
            wordCount,
            imageCount,
            action: "crawl_success",
          },
          "Crawler: Success (description only)",
        );
      } catch (error) {
        logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            url,
            action: "crawl_failed",
          },
          "Crawler: Failed (description only)",
        );
        finalDescription = description || null;
      }
    }

    // 6. 获取用户文件夹（用于 AI 标签参考和后续文件夹推荐）
    const { data: userFolders } = await supabase
      .from("folders")
      .select("id, name")
      .eq("user_id", user.id)
      .eq("is_system", false)
      .is("deleted_at", null);

    const folderNames = userFolders?.map((f) => f.name) || [];

    // 7. AI 内容生成改为完全异步（不阻塞创建响应）
    // 用户可以手动添加标签，AI 标签和摘要将在后台生成
    logger.info(
      {
        title: finalTitle,
        folderCount: folderNames.length,
        action: "ai_deferred",
      },
      "AI: Content generation will be processed asynchronously",
    );

    // 8. 获取文件夹（用户指定或默认待整理）
    // 注意：AI 文件夹推荐改为异步执行，不阻塞创建响应
    let finalFolderId = folderId;

    if (!finalFolderId) {
      // 用户未指定文件夹，使用待整理文件夹
      try {
        const { data: inboxFolderId, error: inboxError } = await supabase.rpc(
          "get_or_create_inbox_folder",
          { p_user_id: user.id },
        );

        if (!inboxError && inboxFolderId) {
          finalFolderId = inboxFolderId;
          logger.info(
            {
              folderId: inboxFolderId,
              action: "inbox_assigned",
            },
            "Bookmark assigned to inbox folder (AI recommendation will run async)",
          );
        }
      } catch (error) {
        logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            userId: user.id,
            operation: "get_inbox_folder",
          },
          "Exception while getting inbox folder",
        );
      }
    }

    // 9. 构建收藏记录
    // 封面优先级：用户上传 > 爬取获取
    const finalCoverUrl = userCoverUrl || coverUrl || null;

    const bookmarkData: BookmarkInsert = {
      user_id: user.id,
      url,
      title: finalTitle,
      description: finalDescription,
      source_name: sourceName || null, // 来源名称（公众号名称等）
      author: author || null, // 文章作者
      publish_time: publishTime || null, // 原文发布时间
      cover_url: finalCoverUrl,
      platform,
      folder_id: finalFolderId || null,
      user_tags: userTags || null,
      notes: notes || null,
      ai_summary: null, // AI 内容将异步生成
      ai_tags: null, // AI 标签将异步生成
      word_count: wordCount || null,
      image_count: imageCount || null,
      status: "PROCESSING", // 标记为处理中（AI 内容异步生成中）
    };

    // 10. 插入收藏记录
    const { data: bookmark, error: insertError } = await supabase
      .from("bookmarks")
      .insert(bookmarkData)
      .select("*, folders(name)")
      .single();

    if (insertError) {
      return databaseError(BOOKMARK.CREATE_ERROR, insertError);
    }

    // 11. 增加用户存储计数
    const { error: incrementError } = await supabase.rpc(
      "increment_storage_used",
      {
        target_user_id: user.id,
      },
    );

    if (incrementError) {
      // 存储计数更新失败，但收藏已创建，记录错误但不影响返回
      logger.error(
        {
          error: incrementError,
          userId: user.id,
          operation: "increment_storage",
        },
        "Failed to increment storage count",
      );
    }

    // 12. 异步后台任务（不阻塞响应）
    // V4.2.7: 使用重试机制，失败时入队到 job_queue
    // 如果需要异步获取标题，先获取标题再生成 AI 内容
    if (needsAsyncTitleFetch) {
      // 异步获取标题，然后生成 AI 内容
      fetchAndUpdateTitle(bookmark.id, url, user.id)
        .then(({ title: fetchedTitle, description: fetchedDesc }) => {
          // 标题获取成功后，继续生成 AI 内容（使用重试机制）
          bookmarkAITasks.generateContent(
            () =>
              generateBookmarkAIContent(
                bookmark.id,
                url,
                fetchedTitle,
                fetchedDesc,
                folderNames,
                user.id,
                !!folderId,
              ),
            user.id,
            bookmark.id,
            url,
          );
        })
        .catch((err) => {
          logger.error(
            { error: err, bookmarkId: bookmark.id },
            "Background title fetch failed",
          );
          // 标题获取失败，仍然尝试生成 AI 内容（使用 URL 作为标题）
          bookmarkAITasks.generateContent(
            () =>
              generateBookmarkAIContent(
                bookmark.id,
                url,
                url, // 使用 URL 作为标题
                null,
                folderNames,
                user.id,
                !!folderId,
              ),
            user.id,
            bookmark.id,
            url,
          );
        });
    } else {
      // 已有标题，直接生成 AI 内容（使用重试机制）
      bookmarkAITasks.generateContent(
        () =>
          generateBookmarkAIContent(
            bookmark.id,
            url,
            finalTitle,
            finalDescription ?? null,
            folderNames,
            user.id,
            !!folderId,
          ),
        user.id,
        bookmark.id,
        url,
      );
    }

    // 13. Phase 4 升级：微信文章自动抓取（异步，不阻塞响应）
    if (platform === "WECHAT_OFFICIAL_ACCOUNT") {
      autoFetchWechatArticle(bookmark.id, user.id, url).catch((err) => {
        logger.warn(
          { error: err, bookmarkId: bookmark.id },
          "WeChat auto-crawl failed (non-blocking)",
        );
      });
    }

    // 14. Phase 5 升级：B站视频字幕自动提取（异步，不阻塞响应）
    if (platform === "BILIBILI") {
      autoFetchBilibiliTranscript(bookmark.id, user.id, url).catch((err) => {
        logger.warn(
          { error: err, bookmarkId: bookmark.id },
          "Bilibili transcript auto-fetch failed (non-blocking)",
        );
      });
    }

    // 15. 返回创建的收藏对象
    // 注意：分类信息现在是异步处理，前端可通过轮询或 WebSocket 获取更新
    return successResponse(bookmark, 201);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "create_bookmark",
      },
      "POST /api/bookmarks error",
    );
    return internalError(BOOKMARK.CREATE_ERROR);
  }
}

/**
 * GET /api/bookmarks
 * 获取收藏列表（支持分页和筛选）
 */
export async function GET(request: NextRequest) {
  const monitor = new PerformanceMonitor("BookmarksQuery");

  try {
    // 1. 验证用户身份（使用缓存认证，性能优化）
    const { user, error: authError } = await monitor.measure("CachedAuth", () =>
      getCachedUser(),
    );

    if (authError || !user) {
      return unauthorizedError();
    }

    // 创建 Supabase 客户端用于数据库操作
    const supabase = await monitor.measure("CreateClient", () =>
      createClient(),
    );

    monitor.mark("AuthComplete", { userId: user.id });

    // 2. 解析查询参数
    const searchParams = request.nextUrl.searchParams;
    const queryParams = {
      platform: searchParams.get("platform"),
      excludeBrowser: searchParams.get("excludeBrowser"),
      folderId: searchParams.get("folderId"),
      folder: searchParams.get("folder"), // 虚拟文件夹
      keyword: searchParams.get("keyword"),
      cursor: searchParams.get("cursor"),
      limit: searchParams.get("limit"),
      sort: searchParams.get("sort"),
      usageTags: searchParams.get("usageTags"), // V9.0新增：用途标签筛选
      dateFrom: searchParams.get("dateFrom"), // V10.0新增：时间范围起始
      dateTo: searchParams.get("dateTo"), // V10.0新增：时间范围结束
      isRead: searchParams.get("isRead"), // V10.0新增：阅读状态筛选
      isStarred: searchParams.get("isStarred"), // V10.0新增：星标筛选
      isHighValue: searchParams.get("isHighValue"), // V10.0新增：高价值筛选
      ratingMin: searchParams.get("ratingMin"), // V10.0新增：评级下限
      ratingMax: searchParams.get("ratingMax"), // V10.0新增：评级上限
    };

    const validation = getBookmarksQuerySchema.safeParse(queryParams);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const {
      platform,
      excludeBrowser,
      folderId,
      folder,
      keyword,
      cursor,
      limit,
      sort,
      usageTags,
      dateFrom,
      dateTo,
      isRead,
      isStarred,
      isHighValue,
      ratingMin,
      ratingMax,
    } = validation.data;

    monitor.mark("ParamsParsed", {
      platform,
      excludeBrowser,
      folderId,
      folder,
      keyword: !!keyword,
      cursor: !!cursor,
      limit,
      dateFrom: !!dateFrom,
      dateTo: !!dateTo,
    });

    // 3. 构建查询
    // V4.2.1: 使用统一字段常量，确保 API 一致性
    // V4.2.8: 排除 embedding 大字段，保留所有 UI 所需字段
    let query = supabase
      .from("bookmarks")
      .select(BOOKMARK_LIST_FIELDS, { count: "exact" })
      .eq("user_id", user.id)
      .is("deleted_at", null);

    // 虚拟文件夹筛选（优先级最高）
    // 注意：is_in_trash 可能为 NULL（历史数据），使用 .or() 处理
    if (folder === "trash") {
      // 垃圾箱：只显示垃圾箱中的收藏
      query = query.eq("is_in_trash", true);
    } else if (folder === "invalid") {
      // 已失效：只显示失效且不在垃圾箱的收藏
      query = query
        .eq("is_invalid", true)
        .or("is_in_trash.eq.false,is_in_trash.is.null");
    } else if (folder === "high-value") {
      // 高价值：只显示5星评级且不在垃圾箱的收藏
      query = query
        .eq("rating", 5)
        .or("is_in_trash.eq.false,is_in_trash.is.null");
    } else {
      // 正常收藏：排除垃圾箱（包含 NULL 值）
      query = query.or("is_in_trash.eq.false,is_in_trash.is.null");
    }

    // 平台筛选
    if (platform === "browser") {
      // 「浏览器书签」统一入口：查询所有浏览器平台
      query = query.in("platform", [
        "BROWSER_CHROME",
        "BROWSER_EDGE",
        "BROWSER_FIREFOX",
        "BROWSER_SAFARI",
      ]);
    } else if (platform) {
      query = query.eq("platform", platform);
    } else if (excludeBrowser) {
      // 「全部」时排除浏览器平台
      query = query.not(
        "platform",
        "in",
        '("BROWSER_CHROME","BROWSER_EDGE","BROWSER_FIREFOX","BROWSER_SAFARI")',
      );
    }

    // 排序
    const sortField = sort?.split("_")[0] || "created";
    const ascending = sort?.endsWith("_asc") || false;
    if (sortField === "created") {
      query = query.order("created_at", { ascending });
    } else if (sortField === "title") {
      query = query.order("title", { ascending });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    // 文件夹筛选（仅对非虚拟文件夹生效）
    if (folderId && !folder) {
      query = query.eq("folder_id", folderId);
    }

    // 关键词搜索（标题 + 描述）
    if (keyword) {
      query = query.or(
        `title.ilike.%${keyword}%,description.ilike.%${keyword}%`,
      );
    }

    // V9.0新增：用途标签筛选（user_tags 数组包含任意指定标签）
    if (usageTags && usageTags.length > 0) {
      query = query.overlaps("user_tags", usageTags);
    }

    // V10.0新增：时间范围筛选（用于智能列表）
    if (dateFrom) {
      query = query.gte("created_at", dateFrom);
    }
    if (dateTo) {
      query = query.lte("created_at", dateTo);
    }

    // V10.0新增：阅读状态筛选（用于智能列表的"待阅读"场景）
    if (isRead !== undefined) {
      query = query.eq("is_read", isRead);
    }

    // V10.0新增：星标筛选（用于智能列表的"星标收藏"场景）
    if (isStarred !== undefined) {
      query = query.eq("is_starred", isStarred);
    }

    // V10.0新增：高价值筛选（rating=5）
    if (isHighValue === true) {
      query = query.eq("rating", 5);
    }

    // V10.0新增：评级范围筛选
    if (ratingMin !== undefined) {
      query = query.gte("rating", ratingMin);
    }
    if (ratingMax !== undefined) {
      query = query.lte("rating", ratingMax);
    }

    // 游标分页（"加载更多"模式）
    if (cursor) {
      query = query.lt("id", cursor);
    }

    // 限制数量
    query = query.limit(limit);

    monitor.mark("QueryBuilt");

    // 4. 执行查询
    const queryStart = performance.now();
    const { data: bookmarks, error: queryError, count } = await query;
    monitor.mark("DatabaseQuery", {
      durationMs: Math.round(performance.now() - queryStart),
    });

    if (queryError) {
      return databaseError(BOOKMARK.LOAD_ERROR, queryError);
    }

    // 5. 返回结果（包含分页元数据）
    // V4.2.1: 类型断言处理动态字段选择的类型推断问题
    const bookmarkList = bookmarks as unknown as Array<{
      id: number;
      [key: string]: unknown;
    }> | null;
    const hasMore = bookmarkList && bookmarkList.length === limit;
    const nextCursor =
      hasMore && bookmarkList.length > 0
        ? bookmarkList[bookmarkList.length - 1].id
        : null;

    // 输出性能报告
    const perfReport = monitor.getReport();

    // V4.2.1: 安全计算响应大小，处理 BigInt 等不可序列化的类型
    let responseSize = 0;
    try {
      responseSize = JSON.stringify(bookmarks || [], (_, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ).length;
    } catch {
      responseSize = -1; // 表示无法计算
    }

    logger.info(
      {
        userId: user.id,
        bookmarkCount: bookmarks?.length || 0,
        totalCount: count || 0,
        responseSize,
        performance: {
          totalMs: Math.round(perfReport.totalDuration),
          stages: perfReport.entries.map((e) => ({
            name: e.name,
            ms: Math.round(e.duration),
          })),
          slowOperations: perfReport.slowEntries.map((e) => e.name),
        },
      },
      "Bookmarks query completed",
    );

    // V4.2.7: 生成数据版本号用于客户端缓存验证
    const dataVersion = generateDataVersion(
      bookmarks as Array<{ updated_at?: string | null }> | null,
    );

    // V4.2.1: 返回带缓存头的响应
    const responseData = {
      success: true,
      data: {
        bookmarks: bookmarks || [],
        pagination: {
          total: count || 0,
          limit,
          nextCursor,
          hasMore,
        },
        // V4.2.7: 数据版本号，客户端可用于判断缓存是否过期
        dataVersion,
        // 开发环境返回性能数据
        ...(process.env.NODE_ENV === "development" && {
          _performance: monitor.toJSON(),
          _responseSize: responseSize,
        }),
      },
    };

    // V4.2.1: 使用自定义序列化处理 BigInt 等特殊类型
    const jsonString = JSON.stringify(responseData, (_, value) =>
      typeof value === "bigint" ? Number(value) : value,
    );

    return new Response(jsonString, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": CACHE_CONTROL_HEADER,
        // V4.2.7: 添加数据版本头，让客户端可以用 If-None-Match 验证
        [DATA_VERSION_HEADER]: dataVersion,
        ETag: `"${dataVersion}"`,
      },
    });
  } catch (error) {
    const perfReport = monitor.getReport();
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "get_bookmarks",
        performance: {
          totalMs: Math.round(perfReport.totalDuration),
          failedAt: perfReport.entries[perfReport.entries.length - 1]?.name,
        },
      },
      "GET /api/bookmarks error",
    );
    return internalError(BOOKMARK.LOAD_ERROR);
  }
}
