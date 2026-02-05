/**
 * MD 收藏 API 路由
 * P2-007: Markdown 内容收藏
 *
 * GET /api/md-collections - 获取 MD 收藏列表
 * POST /api/md-collections - 创建 MD 收藏
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createMdCollectionSchema,
  getMdCollectionsQuerySchema,
} from "@/lib/validation";
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
  forbiddenError,
  databaseError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { MD_COLLECTION } from "@/lib/constants/messages";
import {
  computeContentHash,
  preprocessMarkdownForAI,
  validateMarkdownContent,
  sanitizeMarkdownContent,
  extractTitle,
  canCreateMdCollection,
  ensureAIGeneratedFolder,
} from "@/features/md-collections/lib";
import { triggerMdAIProcessing } from "@/features/md-collections/lib/ai";

/**
 * GET /api/md-collections
 * 获取 MD 收藏列表（游标分页）
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
    const validation = getMdCollectionsQuerySchema.safeParse({
      cursor: searchParams.get("cursor"),
      limit: searchParams.get("limit"),
      folderId: searchParams.get("folderId"),
      contentType: searchParams.get("contentType"),
      keyword: searchParams.get("keyword"),
      sort: searchParams.get("sort"),
      isRead: searchParams.get("isRead"),
      isStarred: searchParams.get("isStarred"),
    });

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const {
      cursor,
      limit,
      folderId,
      contentType,
      keyword,
      sort,
      isRead,
      isStarred,
    } = validation.data;

    // 3. 构建查询
    let query = supabase
      .from("md_collections")
      .select("*")
      .eq("user_id", user.id)
      .is("deleted_at", null);

    // 应用筛选条件
    if (folderId !== undefined && folderId !== null) {
      query = query.eq("folder_id", folderId);
    }

    if (contentType) {
      query = query.eq("content_type", contentType);
    }

    if (keyword) {
      // 标题和内容模糊搜索
      query = query.or(
        `title.ilike.%${keyword}%,raw_content.ilike.%${keyword}%`,
      );
    }

    if (isRead !== undefined) {
      query = query.eq("is_read", isRead);
    }

    if (isStarred !== undefined) {
      query = query.eq("is_starred", isStarred);
    }

    // 应用排序
    switch (sort) {
      case "created_asc":
        query = query.order("created_at", { ascending: true });
        break;
      case "title_asc":
        query = query.order("title", { ascending: true });
        break;
      case "title_desc":
        query = query.order("title", { ascending: false });
        break;
      case "reading_time_desc":
        query = query.order("reading_time_minutes", { ascending: false });
        break;
      case "created_desc":
      default:
        query = query.order("created_at", { ascending: false });
        break;
    }

    // 应用游标分页
    if (cursor) {
      query = query.lt("id", cursor);
    }

    query = query.limit(limit + 1); // 多取一条用于判断是否还有更多

    // 类型断言: 手动维护类型文件时需要此断言
    type MdCollectionRow = {
      id: string;
      title: string;
      [key: string]: unknown;
    };

    // 4. 执行查询
    const { data: items, error: queryError } = (await query) as {
      data: MdCollectionRow[] | null;
      error: { message: string } | null;
    };

    if (queryError) {
      return databaseError(MD_COLLECTION.LOAD_ERROR, queryError);
    }

    // 5. 处理分页
    const itemList = items ?? [];
    const hasMore = itemList.length > limit;
    const results = hasMore ? itemList.slice(0, limit) : itemList;
    const nextCursor =
      hasMore && results.length > 0 ? results[results.length - 1].id : null;

    return successResponse({
      items: results,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "get_md_collections",
      },
      "GET /api/md-collections error",
    );
    return internalError(MD_COLLECTION.LOAD_ERROR);
  }
}

/**
 * POST /api/md-collections
 * 创建 MD 收藏
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

    // 2. 检查用户会员类型和功能权限
    const profileResult = await supabase
      .from("profiles")
      .select("membership_type")
      .eq("id", user.id)
      .single();

    const profile = profileResult.data as {
      membership_type: string | null;
    } | null;
    const profileError = profileResult.error as { message: string } | null;

    if (profileError) {
      logger.warn({ error: profileError }, "Failed to get user profile");
      // 默认为 FREE 用户
    }

    const membershipType = profile?.membership_type || "FREE";

    // 3. 获取当前 MD 收藏数量并检查权限
    const { count, error: countError } = await supabase
      .from("md_collections")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (countError) {
      return databaseError(MD_COLLECTION.LOAD_ERROR, countError);
    }

    const gateResult = canCreateMdCollection(membershipType, count || 0);
    if (!gateResult.allowed) {
      return forbiddenError(
        gateResult.reason || MD_COLLECTION.FEATURE_DISABLED,
      );
    }

    // 4. 解析并验证请求体
    const body = await request.json();
    const validation = createMdCollectionSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const {
      title,
      rawContent,
      contentType,
      userTags,
      folderId,
      sourceType,
      sourceMetadata,
    } = validation.data;

    // 5. 验证内容
    const contentValidation = validateMarkdownContent(rawContent);
    if (!contentValidation.valid) {
      return forbiddenError(
        contentValidation.error || MD_COLLECTION.CONTENT_REQUIRED,
      );
    }

    // 6. 清理内容（移除潜在危险内容）
    const sanitizedContent = sanitizeMarkdownContent(rawContent);

    // 7. 计算内容哈希
    const contentHash = computeContentHash(sanitizedContent);

    // 8. 检查重复
    const dupResult = await supabase
      .from("md_collections")
      .select("id, title")
      .eq("user_id", user.id)
      .eq("content_hash", contentHash)
      .is("deleted_at", null)
      .maybeSingle();

    const existingCollection = dupResult.data as {
      id: string;
      title: string;
    } | null;
    const dupError = dupResult.error as { message: string } | null;

    if (dupError) {
      logger.warn({ error: dupError }, "Failed to check duplicate");
    }

    if (existingCollection) {
      return forbiddenError(
        `${MD_COLLECTION.DUPLICATE_FOUND}: "${existingCollection.title}"`,
      );
    }

    // 9. 预处理 Markdown（提取元数据）
    const preprocessResult = preprocessMarkdownForAI(sanitizedContent);

    // 10. 处理标题（如果未提供，尝试从内容提取）
    const finalTitle = title || extractTitle(sanitizedContent) || "无标题";

    // 10.5 处理文件夹：如果是 AI 来源且未指定文件夹，自动使用 AI 生成文件夹
    let finalFolderId = folderId || null;
    const aiSourceTypes = ["ai_response", "deliverable", "synthesis", "report"];
    if (!finalFolderId && sourceType && aiSourceTypes.includes(sourceType)) {
      try {
        finalFolderId = await ensureAIGeneratedFolder(supabase, user.id);
        logger.info(
          { userId: user.id, folderId: finalFolderId, sourceType },
          "Auto-assigned AI generated folder",
        );
      } catch (folderError) {
        logger.warn(
          { error: folderError },
          "Failed to create AI folder, proceeding without folder",
        );
        // 不阻断保存流程，继续使用 null
      }
    }

    // 11. 创建记录
    const createResult = await supabase
      .from("md_collections")
      .insert({
        user_id: user.id,
        title: finalTitle,
        raw_content: sanitizedContent,
        content_hash: contentHash,
        content_type: contentType,
        word_count: preprocessResult.metadata.wordCount,
        code_block_count: preprocessResult.metadata.codeBlockCount,
        reading_time_minutes: preprocessResult.metadata.readingTimeMinutes,
        user_tags: userTags || [],
        folder_id: finalFolderId,
        source_type: sourceType || "paste",
        source_metadata: sourceMetadata || null,
        processing_status: "pending",
      })
      .select()
      .single();

    const newCollection = createResult.data as { id: number } | null;
    const createError = createResult.error as { message: string } | null;

    if (createError || !newCollection) {
      return databaseError(MD_COLLECTION.CREATE_ERROR, createError);
    }

    logger.info(
      {
        userId: user.id,
        collectionId: newCollection.id,
        wordCount: preprocessResult.metadata.wordCount,
        action: "md_collection_created",
      },
      "MD collection created",
    );

    // 12. 异步触发 AI 处理（不阻塞响应）
    triggerMdAIProcessing(newCollection.id, user.id);

    return successResponse(newCollection, 201);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "create_md_collection",
      },
      "POST /api/md-collections error",
    );
    return internalError(MD_COLLECTION.CREATE_ERROR);
  }
}
