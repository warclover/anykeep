/**
 * 书签异步任务处理模块
 *
 * 从 route.ts 中提取的后台异步处理函数：
 * - fetchAndUpdateTitle: 异步补充书签标题
 * - generateBookmarkEmbedding: 异步生成向量嵌入
 * - generateBookmarkAIContent: 异步生成 AI 摘要/标签
 * - processAIFolderRecommendation: AI 文件夹推荐
 *
 * @version 1.0.0
 * @since 2026-03-08
 */

import { crawlContent } from "@/lib/utils/crawler";
import { generateAIContent } from "@/lib/ai-generator";
import {
  smartFetchContent,
  prepareContentForAI,
  type ContentFetchResult,
} from "@/lib/utils/smart-content-fetcher";
import { extractTextFromMarkdown } from "@/lib/utils/jina-reader";
import { isJinaReaderEnabled } from "@/lib/summary/config/ai-summary-config";
import {
  generateEmbedding,
  buildEmbeddingText,
} from "@/lib/utils/embedding-generator";
import { recommendFolder } from "@/lib/ai-generator";
import {
  classifyBookmarkV2,
  shouldUseV2Classification,
} from "@/lib/classification-v2/integration";
import { logger } from "@/lib/logger";
import { isWechatArticleUrl } from "@/lib/wechat-article/auto-crawl";
import type { BookmarkUpdate, Platform } from "@/types/supabase";
import { bookmarkAITasks } from "@/lib/utils/async-task-retry";

// ============================================================================
// fetchAndUpdateTitle
// ============================================================================

/**
 * 异步补充书签标题（不阻塞主流程）
 * 当用户未输入标题时，后台爬取网页获取标题
 * @param bookmarkId - 书签ID
 * @param url - 网页URL
 * @param userId - 用户ID
 */
