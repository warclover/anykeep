/**
 * MD 收藏高亮 API 路由
 * Spec: md-reader-upgrade / REQ-10
 *
 * GET /api/md-collections/[id]/highlights - 获取文档的所有高亮
 * POST /api/md-collections/[id]/highlights - 创建新高亮
 */

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

// ============================================
// 常量
// ============================================

const TABLE_NAME = "md_collection_highlights";

const MESSAGES = {
  NOT_FOUND: "文档不存在",
  HIGHLIGHT_NOT_FOUND: "高亮不存在",
  CREATE_SUCCESS: "高亮创建成功",
  CREATE_ERROR: "创建高亮失败",
  LOAD_ERROR: "加载高亮失败",
};

// ============================================
// 验证 Schema
// ============================================

const createHighlightSchema = z.object({
  start_offset: z.number().int().nonnegative(),
  end_offset: z.number().int().positive(),
  anchor_text: z.string().min(1).max(200),
  color: z.enum(["yellow", "green", "blue", "pink", "purple"]),
});

// ============================================
// GET /api/md-collections/[id]/highlights
// ============================================

export const GET = withAuthMiddleware<{ id: string }>(
  async (request, { userId, params }) => {
    try {
      const { id } = await params;
      const collectionId = parseInt(id);

      if (isNaN(collectionId)) {
        return notFoundError(MESSAGES.NOT_FOUND);
      }

      const supabase = await createClient();

      // 1. 验证文档存在且属于当前用户
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
          return notFoundError(MESSAGES.NOT_FOUND);
        }
        return databaseError(MESSAGES.LOAD_ERROR, collectionError);
      }

      if (!collection || collection.user_id !== userId) {
        return forbiddenError(AUTH.FORBIDDEN);
      }

      // 2. 获取高亮列表（使用类型断言绕过类型检查）
      const { data: highlights, error: queryError } = await (
        supabase as unknown as {
          from: (table: string) => {
            select: (columns: string) => {
              eq: (
                column: string,
                value: number,
              ) => {
                order: (
                  column: string,
                  options: { ascending: boolean },
                ) => Promise<{
                  data: unknown[] | null;
                  error: { message: string; code?: string } | null;
                }>;
              };
            };
          };
        }
      )
        .from(TABLE_NAME)
        .select("*")
        .eq("collection_id", collectionId)
        .order("start_offset", { ascending: true });

      if (queryError) {
        return databaseError(MESSAGES.LOAD_ERROR, queryError);
      }

      return successResponse(highlights || []);
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          operation: "get_highlights",
        },
        "GET /api/md-collections/[id]/highlights error",
      );
      return internalError(MESSAGES.LOAD_ERROR);
    }
  },
);

// ============================================
// POST /api/md-collections/[id]/highlights
// ============================================

export const POST = withAuthMiddleware<{ id: string }>(
  async (request, { userId, params }) => {
    try {
      const { id } = await params;
      const collectionId = parseInt(id);

      if (isNaN(collectionId)) {
        return notFoundError(MESSAGES.NOT_FOUND);
      }

      const supabase = await createClient();

      // 1. 验证文档存在且属于当前用户
      type CollectionCheckRowPost = { id: number; user_id: string };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: collection, error: collectionError } = (await (
        supabase.from("md_collections") as any
      )
        .select("id, user_id")
        .eq("id", collectionId)
        .is("deleted_at", null)
        .single()) as {
        data: CollectionCheckRowPost | null;
        error: { code?: string; message: string } | null;
      };

      if (collectionError) {
        if (collectionError.code === "PGRST116") {
          return notFoundError(MESSAGES.NOT_FOUND);
        }
        return databaseError(MESSAGES.LOAD_ERROR, collectionError);
      }

      if (!collection || collection.user_id !== userId) {
        return forbiddenError(AUTH.FORBIDDEN);
      }

      // 2. 解析并验证请求体
      const body = await request.json();
      const validation = createHighlightSchema.safeParse(body);

      if (!validation.success) {
        return handleValidationError(validation.error);
      }

      const { start_offset, end_offset, anchor_text, color } = validation.data;

      // 3. 验证偏移范围
      if (end_offset <= start_offset) {
        return handleValidationError(
          new z.ZodError([
            {
              code: "custom",
              path: ["end_offset"],
              message: "结束偏移必须大于起始偏移",
            },
          ]),
        );
      }

      // 4. 创建高亮（使用类型断言绕过类型检查）
      const { data: highlight, error: insertError } = await (
        supabase as unknown as {
          from: (table: string) => {
            insert: (values: Record<string, unknown>) => {
              select: () => {
                single: () => Promise<{
                  data: unknown | null;
                  error: { message: string; code?: string } | null;
                }>;
              };
            };
          };
        }
      )
        .from(TABLE_NAME)
        .insert({
          collection_id: collectionId,
          user_id: userId,
          start_offset,
          end_offset,
          anchor_text,
          color,
        })
        .select()
        .single();

      if (insertError) {
        return databaseError(MESSAGES.CREATE_ERROR, insertError);
      }

      logger.info(
        {
          userId,
          collectionId,
          highlightId: (highlight as { id: string }).id,
          action: "highlight_created",
        },
        "Highlight created",
      );

      return successResponse(highlight, 201);
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          operation: "create_highlight",
        },
        "POST /api/md-collections/[id]/highlights error",
      );
      return internalError(MESSAGES.CREATE_ERROR);
    }
  },
);
