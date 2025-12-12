/**
 * Summary Statistics API
 *
 * GET /api/summary/stats - 获取摘要质量统计
 * GET /api/summary/stats/providers - 获取 Provider 使用统计
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
  unauthorizedError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { getQualityTrackerService } from "@/lib/summary";

/**
 * 时间范围 Schema
 */
const timeRangeSchema = z.object({
  /** 开始日期 (ISO 格式) */
  start: z.string().datetime().optional(),
  /** 结束日期 (ISO 格式) */
  end: z.string().datetime().optional(),
  /** 预设时间范围 */
  range: z.enum(["7d", "30d", "90d", "all"]).optional().default("30d"),
});

/**
 * 计算时间范围
 */
function getTimeRange(
  params: z.infer<typeof timeRangeSchema>,
): { start: Date; end: Date } | undefined {
  const { start, end, range } = params;

  // 如果提供了自定义范围
  if (start && end) {
    return {
      start: new Date(start),
      end: new Date(end),
    };
  }

  // 使用预设范围
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
      return undefined; // 不限制时间范围
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return { start: startDate, end: endDate };
}

/**
 * GET /api/summary/stats
 * 获取摘要质量统计
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // 2. 解析查询参数
    const { searchParams } = new URL(request.url);
    const validation = timeRangeSchema.safeParse({
      start: searchParams.get("start") || undefined,
      end: searchParams.get("end") || undefined,
      range: searchParams.get("range") || undefined,
    });

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const timeRange = getTimeRange(validation.data);

    // 3. 获取统计数据
    const qualityTracker = getQualityTrackerService(supabase);
    const stats = await qualityTracker.getStats(user.id, timeRange);

    // 4. 计算额外指标
    const successRate =
      stats.totalCount > 0
        ? ((stats.successCount / stats.totalCount) * 100).toFixed(1)
        : "0";

    const averageLatency =
      stats.averageLatencyMs > 0
        ? (stats.averageLatencyMs / 1000).toFixed(2)
        : "0";

    // 5. 返回结果
    return successResponse({
      // 基础统计
      totalCount: stats.totalCount,
      successCount: stats.successCount,
      failedCount: stats.failedCount,
      successRate: `${successRate}%`,

      // 质量指标
      averageQualityScore: stats.averageQualityScore.toFixed(3),
      averageLatencyMs: stats.averageLatencyMs,
      averageLatencySeconds: `${averageLatency}s`,
      averageUserRating: stats.averageUserRating?.toFixed(1) || null,

      // Provider 分布
      providerDistribution: stats.providerDistribution,
      fallbackRate: `${(stats.fallbackRate * 100).toFixed(1)}%`,

      // 质量趋势
      qualityTrend: stats.qualityTrend || "stable",

      // 时间范围
      timeRange: timeRange
        ? {
            start: timeRange.start.toISOString(),
            end: timeRange.end.toISOString(),
          }
        : "all",
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "GET /api/summary/stats error",
    );
    return internalError("获取统计数据失败");
  }
}
