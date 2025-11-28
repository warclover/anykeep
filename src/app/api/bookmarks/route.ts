/**
 * 收藏 API 路由
 * POST /api/bookmarks - 创建收藏
 * GET /api/bookmarks - 获取收藏列表
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
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
import { generateAIContent } from "@/lib/utils/ai-generator";
import {
  generateEmbedding,
  buildEmbeddingText,
} from "@/lib/utils/embedding-generator";
import { recommendFolder } from "@/lib/utils/ai-generator";
import { logger } from "@/lib/logger";
import type { BookmarkInsert } from "@/types/supabase";
import { BOOKMARK, STORAGE } from "@/lib/constants/messages";

/**
 * 异步生成书签向量嵌入（不阻塞主流程）
 * @param bookmarkId - 书签ID
 * @param title - 标题
 * @param summary - AI摘要
 * @param tags - AI标签
 * @param userId - 用户ID
 */
async function generateBookmarkEmbedding(
  bookmarkId: number,
  title: string,
  summary: string | null,
  tags: string[] | null,
  userId: string,
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

    const { error } = await supabase
      .from("bookmarks")
      .update({ embedding })
      .eq("id", bookmarkId)
      .eq("user_id", userId);

    if (error) {
      throw error;
    }

    logger.info(
      { bookmarkId, action: "embedding_success" },
      "Embedding: Generated successfully",
    );
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
 * @param bookmarkId - 书签ID
 * @param title - 标题
 * @param description - 描述
 * @param folderNames - 用户现有文件夹名称（用于标签参考）
 * @param userId - 用户ID
 * @param userSpecifiedFolderId - 用户是否指定了文件夹
 */
async function generateBookmarkAIContent(
  bookmarkId: number,
  title: string,
  description: string | null,
  folderNames: string[],
  userId: string,
  userSpecifiedFolderId: boolean,
): Promise<void> {
  try {
    logger.info(
      {
        bookmarkId,
        title: title.substring(0, 30),
        action: "async_ai_start",
      },
      "AI Content (async): Starting generation",
    );

    // 1. 生成 AI 摘要和标签
    const aiResult = await generateAIContent({
      title,
      description: description || undefined,
      existingFolderNames: folderNames,
    });

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    // 2. 更新书签记录
    const { error: updateError } = await supabase
      .from("bookmarks")
      .update({
        ai_summary: aiResult.summary,
        ai_tags: aiResult.tags,
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
        action: "async_ai_success",
      },
      "AI Content (async): Generated and saved",
    );

    // 3. 生成向量嵌入
    generateBookmarkEmbedding(
      bookmarkId,
      title,
      aiResult.summary,
      aiResult.tags,
      userId,
    ).catch((err) => {
      logger.error(
        { error: err, bookmarkId },
        "AI Content (async): Embedding generation failed",
      );
    });

    // 4. AI 文件夹推荐（仅当用户未指定文件夹时）
    if (
      !userSpecifiedFolderId &&
      aiResult.summary &&
      aiResult.tags.length > 0
    ) {
      processAIFolderRecommendation(
        bookmarkId,
        title,
        aiResult.summary,
        aiResult.tags,
        userId,
      ).catch((err) => {
        logger.error(
          { error: err, bookmarkId },
          "AI Content (async): Folder recommendation failed",
        );
      });
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

    // 获取用户文件夹
    const { data: userFolders } = await supabase
      .from("folders")
      .select("id, name")
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

    logger.info(
      {
        bookmarkId,
        title: title.substring(0, 30),
        folderCount: userFolders.length,
        action: "async_recommend_start",
      },
      "AI Classification (async): Starting folder recommendation",
    );

    // 调用 AI 推荐
    const aiRecommendation = await recommendFolder(
      title,
      summary,
      tags,
      userFolders,
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
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

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

    if (profile.storage_used >= profile.storage_quota) {
      return quotaExceededError(STORAGE.QUOTA_EXCEEDED);
    }

    // 4. 识别平台类型
    const platform = detectPlatformFromUrl(url);

    // 5. 如果缺少标题或描述，尝试自动爬取
    let finalTitle = title;
    let finalDescription: string | null | undefined = description;
    // 优先使用前端传来的数据（来自 metadata API）
    let sourceName: string | undefined = userSourceName || undefined;
    let author: string | undefined = userAuthor || undefined;
    let coverUrl: string | undefined;
    let wordCount: number | undefined = userWordCount;
    let imageCount: number | undefined = userImageCount;
    let publishTime: string | undefined = userPublishTime || undefined;

    if (!title || !description) {
      try {
        logger.info(
          {
            url,
            action: "crawl_start",
          },
          "Crawler: Auto-crawling content",
        );
        const crawlResult = await crawlContent(url);

        // 使用爬取的数据填充缺失字段（优先使用前端提供的值）
        finalTitle = title || crawlResult.title;
        finalDescription = description || crawlResult.description || null;
        sourceName = sourceName || crawlResult.sourceName; // 来源名称
        author = author || crawlResult.author; // 文章作者
        coverUrl = crawlResult.coverUrl;
        // 只在前端没有提供统计数据时才使用爬取的值
        wordCount = wordCount ?? crawlResult.wordCount;
        imageCount = imageCount ?? crawlResult.imageCount;
        publishTime = publishTime || crawlResult.publishTime; // 发布时间

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
          "Crawler: Success",
        );
      } catch (error) {
        // 爬取失败不影响创建收藏，使用用户输入或默认值
        logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            url,
            action: "crawl_failed",
          },
          "Crawler: Failed",
        );
        finalTitle = title || "URL 收藏";
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
    // 异步生成 AI 内容（摘要、标签）及后续任务（向量嵌入、文件夹推荐）
    generateBookmarkAIContent(
      bookmark.id,
      finalTitle,
      finalDescription ?? null, // 确保类型为 string | null
      folderNames,
      user.id,
      !!folderId, // 用户是否指定了文件夹
    ).catch((err) => {
      logger.error(
        { error: err, bookmarkId: bookmark.id },
        "Background AI content generation failed",
      );
    });

    // 13. 返回创建的收藏对象
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
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 2. 解析查询参数
    const searchParams = request.nextUrl.searchParams;
    const queryParams = {
      platform: searchParams.get("platform"),
      folderId: searchParams.get("folderId"),
      keyword: searchParams.get("keyword"),
      cursor: searchParams.get("cursor"),
      limit: searchParams.get("limit"),
    };

    const validation = getBookmarksQuerySchema.safeParse(queryParams);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { platform, folderId, keyword, cursor, limit } = validation.data;

    // 3. 构建查询
    let query = supabase
      .from("bookmarks")
      .select("*, folders(name)", { count: "exact" })
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    // 平台筛选
    if (platform) {
      query = query.eq("platform", platform);
    }

    // 文件夹筛选
    if (folderId) {
      query = query.eq("folder_id", folderId);
    }

    // 关键词搜索（标题 + 描述）
    if (keyword) {
      query = query.or(
        `title.ilike.%${keyword}%,description.ilike.%${keyword}%`,
      );
    }

    // 游标分页（"加载更多"模式）
    if (cursor) {
      query = query.lt("id", cursor);
    }

    // 限制数量
    query = query.limit(limit);

    // 4. 执行查询
    const { data: bookmarks, error: queryError, count } = await query;

    if (queryError) {
      return databaseError(BOOKMARK.LOAD_ERROR, queryError);
    }

    // 5. 返回结果（包含分页元数据）
    const hasMore = bookmarks && bookmarks.length === limit;
    const nextCursor =
      hasMore && bookmarks.length > 0
        ? bookmarks[bookmarks.length - 1].id
        : null;

    return successResponse({
      bookmarks: bookmarks || [],
      pagination: {
        total: count || 0,
        limit,
        nextCursor,
        hasMore,
      },
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "get_bookmarks",
      },
      "GET /api/bookmarks error",
    );
    return internalError(BOOKMARK.LOAD_ERROR);
  }
}
