/**
 * 单个 MD 收藏 API 路由
 * P2-007: Markdown 内容收藏
 *
 * GET /api/md-collections/[id] - 获取 MD 收藏详情
 * PATCH /api/md-collections/[id] - 更新 MD 收藏
 * DELETE /api/md-collections/[id] - 删除 MD 收藏
 */

import { createClient } from "@/lib/supabase/server";
import { updateMdCollectionSchema } from "@/lib/validation";
import {
  successResponse,
  handleValidationError,
  notFoundError,
  forbiddenError,
  databaseError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { MD_COLLECTION, AUTH } from "@/lib/constants/messages";
import { withAuthMiddleware } from "@/lib/api/middleware";
import {
  computeContentHash,
  preprocessMarkdownForAI,
  sanitizeMarkdownContent,
} from "@/features/md-collections/lib";

/**
 * GET /api/md-collections/[id]
 * 获取单个 MD 收藏详情
 */
export const GET = withAuthMiddleware<{ id: string }>(
  async (_request, { userId, params }) => {
    try {
      const { id } = await params;
      const collectionId = parseInt(id);

      if (isNaN(collectionId)) {
        return notFoundError(MD_COLLECTION.NOT_FOUND);
      }

      const supabase = await createClient();

      // 查询 MD 收藏详情
      const { data: collection, error: queryError } = await supabase
        .from("md_collections")
        .select("*, folders(name)")
        .eq("id", collectionId)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .single();

      if (queryError) {
        if (queryError.code === "PGRST116") {
          return notFoundError(MD_COLLECTION.NOT_FOUND);
        }
        return databaseError(MD_COLLECTION.LOAD_ERROR, queryError);
      }

      return successResponse(collection);
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          operation: "get_md_collection",
        },
        "GET /api/md-collections/[id] error",
      );
      return internalError(MD_COLLECTION.LOAD_ERROR);
    }
  },
);

/**
 * PATCH /api/md-collections/[id]
 * 更新 MD 收藏
 */
export const PATCH = withAuthMiddleware<{ id: string }>(
  async (request, { userId, params }) => {
    try {
      const { id } = await params;
      const collectionId = parseInt(id);

      if (isNaN(collectionId)) {
        return notFoundError(MD_COLLECTION.NOT_FOUND);
      }

      const supabase = await createClient();

      // 1. 解析并验证请求体
      const body = await request.json();
      const validation = updateMdCollectionSchema.safeParse(body);

      if (!validation.success) {
        return handleValidationError(validation.error);
      }

      const {
        title,
        rawContent,
        contentType,
        userTags,
        folderId,
        isRead,
        isStarred,
      } = validation.data;

      // 2. 检查 MD 收藏是否存在且属于当前用户
      type CollectionCheckRow = { id: number; user_id: string };
      const { data: existingCollection, error: checkError } = (await supabase
        .from("md_collections")
        .select("id, user_id")
        .eq("id", collectionId)
        .is("deleted_at", null)
        .single()) as {
        data: CollectionCheckRow | null;
        error: { code?: string; message: string } | null;
      };

      if (checkError) {
        if (checkError.code === "PGRST116") {
          return notFoundError(MD_COLLECTION.NOT_FOUND);
        }
        return databaseError(MD_COLLECTION.LOAD_ERROR, checkError);
      }

      if (!existingCollection || existingCollection.user_id !== userId) {
        return forbiddenError(AUTH.FORBIDDEN);
      }

      // 3. 构建更新数据
      const updateData: Record<string, unknown> = {};

      if (title !== undefined) {
        updateData.title = title;
      }

      if (rawContent !== undefined) {
        const sanitizedContent = sanitizeMarkdownContent(rawContent);
        updateData.raw_content = sanitizedContent;

        updateData.content_hash = computeContentHash(sanitizedContent);
        const preprocessResult = preprocessMarkdownForAI(sanitizedContent);
        updateData.word_count = preprocessResult.metadata.wordCount;
        updateData.code_block_count = preprocessResult.metadata.codeBlockCount;
        updateData.reading_time_minutes =
          preprocessResult.metadata.readingTimeMinutes;

        updateData.processing_status = "pending";
        updateData.ai_summary = null;
        updateData.ai_tags = null;
        updateData.embedding = null;
      }

      if (contentType !== undefined) {
        updateData.content_type = contentType;
      }

      if (userTags !== undefined) {
        updateData.user_tags = userTags;
      }

      if (folderId !== undefined) {
        updateData.folder_id = folderId;
      }

      if (isRead !== undefined) {
        updateData.is_read = isRead;
        updateData.read_at = isRead ? new Date().toISOString() : null;
      }

      if (isStarred !== undefined) {
        updateData.is_starred = isStarred;
        updateData.starred_at = isStarred ? new Date().toISOString() : null;
      }

      // 4. 更新记录
      const { data: updatedCollection, error: updateError } = (await supabase
        .from("md_collections")
        .update(updateData)
        .eq("id", collectionId)
        .select("*, folders(name)")
        .single()) as {
        data: Record<string, unknown> | null;
        error: { message: string } | null;
      };

      if (updateError) {
        return databaseError(MD_COLLECTION.UPDATE_ERROR, updateError);
      }

      logger.info(
        {
          userId,
          collectionId,
          updatedFields: Object.keys(updateData),
          action: "md_collection_updated",
        },
        "MD collection updated",
      );

      return successResponse(updatedCollection);
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          operation: "update_md_collection",
        },
        "PATCH /api/md-collections/[id] error",
      );
      return internalError(MD_COLLECTION.UPDATE_ERROR);
    }
  },
);

/**
 * DELETE /api/md-collections/[id]
 * 删除 MD 收藏（软删除）
 */
export const DELETE = withAuthMiddleware<{ id: string }>(
  async (_request, { userId, params }) => {
    try {
      const { id } = await params;
      const collectionId = parseInt(id);

      if (isNaN(collectionId)) {
        return notFoundError(MD_COLLECTION.NOT_FOUND);
      }

      const supabase = await createClient();

      // 1. 检查 MD 收藏是否存在且属于当前用户
      type CollectionDeleteRow = { id: number; user_id: string; title: string };
      const { data: existingCollection, error: checkError } = (await supabase
        .from("md_collections")
        .select("id, user_id, title")
        .eq("id", collectionId)
        .is("deleted_at", null)
        .single()) as {
        data: CollectionDeleteRow | null;
        error: { code?: string; message: string } | null;
      };

      if (checkError) {
        if (checkError.code === "PGRST116") {
          return notFoundError(MD_COLLECTION.NOT_FOUND);
        }
        return databaseError(MD_COLLECTION.LOAD_ERROR, checkError);
      }

      if (!existingCollection || existingCollection.user_id !== userId) {
        return forbiddenError(AUTH.FORBIDDEN);
      }

      // 2. 软删除记录
      const { error: deleteError } = (await supabase
        .from("md_collections")
        .update({
          deleted_at: new Date().toISOString(),
        })
        .eq("id", collectionId)) as { error: { message: string } | null };

      if (deleteError) {
        return databaseError(MD_COLLECTION.DELETE_ERROR, deleteError);
      }

      logger.info(
        {
          userId,
          collectionId,
          title: existingCollection.title,
          action: "md_collection_deleted",
        },
        "MD collection deleted",
      );

      return successResponse({
        id: collectionId,
        deleted: true,
      });
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          operation: "delete_md_collection",
        },
        "DELETE /api/md-collections/[id] error",
      );
      return internalError(MD_COLLECTION.DELETE_ERROR);
    }
  },
);
