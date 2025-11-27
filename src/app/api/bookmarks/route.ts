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
      wordCount: userWordCount,
      imageCount: userImageCount,
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
    let author: string | undefined;
    let coverUrl: string | undefined;
    // 优先使用前端传来的统计数据（来自 metadata API）
    let wordCount: number | undefined = userWordCount;
    let imageCount: number | undefined = userImageCount;

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

        // 使用爬取的数据填充缺失字段
        finalTitle = title || crawlResult.title;
        finalDescription = description || crawlResult.description || null;
        author = crawlResult.author;
        coverUrl = crawlResult.coverUrl;
        // 只在前端没有提供统计数据时才使用爬取的值
        wordCount = wordCount ?? crawlResult.wordCount;
        imageCount = imageCount ?? crawlResult.imageCount;

        logger.info(
          {
            title: finalTitle,
            platform: crawlResult.platform,
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

    // 7. 生成 AI 摘要和标签
    let aiSummary: string | null = null;
    let aiTags: string[] | null = null;

    try {
      logger.info(
        {
          title: finalTitle,
          folderCount: folderNames.length,
          action: "ai_generate_start",
        },
        "AI: Generating summary and tags",
      );
      const aiResult = await generateAIContent({
        title: finalTitle,
        description: finalDescription || undefined,
        existingFolderNames: folderNames, // 传递文件夹名称用于标签参考
      });

      aiSummary = aiResult.summary;
      aiTags = aiResult.tags;

      logger.info(
        {
          summary: aiSummary.substring(0, 50) + "...",
          tagCount: aiTags.length,
          action: "ai_generate_success",
        },
        "AI: Success",
      );
    } catch (error) {
      // AI 生成失败不影响创建收藏
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          title: finalTitle,
          action: "ai_generate_failed",
        },
        "AI: Failed",
      );
      aiSummary = null;
      aiTags = null;
    }

    // 8. AI 文件夹推荐与置信度分层自动归类
    let finalFolderId = folderId;
    let aiRecommendation: Awaited<ReturnType<typeof recommendFolder>> | null =
      null;

    if (!finalFolderId && aiSummary && aiTags && userFolders) {
      try {
        // 8.1 调用 AI 推荐文件夹（userFolders 已在步骤6获取）
        logger.info(
          {
            title: finalTitle,
            folderCount: userFolders.length,
            action: "ai_recommend_start",
          },
          "AI Classification: Recommending folder",
        );

        aiRecommendation = await recommendFolder(
          finalTitle,
          aiSummary,
          aiTags,
          userFolders,
        );

        logger.info(
          {
            folderId: aiRecommendation.folderId,
            folderName: aiRecommendation.folderName,
            confidence: aiRecommendation.confidence,
            suggestNew: aiRecommendation.suggestNew,
            action: "ai_recommend_success",
          },
          "AI Classification: Recommendation received",
        );

        // 8.2 根据置信度分层处理
        if (aiRecommendation.confidence >= 80) {
          // 高置信度（≥80%）：自动归类
          if (aiRecommendation.suggestNew) {
            // 建议新建文件夹
            const { data: newFolder, error: createFolderError } = await supabase
              .from("folders")
              .insert({
                user_id: user.id,
                name: aiRecommendation.folderName,
                sort_order: 0,
              })
              .select("id")
              .single();

            if (!createFolderError && newFolder) {
              finalFolderId = newFolder.id;
              logger.info(
                {
                  folderId: newFolder.id,
                  folderName: aiRecommendation.folderName,
                  confidence: aiRecommendation.confidence,
                  action: "auto_create_folder",
                },
                "AI Classification: Auto-created new folder (high confidence)",
              );
            }
          } else if (aiRecommendation.folderId) {
            // 推荐已有文件夹
            finalFolderId = aiRecommendation.folderId;
            logger.info(
              {
                folderId: aiRecommendation.folderId,
                folderName: aiRecommendation.folderName,
                confidence: aiRecommendation.confidence,
                action: "auto_classify",
              },
              "AI Classification: Auto-classified (high confidence)",
            );
          }
        } else if (aiRecommendation.confidence >= 60) {
          // 中置信度（60-79%）：保存建议，稍后让用户确认
          // 注意：此时书签还未创建，需要在书签创建后再保存建议
          // aiRecommendation 已保存，稍后使用
          logger.info(
            {
              confidence: aiRecommendation.confidence,
              action: "pending_suggestion",
            },
            "AI Classification: Medium confidence, will save suggestion after bookmark creation",
          );
        }
        // else: 低置信度（<60%）：使用待整理文件夹（默认行为）

        // 8.3 如果仍未分配文件夹，使用待整理文件夹
        if (!finalFolderId) {
          const { data: inboxFolderId, error: inboxError } = await supabase.rpc(
            "get_or_create_inbox_folder",
            { p_user_id: user.id },
          );

          if (!inboxError && inboxFolderId) {
            finalFolderId = inboxFolderId;
            logger.info(
              {
                folderId: inboxFolderId,
                confidence: aiRecommendation.confidence,
                action: "inbox_fallback",
              },
              "AI Classification: Assigned to inbox folder",
            );
          }
        }
      } catch (error) {
        // AI 推荐失败，降级到待整理文件夹
        logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            title: finalTitle,
            operation: "ai_folder_recommendation",
          },
          "AI Classification: Recommendation failed, using inbox",
        );

        // 获取待整理文件夹
        const { data: inboxFolderId, error: inboxError } = await supabase.rpc(
          "get_or_create_inbox_folder",
          { p_user_id: user.id },
        );

        if (!inboxError && inboxFolderId) {
          finalFolderId = inboxFolderId;
        }
      }
    } else if (!finalFolderId) {
      // 没有 AI 摘要/标签，或者用户手动指定了文件夹
      // 使用待整理文件夹
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
              action: "inbox_default",
            },
            "Bookmark assigned to inbox folder (no AI recommendation)",
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

    // 8. 构建收藏记录
    // 封面优先级：用户上传 > 爬取获取
    const finalCoverUrl = userCoverUrl || coverUrl || null;

    const bookmarkData: BookmarkInsert = {
      user_id: user.id,
      url,
      title: finalTitle,
      description: finalDescription,
      author: author || null,
      cover_url: finalCoverUrl,
      platform,
      folder_id: finalFolderId || null,
      user_tags: userTags || null,
      notes: notes || null,
      ai_summary: aiSummary,
      ai_tags: aiTags,
      word_count: wordCount || null,
      image_count: imageCount || null,
      status: "COMPLETED", // 标记为完成（Week 2 已包含爬虫和 AI）
    };

    // 9. 插入收藏记录
    const { data: bookmark, error: insertError } = await supabase
      .from("bookmarks")
      .insert(bookmarkData)
      .select("*, folders(name)")
      .single();

    if (insertError) {
      return databaseError(BOOKMARK.CREATE_ERROR, insertError);
    }

    // 10. 增加用户存储计数
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

    // 10.5. 保存中置信度分类建议（60-79%）
    let savedSuggestion: { id: number } | null = null;

    if (
      aiRecommendation &&
      aiRecommendation.confidence >= 60 &&
      aiRecommendation.confidence < 80
    ) {
      try {
        const { data: suggestion, error: suggestionError } = await supabase
          .from("classification_suggestions")
          .insert({
            user_id: user.id,
            bookmark_id: bookmark.id,
            suggested_folder_id: aiRecommendation.folderId,
            suggested_folder_name: aiRecommendation.folderName,
            suggest_new_folder: aiRecommendation.suggestNew,
            confidence: aiRecommendation.confidence,
            reason: aiRecommendation.reason,
            status: "pending",
            batch_id: crypto.randomUUID(), // 单个建议也用 batch_id 标识
          })
          .select("id")
          .single();

        if (!suggestionError && suggestion) {
          savedSuggestion = suggestion;
          logger.info(
            {
              suggestionId: suggestion.id,
              bookmarkId: bookmark.id,
              confidence: aiRecommendation.confidence,
              folderName: aiRecommendation.folderName,
              action: "suggestion_saved",
            },
            "AI Classification: Medium confidence suggestion saved",
          );
        } else if (suggestionError) {
          logger.error(
            {
              error: suggestionError,
              bookmarkId: bookmark.id,
              operation: "save_classification_suggestion",
            },
            "Failed to save classification suggestion",
          );
        }
      } catch (error) {
        // 建议保存失败不影响收藏创建
        logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            bookmarkId: bookmark.id,
            operation: "save_classification_suggestion",
          },
          "Exception while saving classification suggestion",
        );
      }
    }

    // 11. 异步生成向量嵌入（不阻塞响应）
    // 使用 Promise 但不 await，让向量生成在后台执行
    generateBookmarkEmbedding(
      bookmark.id,
      finalTitle,
      aiSummary,
      aiTags,
      user.id,
    ).catch((err) => {
      // 捕获任何未处理的错误，避免影响响应
      logger.error(
        { error: err, bookmarkId: bookmark.id },
        "Background embedding generation failed",
      );
    });

    // 12. 返回创建的收藏对象，包含分类信息
    const responseData = {
      ...bookmark,
      classification: {
        auto_classified: aiRecommendation && aiRecommendation.confidence >= 80,
        confidence: aiRecommendation?.confidence || null,
        folder_name: aiRecommendation?.folderName || null,
        suggestion: savedSuggestion
          ? {
              id: savedSuggestion.id,
              folder_name: aiRecommendation!.folderName,
              confidence: aiRecommendation!.confidence,
              reason: aiRecommendation!.reason,
            }
          : null,
      },
    };

    return successResponse(responseData, 201);
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
