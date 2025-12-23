/**
 * BatchDeleteBookmarks Tool - 批量删除书签
 *
 * 批量删除多个书签
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { z } from "zod";
import type { Tool, ToolResult, PendingConfirmation } from "../types";
import {
  generateConfirmationId,
  getConfirmationExpiryTime,
  determineRiskLevel,
} from "../utils";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// ============================================
// 参数和结果类型定义
// ============================================

const paramsSchema = z.object({
  bookmarkIds: z
    .array(z.number().int().positive())
    .min(1)
    .max(100)
    .describe("要删除的书签 ID 列表，最多 100 个"),
  permanent: z
    .boolean()
    .optional()
    .default(false)
    .describe("是否永久删除：true-跳过回收站，false-移动到回收站（默认）"),
});

type BatchDeleteBookmarksParams = z.infer<typeof paramsSchema>;

interface BatchDeleteBookmarksResult {
  deletedCount: number;
  failedCount: number;
  failedIds: number[];
  permanent: boolean;
  message: string;
  /** 待确认操作（仅在需要确认时存在） */
  __pendingConfirmation?: PendingConfirmation;
}

// ============================================
// Tool 实现
// ============================================

export const batchDeleteBookmarksTool: Tool<
  BatchDeleteBookmarksParams,
  BatchDeleteBookmarksResult
> = {
  definition: {
    name: "batch_delete_bookmarks",
    description: `批量删除多个书签。

使用场景：
- 用户要求 "删除这些书签"
- 用户要求 "批量清理这些收藏"
- 用户要求 "永久删除选中的书签"

注意事项：
- 默认为软删除，书签会移动到回收站
- 设置 permanent=true 可永久删除，无法恢复
- 最多一次删除 100 个书签
- 这是危险操作，需要用户确认`,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: true,
    estimatedDurationMs: 300,
  },

  async execute(
    params: BatchDeleteBookmarksParams,
    context,
  ): Promise<ToolResult<BatchDeleteBookmarksResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 1. 获取书签信息并验证所有权
      const { data: bookmarks, error: fetchError } = await supabase
        .from("bookmarks")
        .select("id, title")
        .in("id", params.bookmarkIds)
        .eq("user_id", context.userId)
        .is("deleted_at", null);

      if (fetchError) {
        throw fetchError;
      }

      const validBookmarks = bookmarks || [];
      const validIds = validBookmarks.map((b) => b.id);
      const invalidIds = params.bookmarkIds.filter(
        (id) => !validIds.includes(id),
      );

      if (validBookmarks.length === 0) {
        return {
          success: false,
          error: "没有找到可删除的书签",
          errorCode: "NOT_FOUND",
        };
      }

      const actionText = params.permanent ? "永久删除" : "删除";

      // 2. 如果需要确认且未确认，返回确认请求
      if (!context.confirmed) {
        const riskLevel = determineRiskLevel(validBookmarks.length);
        const description = `${actionText} ${validBookmarks.length} 个书签`;
        const impactSummary = params.permanent
          ? `将永久删除 ${validBookmarks.length} 个书签，此操作无法撤销`
          : `将把 ${validBookmarks.length} 个书签移动到回收站`;

        const confirmation: PendingConfirmation = {
          confirmationId: generateConfirmationId(),
          toolName: "batch_delete_bookmarks",
          description,
          impactSummary,
          affectedItems: validBookmarks.map((b) => ({
            id: b.id,
            title: b.title,
          })),
          params,
          expiresAt: getConfirmationExpiryTime(),
          riskLevel,
        };

        logger.info(
          {
            toolName: "batch_delete_bookmarks",
            userId: context.userId,
            count: validBookmarks.length,
            permanent: params.permanent,
            confirmationId: confirmation.confirmationId,
          },
          "batch_delete_bookmarks: Confirmation required",
        );

        return {
          success: true,
          data: {
            deletedCount: 0,
            failedCount: invalidIds.length,
            failedIds: invalidIds,
            permanent: params.permanent ?? false,
            message: `待用户确认：${impactSummary}。界面上已显示确认对话框，用户点击"确认执行"按钮后将自动执行操作，你无需再次询问。`,
            __pendingConfirmation: confirmation,
          },
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
          },
        };
      }

      // 3. 已确认，执行批量删除
      const now = new Date().toISOString();
      let deletedCount = 0;

      if (params.permanent) {
        // 永久删除
        const { error: deleteError, count } = await supabase
          .from("bookmarks")
          .delete()
          .in("id", validIds)
          .eq("user_id", context.userId);

        if (deleteError) {
          throw deleteError;
        }
        deletedCount = count || validIds.length;
      } else {
        // 软删除
        const { error: updateError, count } = await supabase
          .from("bookmarks")
          .update({ deleted_at: now, updated_at: now })
          .in("id", validIds)
          .eq("user_id", context.userId);

        if (updateError) {
          throw updateError;
        }
        deletedCount = count || validIds.length;
      }

      logger.info(
        {
          toolName: "batch_delete_bookmarks",
          userId: context.userId,
          deletedCount,
          permanent: params.permanent,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "batch_delete_bookmarks: Success",
      );

      const message = params.permanent
        ? `已永久删除 ${deletedCount} 个书签`
        : `已将 ${deletedCount} 个书签移动到回收站`;

      return {
        success: true,
        data: {
          deletedCount,
          failedCount: invalidIds.length,
          failedIds: invalidIds,
          permanent: params.permanent ?? false,
          message:
            invalidIds.length > 0
              ? `${message}，${invalidIds.length} 个书签未找到`
              : message,
        },
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
          affectedCount: deletedCount,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(
        {
          toolName: "batch_delete_bookmarks",
          userId: context.userId,
          count: params.bookmarkIds.length,
          error: errorMessage,
        },
        "batch_delete_bookmarks: Failed",
      );

      return {
        success: false,
        error: `批量删除书签失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
