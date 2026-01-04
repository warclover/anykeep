/**
 * GetMdStats Tool - 获取 MD 收藏统计
 *
 * 获取用户 MD 收藏的统计数据
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

const paramsSchema = z.object({});

type GetMdStatsParams = z.infer<typeof paramsSchema>;

interface MdStatsResult {
  total: number;
  read: number;
  unread: number;
  starred: number;
  byContentType: Record<string, number>;
  byProcessStatus: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
  recentWeekCount: number;
  message: string;
}

// ============================================
// Tool 实现
// ============================================

export const getMdStatsTool: Tool<GetMdStatsParams, MdStatsResult> = {
  definition: {
    name: "get_md_stats",
    description: `获取用户 MD 收藏的统计数据。

使用场景：
- 用户要求 "我的 MD 收藏有多少"
- 用户要求 "显示文档统计信息"
- 用户要求 "有多少未读文档"
- AI 需要了解用户 MD 收藏概况时

返回信息：
- total: 总数
- read/unread: 已读/未读数量
- starred: 星标数量
- byContentType: 按内容类型分类统计
- byProcessStatus: 按处理状态分类统计
- recentWeekCount: 最近一周新增数量`,
    parameters: paramsSchema,
    category: "query",
    requiresConfirmation: false,
    estimatedDurationMs: 200,
  },

  async execute(
    _params: GetMdStatsParams,
    context,
  ): Promise<ToolResult<MdStatsResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 1. 获取基础统计
      const { data: collections, error: fetchError } = await supabase
        .from("md_collections")
        .select(
          "id, is_read, is_starred, content_type, processing_status, created_at",
        )
        .eq("user_id", context.userId)
        .is("deleted_at", null);

      if (fetchError) {
        throw fetchError;
      }

      const items = collections || [];
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      // 2. 计算统计数据
      let readCount = 0;
      let unreadCount = 0;
      let starredCount = 0;
      let recentWeekCount = 0;
      const contentTypeStats: Record<string, number> = {};
      const processStatusStats = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
      };

      for (const item of items) {
        // 已读/未读
        if (item.is_read) {
          readCount++;
        } else {
          unreadCount++;
        }

        // 星标
        if (item.is_starred) {
          starredCount++;
        }

        // 内容类型
        const contentType = item.content_type || "other";
        contentTypeStats[contentType] =
          (contentTypeStats[contentType] || 0) + 1;

        // 处理状态
        const status = item.processing_status || "pending";
        if (status in processStatusStats) {
          processStatusStats[status as keyof typeof processStatusStats]++;
        }

        // 最近一周
        if (item.created_at && new Date(item.created_at) > oneWeekAgo) {
          recentWeekCount++;
        }
      }

      logger.info(
        {
          toolName: "get_md_stats",
          userId: context.userId,
          total: items.length,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "get_md_stats: Success",
      );

      return {
        success: true,
        data: {
          total: items.length,
          read: readCount,
          unread: unreadCount,
          starred: starredCount,
          byContentType: contentTypeStats,
          byProcessStatus: processStatusStats,
          recentWeekCount,
          message: `共 ${items.length} 篇 MD 收藏，${unreadCount} 篇未读，${starredCount} 篇星标`,
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
          toolName: "get_md_stats",
          userId: context.userId,
          error: errorMessage,
        },
        "get_md_stats: Failed",
      );

      return {
        success: false,
        error: `获取 MD 统计失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
