/**
 * Summary Provider Statistics API
 *
 * GET /api/summary/stats/providers - 获取 Provider 使用详细统计
 *
 * @version 1.0.0
 * @since 2025-12-12
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  handleValidationError,
} from "@/lib/utils/api-response";
import { withAuthMiddleware } from "@/lib/api/middleware";
import {
  getQualityTrackerService,
  getSummaryConfigService,
} from "@/lib/summary";

/**
 * 时间范围 Schema
 */
const timeRangeSchema = z.object({
  /** 预设时间范围 */
  range: z.enum(["7d", "30d", "90d", "all"]).optional().default("30d"),
});

/**
 * 计算时间范围
 */
function getTimeRange(range: string): { start: Date; end: Date } | undefined {
  const now = new Date();
  const endDate = new Date(now);

  let startDate: Date;
  switch (range) {
    case "7d":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "90d":
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case "all":
      return undefined;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return { start: startDate, end: endDate };
}

/**
 * GET /api/summary/stats/providers
 * 获取 Provider 使用详细统计
 */
export const GET = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    // 创建 Supabase 客户端用于数据库操作
    const supabase = await createClient();

    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const validation = timeRangeSchema.safeParse({
      range: searchParams.get("range") || undefined,
    });

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const timeRange = getTimeRange(validation.data.range);

    // 获取 Provider 使用统计
    const qualityTracker = getQualityTrackerService(supabase);
    const providerStats = await qualityTracker.getProviderUsageStats(
      userId,
      timeRange,
    );

    // 获取 Provider 健康状态
    const configService = getSummaryConfigService();
    const healthMap = configService.getAllProviderHealth();

    // 计算汇总数据
    let totalTokens = 0;
    let totalCostCents = 0;
    let primaryProvider: string | null = null;
    let maxCalls = 0;
    let fallbackCalls = 0;

    // 构建响应
    const providers = Object.entries(providerStats.byProvider || {}).map(
      ([name, stats]) => {
        const health = healthMap.get(
          name as "deepseek" | "aliyun-bailian" | "ollama",
        );

        // 累加总 Token
        totalTokens += stats.totalTokens;

        // 计算估算成本（基于 Token 数量）
        const costPerToken =
          name === "deepseek"
            ? 0.00014
            : name === "aliyun-bailian"
              ? 0.00012
              : 0;
        const estimatedCost =
          Math.round(stats.totalTokens * costPerToken * 100) / 100;
        totalCostCents += estimatedCost;

        // 追踪主 Provider
        if (stats.count > maxCalls) {
          maxCalls = stats.count;
          primaryProvider = name;
        }

        // 计算 Fallback 使用（非 deepseek 的调用）
        if (name !== "deepseek") {
          fallbackCalls += stats.count;
        }

        return {
          name,
          // 使用统计
          totalCalls: stats.count,
          successCount: stats.successCount,
          failedCount: stats.failedCount,
          averageLatencyMs: stats.avgLatencyMs,
          totalTokens: stats.totalTokens,
          estimatedCostCents: estimatedCost,
          // 健康状态
          health: health
            ? {
                available: health.available,
                latencyMs: health.latencyMs,
                checkedAt: health.checkedAt,
                error: health.error,
              }
            : null,
        };
      },
    );

    // 计算 Fallback 率
    const fallbackUsageRate =
      providerStats.totalCalls > 0
        ? Number(((fallbackCalls / providerStats.totalCalls) * 100).toFixed(2))
        : 0;

    // 返回结果
    return successResponse({
      providers,
      summary: {
        totalCalls: providerStats.totalCalls,
        totalTokens,
        totalCostCents: Math.round(totalCostCents * 100) / 100,
        primaryProvider,
        fallbackUsageRate,
      },
      dailyUsage: providerStats.trend || [],
      timeRange: timeRange
        ? {
            start: timeRange.start.toISOString(),
            end: timeRange.end.toISOString(),
          }
        : "all",
    });
  },
);
