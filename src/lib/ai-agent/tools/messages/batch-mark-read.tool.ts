/**
 * batch_mark_read Tool
 *
 * 批量标记消息为已读，支持多种筛选方式
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { MESSAGE_TYPES, MESSAGE_LEVELS } from "@/lib/messages/types";

// ============================================
// 参数定义
// ============================================

const paramsSchema = z.object({
  messageIds: z
    .array(z.number().int().positive())
    .optional()
    .describe("指定消息 ID 列表（不传则根据其他条件筛选）"),
  types: z.array(z.enum(MESSAGE_TYPES)).optional().describe("按消息类型筛选"),
  levels: z.array(z.enum(MESSAGE_LEVELS)).optional().describe("按消息级别筛选"),
  olderThanDays: z
    .number()
    .int()
    .min(1)
    .max(365)
    .optional()
    .describe("标记 N 天前的消息为已读"),
  markAll: z
    .boolean()
    .optional()
    .default(false)
    .describe("标记所有未读消息为已读（谨慎使用）"),
});

type BatchMarkReadParams = z.infer<typeof paramsSchema>;

// ============================================
// 结果类型
// ============================================

interface BatchMarkReadResult {
  /** 成功标记的数量 */
  markedCount: number;
  /** 操作前未读数 */
  previousUnreadCount: number;
  /** 操作后未读数 */
  remainingUnreadCount: number;
  /** 操作描述 */
  description: string;
}

// ============================================
// Tool 实现
// ============================================

