/**
 * ToggleMdStarred Tool - 切换 MD 收藏星标状态
 *
 * 为 MD 收藏添加或取消星标
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { z } from "zod";
import type { Tool, ToolResult } from "../types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// ============================================
// 参数和结果类型定义
// ============================================

const paramsSchema = z.object({
  collectionId: z.number().int().positive().describe("MD 收藏 ID"),
  isStarred: z.boolean().optional().describe("目标状态，不传则切换"),
});

type ToggleMdStarredParams = z.infer<typeof paramsSchema>;

interface ToggleMdStarredResult {
  collectionId: number;
  title: string;
  isStarred: boolean;
  message: string;
}

// ============================================
// Tool 实现
// ============================================

export const toggleMdStarredTool: Tool<
  ToggleMdStarredParams,
  ToggleMdStarredResult
> = {
  definition: {
    name: "toggle_md_starred",
    description: `为 MD 收藏添加或取消星标。

使用场景：
- 用户要求 "给这篇文章加星标"
- 用户要求 "取消星标"
- 用户要求 "标记这个为重要"
- 用户要求 "收藏这篇文档"

参数说明：
- collectionId: MD 收藏 ID
- isStarred: 目标状态（不传则切换当前状态）`,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: false,
    estimatedDurationMs: 150,
  },

  async execute(
    params: ToggleMdStarredParams,
    context,
  ): Promise<ToolResult<ToggleMdStarredResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 1. 获取当前状态
      const { data: collection, error: fetchError } = await supabase
        .from("md_collections")
        .select("id, title, is_starred")
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

      // 2. 确定新状态
      const newIsStarred = params.isStarred ?? !collection.is_starred;

      // 如果状态相同，直接返回
      if (newIsStarred === collection.is_starred) {
        return {
          success: true,
          data: {
            collectionId: collection.id,
            title: collection.title || "未命名文档",
            isStarred: collection.is_starred,
            message: collection.is_starred
              ? "已经是星标状态"
              : "已经是非星标状态",
          },
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
          },
        };
      }

      // 3. 更新状态
      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("md_collections")
        .update({
          is_starred: newIsStarred,
          starred_at: newIsStarred ? now : null,
          updated_at: now,
        })
        .eq("id", params.collectionId)
        .eq("user_id", context.userId);

      if (updateError) {
        throw updateError;
      }

      logger.info(
        {
          toolName: "toggle_md_starred",
          userId: context.userId,
          collectionId: params.collectionId,
          isStarred: newIsStarred,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "toggle_md_starred: Success",
      );

      return {
        success: true,
        data: {
          collectionId: collection.id,
          title: collection.title || "未命名文档",
          isStarred: newIsStarred,
          message: newIsStarred ? "已添加星标" : "已取消星标",
        },
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(
        {
          toolName: "toggle_md_starred",
          userId: context.userId,
          collectionId: params.collectionId,
          error: errorMessage,
        },
        "toggle_md_starred: Failed",
      );

      return {
        success: false,
        error: `切换星标状态失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
