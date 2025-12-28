/**
 * get_wechat_article_stats Tool
 *
 * 获取用户的微信文章统计概览
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";
import { withReasoning, extractReasoning } from "../types";
import { logger } from "@/lib/logger";
import { wechatArticleService } from "@/lib/wechat-article/wechat-article.service";
import type { WechatArticleStatsResult } from "./types";
import { formatStorageSize } from "./types";

// ============================================
// 参数 Schema
// ============================================

const baseParamsSchema = z.object({
  // 无必填参数
});

const paramsSchema = withReasoning(baseParamsSchema);

type GetWechatArticleStatsParams = z.input<typeof paramsSchema>;

// ============================================
// Tool 实现
// ============================================

export const getWechatArticleStatsTool: Tool<
  GetWechatArticleStatsParams,
  WechatArticleStatsResult
> = {
  definition: {
    name: "get_wechat_article_stats",
    description: `获取用户的微信文章统计概览。

返回信息：
- 总文章数
- 图片统计（总数、成功持久化、失败）
- 存储空间使用情况
- 图片持久化成功率

使用场景：
- "我的微信文章统计"
- "微信文章占用多少存储"
- "图片保存成功率多少"
- "有多少微信文章"`,
    parameters: paramsSchema,
    category: "query",
    requiresConfirmation: false,
    estimatedDurationMs: 200,
  },

  async execute(
    params: GetWechatArticleStatsParams,
    context: ToolContext,
  ): Promise<ToolResult<WechatArticleStatsResult>> {
    const startTime = performance.now();
    const reasoning = extractReasoning(params);

    try {
      const stats = await wechatArticleService.getUserStats(context.userId);

      // 计算图片成功率
      const imageSuccessRate =
        stats.totalImages > 0
          ? `${Math.round((stats.successImages / stats.totalImages) * 100)}%`
          : "N/A";

      // 格式化存储空间
      const storageUsedFormatted = formatStorageSize(stats.storageUsed);

      // 生成友好消息
      let message: string;
      if (stats.totalArticles === 0) {
        message = "您还没有收藏微信公众号文章";
      } else {
        message = `共收藏 ${stats.totalArticles} 篇微信文章`;
        if (stats.totalImages > 0) {
          message += `，包含 ${stats.totalImages} 张图片`;
          if (stats.successImages > 0) {
            message += `（${stats.successImages} 张已持久化）`;
          }
        }
        if (stats.storageUsed > 0) {
          message += `。存储空间使用：${storageUsedFormatted}`;
        }
      }

      const executionTimeMs = Math.round(performance.now() - startTime);

      logger.info(
        {
          toolName: "get_wechat_article_stats",
          userId: context.userId,
          stats,
          executionTimeMs,
          reasoning,
        },
        "get_wechat_article_stats: Success",
      );

      return {
        success: true,
        data: {
          totalArticles: stats.totalArticles,
          totalImages: stats.totalImages,
          successImages: stats.successImages,
          failedImages: stats.failedImages,
          storageUsed: stats.storageUsed,
          storageUsedFormatted,
          imageSuccessRate,
          message,
        },
        metadata: {
          executionTimeMs,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const executionTimeMs = Math.round(performance.now() - startTime);

      logger.error(
        {
          toolName: "get_wechat_article_stats",
          userId: context.userId,
          error: errorMessage,
          executionTimeMs,
        },
        "get_wechat_article_stats: Failed",
      );

      return {
        success: false,
        error: "获取微信文章统计失败，请稍后重试",
        errorCode: "EXECUTION_ERROR",
        metadata: {
          executionTimeMs,
        },
      };
    }
  },
};
