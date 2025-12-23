/**
 * ToggleMdRead Tool - 切换 MD 收藏已读状态
 *
 * 标记或取消标记 MD 收藏为已读
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
  isRead: z.boolean().optional().describe("目标状态，不传则切换"),
});

type ToggleMdReadParams = z.infer<typeof paramsSchema>;

interface ToggleMdReadResult {
  collectionId: number;
  title: string;
  isRead: boolean;
  message: string;
}

// ============================================
// Tool 实现
// ============================================

export const toggleMdReadTool: Tool<ToggleMdReadParams, ToggleMdReadResult> = {
  definition: {
    name: "toggle_md_read",
    description: `标记或取消标记 MD 收藏为已读。

使用场景：
- 用户要求 "标记这篇文章为已读"
- 用户要求 "取消已读标记"
- 用户要求 "我读完这篇了"

参数说明：
- collectionId: MD 收藏 ID
- isRead: 目标状态（不传则切换当前状态）`,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: false,
    estimatedDurationMs: 150,
  },

  async execute(
    params: ToggleMdReadParams,
    context,
  ): Promise<ToolResult<ToggleMdReadResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 1. 获取当前状态
      const { data: collection, error: fetchError } = await supabase
        .from("md_collections")
        .select("id, title, is_read")
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
      const newIsRead = params.isRead ?? !collection.is_read;

      // 如果状态相同，直接返回
      if (newIsRead === collection.is_read) {
        return {
          success: true,
          data: {
            collectionId: collection.id,
            title: collection.title || "未命名文档",
            isRead: collection.is_read,
            message: collection.is_read ? "已经是已读状态" : "已经是未读状态",
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
          is_read: newIsRead,
          read_at: newIsRead ? now : null,
          updated_at: now,
        })
        .eq("id", params.collectionId)
        .eq("user_id", context.userId);

      if (updateError) {
        throw updateError;
      }

      logger.info(
        {
          toolName: "toggle_md_read",
          userId: context.userId,
          collectionId: params.collectionId,
          isRead: newIsRead,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "toggle_md_read: Success",
      );

      return {
        success: true,
        data: {
          collectionId: collection.id,
          title: collection.title || "未命名文档",
          isRead: newIsRead,
          message: newIsRead ? "已标记为已读" : "已取消已读标记",
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
          toolName: "toggle_md_read",
          userId: context.userId,
          collectionId: params.collectionId,
          error: errorMessage,
        },
        "toggle_md_read: Failed",
      );

      return {
        success: false,
        error: `切换已读状态失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
