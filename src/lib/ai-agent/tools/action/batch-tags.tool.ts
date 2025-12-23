/**
 * batch_tags Tool
 *
 * 批量为书签添加或移除标签
 * 这是一个需要用户确认的危险操作
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { z } from "zod";
import type {
  Tool,
  ToolContext,
  ToolResult,
  PendingConfirmation,
} from "../types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// ============================================
// 参数和结果类型定义
// ============================================

const paramsSchema = z.object({
  action: z
    .enum(["add", "remove"])
    .describe("操作类型：add-添加标签，remove-移除标签"),
  bookmark_ids: z
    .array(z.number().int().positive())
    .min(1, "至少选择一个书签")
    .max(200, "单次最多操作200个书签")
    .describe("要操作的书签 ID 列表"),
  tags: z
    .array(z.string().min(1).max(50))
    .min(1, "至少提供一个标签")
    .max(20, "单次最多操作20个标签")
    .describe("要添加或移除的标签列表"),
});

type BatchTagsParams = z.infer<typeof paramsSchema>;

interface BatchTagsResult {
  action: "add" | "remove";
  affectedCount: number;
  affectedIds: number[];
  tags: string[];
  message: string;
  /** 待确认操作（仅在需要确认时存在） */
  __pendingConfirmation?: PendingConfirmation;
}

// ============================================
// 辅助函数
// ============================================

/**
 * 生成确认 ID
 */
function generateConfirmationId(): string {
  return `confirm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 获取书签标题列表（用于确认对话框显示）
 */
async function getBookmarkTitles(
  userId: string,
  bookmarkIds: number[],
): Promise<Array<{ id: number; title: string }>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bookmarks")
    .select("id, title")
    .in("id", bookmarkIds)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .limit(10); // 只获取前10个用于预览

  if (error || !data) {
    return [];
  }

  return data.map((b) => ({ id: b.id, title: b.title }));
}

// ============================================
// Tool 实现
// ============================================

export const batchTagsTool: Tool<BatchTagsParams, BatchTagsResult> = {
  definition: {
    name: "batch_tags",
    description: `批量为书签添加或移除标签。

使用场景：
- 用户要求 "给这些书签加上 AI 标签"
- 用户要求 "把这5个书签都标记为技术文章"
- 用户要求 "移除这些书签的过时标签"

注意事项：
- 这是一个批量修改操作，会影响多个书签
- 操作不可逆，请谨慎使用
- 单次最多操作200个书签和20个标签`,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: true,
    estimatedDurationMs: 1000,
  },

  async execute(
    params: BatchTagsParams,
    context: ToolContext,
  ): Promise<ToolResult<BatchTagsResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 1. 验证书签所有权
      const { count: ownedCount, error: ownershipError } = await supabase
        .from("bookmarks")
        .select("id", { count: "exact", head: true })
        .in("id", params.bookmark_ids)
        .eq("user_id", context.userId)
        .is("deleted_at", null);

      if (ownershipError) {
        throw ownershipError;
      }

      if (ownedCount !== params.bookmark_ids.length) {
        return {
          success: false,
          error: `部分书签不存在或无权操作（请求 ${params.bookmark_ids.length} 个，有效 ${ownedCount} 个）`,
          errorCode: "UNAUTHORIZED",
        };
      }

      // 2. 如果需要确认且未确认，返回确认请求
      if (!context.confirmed) {
        const affectedItems = await getBookmarkTitles(
          context.userId,
          params.bookmark_ids,
        );

        const actionText = params.action === "add" ? "添加" : "移除";
        const confirmation: PendingConfirmation = {
          confirmationId: generateConfirmationId(),
          toolName: "batch_tags",
          description: `${actionText}标签：${params.tags.join(", ")}`,
          impactSummary: `将为 ${params.bookmark_ids.length} 个书签${actionText} ${params.tags.length} 个标签`,
          affectedItems,
          params,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5分钟过期
          riskLevel: params.bookmark_ids.length > 50 ? "high" : "medium",
        };

        logger.info(
          {
            toolName: "batch_tags",
            userId: context.userId,
            action: params.action,
            bookmarkCount: params.bookmark_ids.length,
            tagCount: params.tags.length,
            confirmationId: confirmation.confirmationId,
          },
          "batch_tags: Confirmation required",
        );

        // 返回带确认信息的结果（LLM 会看到 message，前端会检测 __pendingConfirmation）
        return {
          success: true,
          data: {
            action: params.action,
            affectedCount: 0,
            affectedIds: [],
            tags: params.tags,
            message: `待用户确认：${confirmation.impactSummary}。界面上已显示确认对话框，用户点击"确认执行"按钮后将自动执行操作，你无需再次询问。`,
            __pendingConfirmation: confirmation,
          },
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
          },
        };
      }

      // 3. 已确认，执行操作
      const uniqueTags = [...new Set(params.tags.map((t) => t.trim()))];

      let result: { affected_ids: number[]; affected_count: number };

      if (params.action === "add") {
        const { data, error } = await supabase.rpc("batch_add_tags", {
          p_bookmark_ids: params.bookmark_ids,
          p_tags: uniqueTags,
        });
        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await supabase.rpc("batch_remove_tags", {
          p_bookmark_ids: params.bookmark_ids,
          p_tags: uniqueTags,
        });
        if (error) throw error;
        result = data;
      }

      const actionText = params.action === "add" ? "添加" : "移除";
      const message = `已为 ${result.affected_count} 个书签${actionText} ${uniqueTags.length} 个标签`;

      logger.info(
        {
          toolName: "batch_tags",
          userId: context.userId,
          action: params.action,
          bookmarkCount: params.bookmark_ids.length,
          tagCount: uniqueTags.length,
          affectedCount: result.affected_count,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "batch_tags: Success",
      );

      return {
        success: true,
        data: {
          action: params.action,
          affectedCount: result.affected_count,
          affectedIds: result.affected_ids || [],
          tags: uniqueTags,
          message,
        },
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
          affectedCount: result.affected_count,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(
        {
          toolName: "batch_tags",
          userId: context.userId,
          action: params.action,
          error: errorMessage,
        },
        "batch_tags: Failed",
      );

      return {
        success: false,
        error: `批量标签操作失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
