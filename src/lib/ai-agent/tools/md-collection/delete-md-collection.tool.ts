/**
 * DeleteMdCollection Tool - 删除 MD 收藏
 *
 * 删除 MD 收藏（需要确认）
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
  collectionId: z.number().int().positive().describe("MD 收藏 ID"),
  permanent: z
    .boolean()
    .optional()
    .default(false)
    .describe("是否永久删除（默认软删除）"),
});

type DeleteMdCollectionParams = z.infer<typeof paramsSchema>;

interface DeleteMdCollectionResult {
  collectionId: number;
  title: string;
  deleted: boolean;
  permanent: boolean;
  message: string;
  /** 待确认操作（仅在需要确认时存在） */
  __pendingConfirmation?: PendingConfirmation;
}

// ============================================
// Tool 实现
// ============================================

export const deleteMdCollectionTool: Tool<
  DeleteMdCollectionParams,
  DeleteMdCollectionResult
> = {
  definition: {
    name: "delete_md_collection",
    description: `删除 MD 收藏。

使用场景：
- 用户要求 "删除这篇文档"
- 用户要求 "移除这个 MD 收藏"
- 用户要求 "永久删除这篇文章"

参数说明：
- collectionId: MD 收藏 ID
- permanent: 是否永久删除（默认为软删除，可恢复）

注意事项：
- 默认为软删除，可在回收站恢复
- 永久删除无法恢复
- 这是危险操作，需要用户确认`,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: true,
    estimatedDurationMs: 200,
  },

  async execute(
    params: DeleteMdCollectionParams,
    context,
  ): Promise<ToolResult<DeleteMdCollectionResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 1. 获取收藏信息
      const { data: collection, error: fetchError } = await supabase
        .from("md_collections")
        .select("id, title")
        .eq("id", params.collectionId)
        .eq("user_id", context.userId)
        .single();

      if (fetchError || !collection) {
        return {
          success: false,
          error: "MD 收藏不存在或无权访问",
          errorCode: "NOT_FOUND",
        };
      }

      const title = collection.title || "未命名文档";
      const actionText = params.permanent ? "永久删除" : "删除";

      // 2. 如果需要确认且未确认，返回确认请求
      if (!context.confirmed) {
        const description = `${actionText}「${title}」`;
        const impactSummary = params.permanent
          ? "永久删除后无法恢复"
          : "删除后可在回收站恢复";

        const confirmation: PendingConfirmation = {
          confirmationId: generateConfirmationId(),
          toolName: "delete_md_collection",
          description,
          impactSummary,
          affectedItems: [{ id: collection.id, title }],
          params,
          expiresAt: getConfirmationExpiryTime(),
          riskLevel: params.permanent ? "high" : "medium",
        };

        logger.info(
          {
            toolName: "delete_md_collection",
            userId: context.userId,
            collectionId: params.collectionId,
            permanent: params.permanent,
            confirmationId: confirmation.confirmationId,
          },
          "delete_md_collection: Confirmation required",
        );

        return {
          success: true,
          data: {
            collectionId: collection.id,
            title,
            deleted: false,
            permanent: params.permanent ?? false,
            message: `待用户确认：${impactSummary}。界面上已显示确认对话框，用户点击"确认执行"按钮后将自动执行操作，你无需再次询问。`,
            __pendingConfirmation: confirmation,
          },
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
          },
        };
      }

      // 3. 已确认，执行删除
      if (params.permanent) {
        // 永久删除
        const { error: deleteError } = await supabase
          .from("md_collections")
          .delete()
          .eq("id", params.collectionId)
          .eq("user_id", context.userId);

        if (deleteError) {
          throw deleteError;
        }
      } else {
        // 软删除
        const { error: updateError } = await supabase
          .from("md_collections")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", params.collectionId)
          .eq("user_id", context.userId);

        if (updateError) {
          throw updateError;
        }
      }

      logger.info(
        {
          toolName: "delete_md_collection",
          userId: context.userId,
          collectionId: params.collectionId,
          permanent: params.permanent,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "delete_md_collection: Success",
      );

      const message = params.permanent
        ? `已永久删除「${title}」`
        : `已删除「${title}」，可在回收站恢复`;

      return {
        success: true,
        data: {
          collectionId: collection.id,
          title,
          deleted: true,
          permanent: params.permanent ?? false,
          message,
        },
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
          affectedCount: 1,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(
        {
          toolName: "delete_md_collection",
          userId: context.userId,
          collectionId: params.collectionId,
          error: errorMessage,
        },
        "delete_md_collection: Failed",
      );

      return {
        success: false,
        error: `删除 MD 收藏失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
