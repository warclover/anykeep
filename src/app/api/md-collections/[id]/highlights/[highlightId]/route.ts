/**
 * 单个高亮 API 路由
 * Spec: md-reader-upgrade / REQ-10
 *
 * PATCH /api/md-collections/[id]/highlights/[highlightId] - 更新高亮颜色
 * DELETE /api/md-collections/[id]/highlights/[highlightId] - 删除高亮
 */

import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
  notFoundError,
  forbiddenError,
  databaseError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { AUTH } from "@/lib/constants/messages";
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
  userId: string;
  supabase: SupabaseClient<Database>;
}

interface ValidationError {
  success: false;
  response: Response;
}

/**
 * 验证高亮操作权限
 * 包含用户身份验证、collection 所有权验证、highlight 存在性验证
 */
async function validateHighlightAccess(
  collectionId: number,
  highlightId: string,
  errorMessage: string,
): Promise<ValidationResult | ValidationError> {
  // 1. 验证用户身份
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, response: unauthorizedError() };
  }

  // 2. 双重验证：先验证 collection 所有权
  const { data: collection, error: collectionError } = await supabase
    .from("md_collections")
    .select("id, user_id")
    .eq("id", collectionId)
    .is("deleted_at", null)
    .single();

  if (collectionError) {
    if (collectionError.code === "PGRST116") {
      return { success: false, response: notFoundError(MESSAGES.NOT_FOUND) };
    }
    return {
      success: false,
      response: databaseError(errorMessage, collectionError),
    };
  }

  if (collection.user_id !== user.id) {
    return { success: false, response: forbiddenError(AUTH.FORBIDDEN) };
  }

  // 3. 验证高亮存在且属于当前用户
  const { data: existingHighlight, error: checkError } = await supabase
    .from("md_collection_highlights")
    .select("id, user_id, collection_id")
    .eq("id", highlightId)
    .eq("collection_id", collectionId)
    .single();

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

  if (!existingHighlight || existingHighlight.user_id !== user.id) {
    return { success: false, response: forbiddenError(AUTH.FORBIDDEN) };
  }

  return { success: true, userId: user.id, supabase };
}

// ============================================
// PATCH /api/md-collections/[id]/highlights/[highlightId]
// ============================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; highlightId: string }> },
) {
  try {
    const { id, highlightId } = await params;
    const collectionId = parseInt(id);

    if (isNaN(collectionId)) {
      return notFoundError(MESSAGES.NOT_FOUND);
    }

    // 验证权限
    const validation = await validateHighlightAccess(
      collectionId,
      highlightId,
      MESSAGES.UPDATE_ERROR,
    );

    if (!validation.success) {
      return validation.response;
    }

    const { userId, supabase } = validation;

    // 解析并验证请求体
    const body = await request.json();
    const schemaValidation = updateHighlightSchema.safeParse(body);

    if (!schemaValidation.success) {
      return handleValidationError(schemaValidation.error);
    }

    const { color } = schemaValidation.data;

    // 更新高亮
    const { data: updatedHighlight, error: updateError } = await supabase
      .from("md_collection_highlights")
      .update({ color })
      .eq("id", highlightId)
      .select()
      .single();

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
}

// ============================================
// DELETE /api/md-collections/[id]/highlights/[highlightId]
// ============================================

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; highlightId: string }> },
) {
  try {
    const { id, highlightId } = await params;
    const collectionId = parseInt(id);

    if (isNaN(collectionId)) {
      return notFoundError(MESSAGES.NOT_FOUND);
    }

    // 验证权限
    const validation = await validateHighlightAccess(
      collectionId,
      highlightId,
      MESSAGES.DELETE_ERROR,
    );

    if (!validation.success) {
      return validation.response;
    }

    const { userId, supabase } = validation;

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
}