export const batchMarkReadTool: Tool<BatchMarkReadParams, BatchMarkReadResult> =
  {
    definition: {
      name: "batch_mark_read",
      description: `批量标记消息为已读。

功能：
- 标记指定 ID 的消息
- 按类型批量标记（如所有"自动分类"消息）
- 按级别批量标记（如所有"静默通知"）
- 按时间批量标记（如 7 天前的消息）
- 一键全部已读

使用场景：
- "把所有消息标记已读"
- "把静默通知都标为已读"
- "清理一周前的消息"
- "把分类相关的消息标为已读"

返回：标记数量、剩余未读数`,
      parameters: paramsSchema,
      category: "action",
      requiresConfirmation: false, // 标记已读是低风险操作
      estimatedDurationMs: 500,
    },

    async execute(
      params: BatchMarkReadParams,
      context: ToolContext,
    ): Promise<ToolResult<BatchMarkReadResult>> {
      const startTime = performance.now();
      const supabase = await createClient();

      const { messageIds, types, levels, olderThanDays, markAll } = params;

      // 获取操作前的未读数
      const { count: previousUnreadCount } = await supabase
        .from("user_notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId)
        .eq("status", "unread");

      // 如果指定了 messageIds，直接使用 RPC
      if (messageIds && messageIds.length > 0) {
        const { data: updatedCount, error } = await supabase.rpc(
          "mark_notifications_read",
          {
            p_user_id: context.userId,
            p_ids: messageIds.map(String),
          },
        );

        if (error) {
          logger.error(
            {
              toolName: "batch_mark_read",
              userId: context.userId,
              messageIds,
              error: error.message,
            },
            "batch_mark_read: DB Error",
          );

          return {
            success: false,
            error: error.message,
            errorCode: "DB_ERROR",
          };
        }

        // 获取操作后的未读数
        const { count: remainingUnreadCount } = await supabase
          .from("user_notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", context.userId)
          .eq("status", "unread");

        const markedCount = updatedCount ?? 0;

        logger.info(
          {
            toolName: "batch_mark_read",
            userId: context.userId,
            messageIds,
            markedCount,
            executionTimeMs: Math.round(performance.now() - startTime),
          },
          "batch_mark_read: Success (by IDs)",
        );

        return {
          success: true,
          data: {
            markedCount,
            previousUnreadCount: (previousUnreadCount ?? 0) as number,
            remainingUnreadCount: (remainingUnreadCount ?? 0) as number,
            description: `已标记 ${markedCount} 条指定消息为已读`,
          },
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
            affectedCount: markedCount,
          },
        };
      }

      // 如果是 markAll，调用 RPC 不传 messageIds
      if (markAll) {
        const { data: updatedCount, error } = await supabase.rpc(
          "mark_all_notifications_read",
          {
            p_user_id: context.userId,
          },
        );

        if (error) {
          logger.error(
            {
              toolName: "batch_mark_read",
              userId: context.userId,
              markAll,
              error: error.message,
            },
            "batch_mark_read: DB Error",
          );

          return {
            success: false,
            error: error.message,
            errorCode: "DB_ERROR",
          };
        }

        const markedCount = updatedCount ?? 0;

        logger.info(
          {
            toolName: "batch_mark_read",
            userId: context.userId,
            markAll,
            markedCount,
            executionTimeMs: Math.round(performance.now() - startTime),
          },
          "batch_mark_read: Success (all)",
        );

        return {
          success: true,
          data: {
            markedCount,
            previousUnreadCount: (previousUnreadCount ?? 0) as number,
            remainingUnreadCount: 0,
            description: `已标记所有 ${markedCount} 条消息为已读`,
          },
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
            affectedCount: markedCount,
          },
        };
      }

      // 按条件筛选消息 ID，然后调用 RPC
      let query = supabase
        .from("user_notifications")
        .select("id")
        .eq("user_id", context.userId)
        .eq("status", "unread");

      // 类型筛选 (type_code 使用新的通知类型编码)
      if (types && types.length > 0) {
        query = query.in("type_code", types);
      }

      // 级别筛选 (priority 替代 level)
      if (levels && levels.length > 0) {
        query = query.in("priority", levels);
      }

      // 时间筛选
      if (olderThanDays) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
        query = query.lt("created_at", cutoffDate.toISOString());
      }

      const { data: messagesToMark, error: selectError } = await query;

      if (selectError) {
        logger.error(
          {
            toolName: "batch_mark_read",
            userId: context.userId,
            params,
            error: selectError.message,
          },
          "batch_mark_read: Select Error",
        );

        return {
          success: false,
          error: selectError.message,
          errorCode: "DB_ERROR",
        };
      }

      if (!messagesToMark || messagesToMark.length === 0) {
        return {
          success: true,
          data: {
            markedCount: 0,
            previousUnreadCount: previousUnreadCount ?? 0,
            remainingUnreadCount: previousUnreadCount ?? 0,
            description: "没有符合条件的未读消息",
          },
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
            affectedCount: 0,
          },
        };
      }

      const idsToMark = messagesToMark.map((m) => m.id);

      const { data: updatedCount, error: updateError } = await supabase.rpc(
        "mark_notifications_read",
        {
          p_user_id: context.userId,
          p_ids: idsToMark,
        },
      );

      if (updateError) {
        logger.error(
          {
            toolName: "batch_mark_read",
            userId: context.userId,
            idsCount: idsToMark.length,
            error: updateError.message,
          },
          "batch_mark_read: Update Error",
        );

        return {
          success: false,
          error: updateError.message,
          errorCode: "DB_ERROR",
        };
      }

      // 获取操作后的未读数
      const { count: remainingUnreadCount } = await supabase
        .from("user_notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId)
        .eq("status", "unread");

      const markedCount = updatedCount ?? 0;

      // 生成描述
      const descParts: string[] = [];
      if (types && types.length > 0) {
        descParts.push(`${types.length} 种类型`);
      }
      if (levels && levels.length > 0) {
        descParts.push(`${levels.join("/")} 级别`);
      }
      if (olderThanDays) {
        descParts.push(`${olderThanDays} 天前`);
      }

      const filterDesc =
        descParts.length > 0 ? `（${descParts.join("，")}）` : "";
      const description = `已标记 ${markedCount} 条消息为已读${filterDesc}`;

      logger.info(
        {
          toolName: "batch_mark_read",
          userId: context.userId,
          types,
          levels,
          olderThanDays,
          markedCount,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "batch_mark_read: Success (filtered)",
      );

      return {
        success: true,
        data: {
          markedCount,
          previousUnreadCount: (previousUnreadCount ?? 0) as number,
          remainingUnreadCount: (remainingUnreadCount ?? 0) as number,
          description,
        },
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
          affectedCount: markedCount,
        },
      };
    },
  };
