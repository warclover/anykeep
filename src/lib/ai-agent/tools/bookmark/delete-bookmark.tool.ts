/**
 * DeleteBookmark Tool - 删除书签
 *
 * 删除单个书签，默认软删除（移动到回收站），支持永久删除
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { z } from "zod";
import type { Tool, ToolResult, PendingConfirmation } from "../types";
import { generateConfirmationId, getConfirmationExpiryTime } from "../utils";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// ============================================
// 参数和结果类型定义
// ============================================

const paramsSchema = z.object({
  bookmarkId: z.number().int().positive().describe("要删除的书签 ID"),
  permanent: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "是否永久删除：true-跳过回收站永久删除，false-移动到回收站（默认）",
    ),
});

type DeleteBookmarkParams = z.infer<typeof paramsSchema>;

interface DeleteBookmarkResult {
  bookmarkId: number;
  bookmarkTitle: string;
  permanent: boolean;
  message: string;
  deletedAt?: string;
  /** 待确认操作（仅在需要确认时存在） */
  __pendingConfirmation?: PendingConfirmation;
}

// ============================================
// Tool 实现
// ============================================

export const deleteBookmarkTool: Tool<
  DeleteBookmarkParams,
  DeleteBookmarkResult
> = {
  definition: {
    name: "delete_bookmark",
    description: `删除指定的书签。

使用场景：
- 用户要求 "删除这个书签"
- 用户要求 "把这个收藏删掉"
- 用户要求 "永久删除这个书签"

注意事项：
- 默认为软删除，书签会移动到回收站，30天后自动清理
- 设置 permanent=true 可永久删除，无法恢复
- 这是危险操作，需要用户确认`,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: true,
    estimatedDurationMs: 150,
  },

  async execute(
    params: DeleteBookmarkParams,
    context,
  ): Promise<ToolResult<DeleteBookmarkResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 1. 获取书签信息并验证所有权
      const { data: bookmark, error: fetchError } = await supabase
        .from("bookmarks")
        .select("id, title, url")
        .eq("id", params.bookmarkId)
        .eq("user_id", context.userId)
        .is("deleted_at", null)
        .single();

      if (fetchError || !bookmark) {
        return {
          success: false,
          error: "书签不存在或无权访问",
          errorCode: "NOT_FOUND",
        };
      }

      const actionText = params.permanent ? "永久删除" : "删除";

      // 2. 如果需要确认且未确认，返回确认请求
      if (!context.confirmed) {
        const description = `${actionText}书签「${bookmark.title}」`;
        const impactSummary = params.permanent
          ? `将永久删除书签「${bookmark.title}」，此操作无法撤销`
          : `将把书签「${bookmark.title}」移动到回收站`;

        const confirmation: PendingConfirmation = {
          confirmationId: generateConfirmationId(),
          toolName: "delete_bookmark",
          description,
          impactSummary,
          affectedItems: [{ id: bookmark.id, title: bookmark.title }],
          params,
          expiresAt: getConfirmationExpiryTime(),
          riskLevel: params.permanent ? "high" : "medium",
        };

        logger.info(
          {
            toolName: "delete_bookmark",
            userId: context.userId,
            bookmarkId: bookmark.id,
            permanent: params.permanent,
            confirmationId: confirmation.confirmationId,
          },
          "delete_bookmark: Confirmation required",
        );

        return {
          success: true,
          data: {
            bookmarkId: bookmark.id,
            bookmarkTitle: bookmark.title,
            permanent: params.permanent ?? false,
            message: `待用户确认：${impactSummary}。界面上已显示确认对话框，用户点击"确认执行"按钮后将自动执行操作，你无需再次询问。`,
            __pendingConfirmation: confirmation,
          },
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
          },
        };
      }

      // 3. 已确认，执行删除操作
      const now = new Date().toISOString();

      if (params.permanent) {
        // 永久删除
        const { error: deleteError } = await supabase
          .from("bookmarks")
          .delete()
          .eq("id", params.bookmarkId)
          .eq("user_id", context.userId);

        if (deleteError) {
          throw deleteError;
        }

        logger.info(
          {
            toolName: "delete_bookmark",
            userId: context.userId,
            bookmarkId: bookmark.id,
            permanent: true,
            executionTimeMs: Math.round(performance.now() - startTime),
          },
          "delete_bookmark: Permanently deleted",
        );

        return {
          success: true,
          data: {
            bookmarkId: bookmark.id,
            bookmarkTitle: bookmark.title,
            permanent: true,
            message: `已永久删除书签「${bookmark.title}」`,
            deletedAt: now,
          },
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
            affectedCount: 1,
          },
        };
      } else {
        // 软删除（移动到回收站）
        const { error: updateError } = await supabase
          .from("bookmarks")
          .update({
            deleted_at: now,
            updated_at: now,
          })
          .eq("id", params.bookmarkId)
          .eq("user_id", context.userId);

        if (updateError) {
          throw updateError;
        }

        logger.info(
          {
            toolName: "delete_bookmark",
            userId: context.userId,
            bookmarkId: bookmark.id,
            permanent: false,
            executionTimeMs: Math.round(performance.now() - startTime),
          },
          "delete_bookmark: Soft deleted",
        );

        return {
          success: true,
          data: {
            bookmarkId: bookmark.id,
            bookmarkTitle: bookmark.title,
            permanent: false,
            message: `已将书签「${bookmark.title}」移动到回收站`,
            deletedAt: now,
          },
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
            affectedCount: 1,
          },
        };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(
        {
          toolName: "delete_bookmark",
          userId: context.userId,
          bookmarkId: params.bookmarkId,
          error: errorMessage,
        },
        "delete_bookmark: Failed",
      );

      return {
        success: false,
        error: `删除书签失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
