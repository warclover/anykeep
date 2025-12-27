/**
 * 单个高亮 API 路由
 * Spec: md-reader-upgrade / REQ-10
 *
 * PATCH /api/md-collections/[id]/highlights/[highlightId] - 更新高亮颜色
 * DELETE /api/md-collections/[id]/highlights/[highlightId] - 删除高亮
 */

import type { NextRequest } from "next/server";
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

// ============================================
// 常量
// ============================================

const TABLE_NAME = "md_collection_highlights";

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

    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
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
        return notFoundError(MESSAGES.NOT_FOUND);
      }
      return databaseError(MESSAGES.UPDATE_ERROR, collectionError);
    }

    if (collection.user_id !== user.id) {
      return forbiddenError(AUTH.FORBIDDEN);
    }

    // 3. 验证高亮存在且属于当前用户（使用类型断言）
    const { data: existingHighlight, error: checkError } = await (
      supabase as unknown as {
        from: (table: string) => {
          select: (columns: string) => {
            eq: (
              column: string,
              value: string,
            ) => {
              eq: (
                column: string,
                value: number,
              ) => {
                single: () => Promise<{
                  data: {
                    id: string;
                    user_id: string;
                    collection_id: number;
                  } | null;
                  error: { message: string; code?: string } | null;
                }>;
              };
            };
          };
        };
      }
    )
      .from(TABLE_NAME)
      .select("id, user_id, collection_id")
      .eq("id", highlightId)
      .eq("collection_id", collectionId)
      .single();

    if (checkError) {
      if (checkError.code === "PGRST116") {
        return notFoundError(MESSAGES.HIGHLIGHT_NOT_FOUND);
      }
      return databaseError(MESSAGES.UPDATE_ERROR, checkError);
    }

    if (!existingHighlight || existingHighlight.user_id !== user.id) {
      return forbiddenError(AUTH.FORBIDDEN);
    }

    // 3. 解析并验证请求体
    const body = await request.json();
    const validation = updateHighlightSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { color } = validation.data;

    // 4. 更新高亮（使用类型断言）
    const { data: updatedHighlight, error: updateError } = await (
      supabase as unknown as {
        from: (table: string) => {
          update: (values: Record<string, unknown>) => {
            eq: (
              column: string,
              value: string,
            ) => {
              select: () => {
                single: () => Promise<{
                  data: unknown | null;
                  error: { message: string; code?: string } | null;
                }>;
              };
            };
          };
        };
      }
    )
      .from(TABLE_NAME)
      .update({ color })
      .eq("id", highlightId)
      .select()
      .single();

    if (updateError) {
      return databaseError(MESSAGES.UPDATE_ERROR, updateError);
    }

    logger.info(
      {
        userId: user.id,
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
  request: NextRequest,
  { params }: { params: Promise<{ id: string; highlightId: string }> },
) {
  try {
    const { id, highlightId } = await params;
    const collectionId = parseInt(id);

    if (isNaN(collectionId)) {
      return notFoundError(MESSAGES.NOT_FOUND);
    }

    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
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
        return notFoundError(MESSAGES.NOT_FOUND);
      }
      return databaseError(MESSAGES.DELETE_ERROR, collectionError);
    }

    if (collection.user_id !== user.id) {
      return forbiddenError(AUTH.FORBIDDEN);
    }

    // 3. 验证高亮存在且属于当前用户（使用类型断言）
    const { data: existingHighlight, error: checkError } = await (
      supabase as unknown as {
        from: (table: string) => {
          select: (columns: string) => {
            eq: (
              column: string,
              value: string,
            ) => {
              eq: (
                column: string,
                value: number,
              ) => {
                single: () => Promise<{
                  data: {
                    id: string;
                    user_id: string;
                    collection_id: number;
                  } | null;
                  error: { message: string; code?: string } | null;
                }>;
              };
            };
          };
        };
      }
    )
      .from(TABLE_NAME)
      .select("id, user_id, collection_id")
      .eq("id", highlightId)
      .eq("collection_id", collectionId)
      .single();

    if (checkError) {
      if (checkError.code === "PGRST116") {
        return notFoundError(MESSAGES.HIGHLIGHT_NOT_FOUND);
      }
      return databaseError(MESSAGES.DELETE_ERROR, checkError);
    }

    if (!existingHighlight || existingHighlight.user_id !== user.id) {
      return forbiddenError(AUTH.FORBIDDEN);
    }

    // 3. 删除高亮（使用类型断言）
    const { error: deleteError } = await (
      supabase as unknown as {
        from: (table: string) => {
          delete: () => {
            eq: (
              column: string,
              value: string,
            ) => Promise<{
              error: { message: string; code?: string } | null;
            }>;
          };
        };
      }
    )
      .from(TABLE_NAME)
      .delete()
      .eq("id", highlightId);

    if (deleteError) {
      return databaseError(MESSAGES.DELETE_ERROR, deleteError);
    }

    logger.info(
      {
        userId: user.id,
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