export async function fetchAndUpdateTitle(
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
    const updateData: BookmarkUpdate = {
      title,
      platform: crawlResult.platform as Platform, // 防御性更新：基于爬取结果校正平台
      description: crawlResult.description || null,
      source_name: crawlResult.sourceName || null,
      author: crawlResult.author || null,
      cover_url: crawlResult.coverUrl || null,
      word_count: crawlResult.wordCount || null,
      image_count: crawlResult.imageCount || null,
      publish_time: crawlResult.publishTime || null,
    };

    const { error } = await supabase
      .from("bookmarks")
      .update(updateData)
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

// ============================================================================
// generateBookmarkEmbedding
// ============================================================================

/**
 * 异步生成书签向量嵌入（不阻塞主流程）
 * @param bookmarkId - 书签ID
 * @param title - 标题
 * @param summary - AI摘要
 * @param tags - AI标签
 * @param userId - 用户ID
 * @param folderId - 文件夹ID（用于 embedding 完成后更新 folder profile）
 */
export async function generateBookmarkEmbedding(
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
      .update({ embedding: JSON.stringify(embedding) })
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
        "@/lib/folder-profile/manager"
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

// ============================================================================
// processAIFolderRecommendation
// ============================================================================

/**
 * 异步处理 AI 文件夹推荐（不阻塞主流程）
 * 根据置信度自动归类或保存建议
 */
export async function processAIFolderRecommendation(
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
    type FolderWithProfile = {
      id: number;
      name: string;
      folder_profiles:
        | { top_tags: unknown; bookmark_count: number }[]
        | { top_tags: unknown; bookmark_count: number }
        | null;
    };

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
      .is("deleted_at", null)
      .returns<FolderWithProfile[]>();

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

// ============================================================================
// generateBookmarkAIContent
// ============================================================================

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
export async function generateBookmarkAIContent(
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

          // 自动保存内容快照（fire-and-forget，不阻塞 AI 流程）
          // 跳过微信公众号文章：微信有专用抓取流程（/api/wechat-article/create），
          // 会获取完整 HTML + 样式 + 图片。auto-save 仅存 Jina markdown，
          // 会抢占唯一索引导致微信完整快照无法创建
          if (!isWechatArticleUrl(url)) {
            saveContentSnapshot(
              bookmarkId,
              url,
              userId,
              fetchResult,
              title,
            ).catch((err) => {
              logger.warn(
                {
                  bookmarkId,
                  error: err instanceof Error ? err.message : String(err),
                },
                "AI Content (async): Auto-save snapshot failed (non-blocking)",
              );
            });
          }
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
    // 传入 bookmarkId/userId 以启用新 SummaryService（USE_NEW_SUMMARY_SERVICE=true 时），否则走 DeepSeek 等旧路径
    const aiResult = await generateAIContent(
      {
        title,
        url,
        description: description || undefined,
        content: contentForAI,
        existingFolderNames: folderNames,
      },
      { bookmarkId, userId },
    );

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    // AI 返回 0 个标签时使用占位，避免「无标签」导致功能表现为失效；用户可自行修改
    const aiTags =
      aiResult.tags.length > 0 ? aiResult.tags : (["待分类"] as string[]);

    // 2. 更新书签记录（包括状态更新为 ACTIVE + V2 内容类型）
    const updateData: BookmarkUpdate = {
      ai_summary: aiResult.summary,
      ai_tags: aiTags,
      ai_content_type: aiResult.contentType || null, // V2: AI检测的内容类型
      ai_content_type_confidence: aiResult.contentTypeConfidence || null, // V2: 置信度
      status: "COMPLETED", // AI 内容生成完成
    };

    const { error: updateError } = await supabase
      .from("bookmarks")
      .update(updateData)
      .eq("id", bookmarkId)
      .eq("user_id", userId);

    if (updateError) {
      throw updateError;
    }

    logger.info(
      {
        bookmarkId,
        summary: aiResult.summary.substring(0, 50) + "...",
        tagCount: aiTags.length,
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
          aiTags,
          userId,
          currentFolderId,
        ),
      userId,
      bookmarkId,
    );

    // 5. AI 文件夹推荐（仅当用户未指定文件夹时）
    if (!userSpecifiedFolderId && aiResult.summary && aiTags.length > 0) {
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
              aiTags,
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
              aiTags,
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

// ============================================================================
// saveContentSnapshot
// ============================================================================

/** 内容快照最小有效长度（字符） */
const MIN_SNAPSHOT_CONTENT_LENGTH = 200;
/** 摘要片段最大长度 */
const MAX_EXCERPT_LENGTH = 300;

/**
 * 自动保存内容快照（收藏时触发）
 *
 * 复用 smartFetchContent 已获取的内容，直接写入 bookmark_snapshots 表。
 * DB 触发器会自动同步 bookmarks.has_snapshot / snapshot_status。
 * 唯一索引 idx_snapshots_bookmark_unique 保证不会重复创建（微信文章等已有快照时自动跳过）。
 *
 * @param bookmarkId - 书签 ID
 * @param url - 原始 URL
 * @param userId - 用户 ID
 * @param fetchResult - smartFetchContent 的返回结果
 * @param title - 书签标题（可选，用于快照 readable_title）
 */
export async function saveContentSnapshot(
  bookmarkId: number,
  url: string,
  userId: string,
  fetchResult: ContentFetchResult,
  title?: string,
): Promise<void> {
  try {
    // 内容过短，不值得保存快照
    if (fetchResult.content.length < MIN_SNAPSHOT_CONTENT_LENGTH) {
      logger.info(
        {
          bookmarkId,
          contentLength: fetchResult.content.length,
          action: "snapshot_skip_short",
        },
        "Content Snapshot: Content too short, skipping",
      );
      return;
    }

    // 提取纯文本（markdown 需要转换）
    const textContent =
      fetchResult.format === "markdown"
        ? extractTextFromMarkdown(fetchResult.content)
        : fetchResult.content;

    // 生成摘要片段
    const excerpt = textContent.substring(0, MAX_EXCERPT_LENGTH).trim();

    // 使用 service client 绕过 RLS（异步任务中用户会话可能已失效）
    const { createServiceClient } = await import("@/lib/supabase/server");
    const supabase = await createServiceClient();

    // 直接插入快照记录（status = completed，无需 job queue）
    // 唯一索引 idx_snapshots_bookmark_unique 会在已有活跃快照时阻止插入
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("bookmark_snapshots")
      .insert({
        bookmark_id: bookmarkId,
        user_id: userId,
        snapshot_type: "basic",
        status: "completed",
        original_url: url,
        readable_title: title || null,
        readable_content:
          fetchResult.format === "markdown" ? fetchResult.content : null,
        readable_text_content: textContent,
        readable_excerpt: excerpt,
        readable_word_count: fetchResult.wordCount || textContent.length,
        captured_at: new Date().toISOString(),
        trigger_source: "auto-save",
        file_size: new TextEncoder().encode(textContent).byteLength,
      });

    if (error) {
      // 唯一索引冲突 = 快照已存在（微信流程等已创建），正常跳过
      if (error.code === "23505") {
        logger.info(
          { bookmarkId, action: "snapshot_already_exists" },
          "Content Snapshot: Snapshot already exists, skipping",
        );
        return;
      }
      throw error;
    }

    logger.info(
      {
        bookmarkId,
        contentLength: textContent.length,
        format: fetchResult.format,
        source: fetchResult.source,
        action: "snapshot_saved",
      },
      "Content Snapshot: Auto-saved successfully",
    );
  } catch (error) {
    // 快照保存失败不影响主流程
    logger.error(
      {
        bookmarkId,
        error: error instanceof Error ? error.message : String(error),
        action: "snapshot_save_failed",
      },
      "Content Snapshot: Save failed (non-blocking)",
    );
  }
}
