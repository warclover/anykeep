/**
 * 单个高亮 API 路由
 * Spec: md-reader-upgrade / REQ-10
 *
 * PATCH /api/md-collections/[id]/highlights/[highlightId] - 更新高亮颜色
 * DELETE /api/md-collections/[id]/highlights/[highlightId] - 删除高亮
 */

import type { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import {
  successResponse,
  handleValidationError,
  notFoundError,
  forbiddenError,
  databaseError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { AUTH } from "@/lib/constants/messages";
import { withAuthMiddleware } from "@/lib/api/middleware";
import type { Database } from "@/types/supabase";

// ============================================
// 常量
// ============================================

const MESSAGES = {
  NOT_FOUND: "文档不存在",
  HIGHLIGHT_NOT_FOUND: "高亮不存在",
  UPDATE_SUCCESS: "高亮更新成功",
  UPDATE_ERROR: "更新高亮失败",
  DELETE_SUCCESS: "高亮删除成功",
  DELETE_ERROR: "删除高亮失败",
};

// ============================================
// 验证 Schema
// ============================================

const updateHighlightSchema = z.object({
  color: z.enum(["yellow", "green", "blue", "pink", "purple"]),
});

// ============================================
// 共享验证逻辑
// ============================================

interface ValidationResult {
  success: true;
  supabase: SupabaseClient<Database>;
}

interface ValidationError {
  success: false;
  response: NextResponse;
}

/**
 * 验证高亮操作权限
 * 包含 collection 所有权验证、highlight 存在性验证
 * (用户身份已由 withAuthMiddleware 验证)
 */
async function validateHighlightAccess(
  userId: string,
  collectionId: number,
  highlightId: string,
  errorMessage: string,
): Promise<ValidationResult | ValidationError> {
  const supabase = await createClient();

  // 1. 双重验证：先验证 collection 所有权
  type CollectionCheckRow = { id: number; user_id: string };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: collection, error: collectionError } = (await (
    supabase.from("md_collections") as any
  )
    .select("id, user_id")
    .eq("id", collectionId)
    .is("deleted_at", null)
    .single()) as {
    data: CollectionCheckRow | null;
    error: { code?: string; message: string } | null;
  };

  if (collectionError) {
    if (collectionError.code === "PGRST116") {
      return { success: false, response: notFoundError(MESSAGES.NOT_FOUND) };
    }
    return {
      success: false,
      response: databaseError(errorMessage, collectionError),
    };
  }

  if (!collection || collection.user_id !== userId) {
    return { success: false, response: forbiddenError(AUTH.FORBIDDEN) };
  }

  // 2. 验证高亮存在且属于当前用户
  type HighlightCheckRow = {
    id: string;
    user_id: string;
    collection_id: number;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingHighlight, error: checkError } = (await (
    supabase.from("md_collection_highlights") as any
  )
    .select("id, user_id, collection_id")
    .eq("id", highlightId)
    .eq("collection_id", collectionId)
    .single()) as {
    data: HighlightCheckRow | null;
    error: { code?: string; message: string } | null;
  };

  if (checkError) {
    if (checkError.code === "PGRST116") {
      return {
        success: false,
        response: notFoundError(MESSAGES.HIGHLIGHT_NOT_FOUND),
      };
    }
    return {
      success: false,
      response: databaseError(errorMessage, checkError),
    };
  }

  if (!existingHighlight || existingHighlight.user_id !== userId) {
    return { success: false, response: forbiddenError(AUTH.FORBIDDEN) };
  }

  return { success: true, supabase };
}

// ============================================
// PATCH /api/md-collections/[id]/highlights/[highlightId]
// ============================================

export const PATCH = withAuthMiddleware<{ id: string; highlightId: string }>(
  async (request, { userId, params }) => {
    try {
      const { id, highlightId } = await params;
      const collectionId = parseInt(id);

      if (isNaN(collectionId)) {
        return notFoundError(MESSAGES.NOT_FOUND);
      }

      // 验证权限
      const validation = await validateHighlightAccess(
        userId,
        collectionId,
        highlightId,
        MESSAGES.UPDATE_ERROR,
      );

      if (!validation.success) {
        return validation.response;
      }

      const { supabase } = validation;

      // 解析并验证请求体
      const body = await request.json();
      const schemaValidation = updateHighlightSchema.safeParse(body);

      if (!schemaValidation.success) {
        return handleValidationError(schemaValidation.error);
      }

      const { color } = schemaValidation.data;

      // 更新高亮
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: updatedHighlight, error: updateError } = (await (
        supabase.from("md_collection_highlights") as any
      )
        .update({ color })
        .eq("id", highlightId)
        .select()
        .single()) as {
        data: Record<string, unknown> | null;
        error: { message: string } | null;
      };

      if (updateError) {
        return databaseError(MESSAGES.UPDATE_ERROR, updateError);
      }

      logger.info(
        {
          userId,
          collectionId,
          highlightId,
          color,
          action: "highlight_updated",
        },
        "Highlight updated",
      );

      return successResponse(updatedHighlight);
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          operation: "update_highlight",
        },
        "PATCH /api/md-collections/[id]/highlights/[highlightId] error",
      );
      return internalError(MESSAGES.UPDATE_ERROR);
    }
  },
);

// ============================================
// DELETE /api/md-collections/[id]/highlights/[highlightId]
// ============================================

export const DELETE = withAuthMiddleware<{ id: string; highlightId: string }>(
  async (_request, { userId, params }) => {
    try {
      const { id, highlightId } = await params;
      const collectionId = parseInt(id);

      if (isNaN(collectionId)) {
        return notFoundError(MESSAGES.NOT_FOUND);
      }

      // 验证权限
      const validation = await validateHighlightAccess(
        userId,
        collectionId,
        highlightId,
        MESSAGES.DELETE_ERROR,
      );

      if (!validation.success) {
        return validation.response;
      }

      const { supabase } = validation;

      // 删除高亮
      const { error: deleteError } = await supabase
        .from("md_collection_highlights")
        .delete()
        .eq("id", highlightId);

      if (deleteError) {
        return databaseError(MESSAGES.DELETE_ERROR, deleteError);
      }

      logger.info(
        {
          userId,
          collectionId,
          highlightId,
          action: "highlight_deleted",
        },
        "Highlight deleted",
      );

      return successResponse({
        id: highlightId,
        deleted: true,
      });
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          operation: "delete_highlight",
        },
        "DELETE /api/md-collections/[id]/highlights/[highlightId] error",
      );
      return internalError(MESSAGES.DELETE_ERROR);
    }
  },
);
