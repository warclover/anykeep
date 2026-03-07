/**
 * RAG 监控指标 API
 *
 * @description 提供 RAG 系统的性能、质量和成本指标查询
 * @since 2025-12-28 (Phase 3)
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getRAGMetricsCollector } from "@/lib/monitoring/rag";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { forbiddenError } from "@/lib/utils/api-response";
import { isAdminUser } from "@/lib/auth/admin-check";

/**
 * GET /api/admin/rag-metrics
 *
 * 获取 RAG 系统监控指标
 *
 * Query Params:
 * - type: 指标类型 ('current' | 'daily' | 'alerts')
 * - limit: 告警数量限制 (默认 100)
 */
export const GET = withAuthMiddleware(async (req: NextRequest, { user }) => {
  // 管理员权限检查
  if (!user?.email) {
    return forbiddenError("需要管理员权限");
  }
  if (!isAdminUser(user.email)) {
    return forbiddenError("需要管理员权限");
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "current";

  const collector = getRAGMetricsCollector();

  switch (type) {
    case "current": {
      // 当前实时指标
      const metrics = collector.collectMetrics();
      return NextResponse.json({
        success: true,
        data: {
          type: "current",
          metrics,
          timestamp: new Date().toISOString(),
        },
      });
    }

    case "daily": {
      // 今日统计
      const dailyStats = collector.getDailyStats();
      return NextResponse.json({
        success: true,
        data: {
          type: "daily",
          stats: dailyStats,
        },
      });
    }

    case "alerts": {
      // 最近告警
      const limit = parseInt(searchParams.get("limit") || "100", 10);
      const alerts = collector.getAlerts(Math.min(limit, 1000));
      return NextResponse.json({
        success: true,
        data: {
          type: "alerts",
          alerts,
          total: alerts.length,
        },
      });
    }

    case "summary": {
      // 综合摘要
      const metrics = collector.collectMetrics();
      const dailyStats = collector.getDailyStats();
      const recentAlerts = collector.getAlerts(10);

      // 健康状态判断
      const healthStatus = calculateHealthStatus(metrics, recentAlerts.length);

      return NextResponse.json({
        success: true,
        data: {
          type: "summary",
          health: healthStatus,
          metrics: {
            latencyP95: metrics.searchLatencyP95,
            cacheHitRate: metrics.vectorCacheHitRate,
            zeroResultRate: metrics.zeroResultRate,
            avgSimilarity: metrics.avgSimilarityScore,
          },
          daily: dailyStats,
          recentAlerts,
          timestamp: new Date().toISOString(),
        },
      });
    }

    default:
      return NextResponse.json(
        { success: false, error: `Invalid type: ${type}` },
        { status: 400 },
      );
  }
});

/**
 * POST /api/admin/rag-metrics
 *
 * 记录搜索指标或 API 调用
 *
 * Body:
 * - action: 'recordSearch' | 'recordApiCall' | 'clearAlerts'
 * - ...相关数据
 */
export const POST = withAuthMiddleware(
  async (req: NextRequest, { userId, user }) => {
    // 管理员权限检查
    if (!user?.email) {
      return forbiddenError("需要管理员权限");
    }
    if (!isAdminUser(user.email)) {
      return forbiddenError("需要管理员权限");
    }

    const body = await req.json();
    const { action } = body;

    const collector = getRAGMetricsCollector();

    switch (action) {
      case "recordSearch": {
        const { latencyMs, resultCount, maxSimilarity } = body;
        if (
          typeof latencyMs !== "number" ||
          typeof resultCount !== "number" ||
          typeof maxSimilarity !== "number"
        ) {
          return NextResponse.json(
            { success: false, error: "Invalid parameters" },
            { status: 400 },
          );
        }

        collector.recordSearch(latencyMs, resultCount, maxSimilarity, userId);
        return NextResponse.json({
          success: true,
          message: "Search recorded",
        });
      }

      case "recordApiCall": {
        const { type, tokensUsed, provider } = body;
        if (
          !["embedding", "rerank", "llm"].includes(type) ||
          typeof tokensUsed !== "number"
        ) {
          return NextResponse.json(
            { success: false, error: "Invalid parameters" },
            { status: 400 },
          );
        }

        collector.recordApiCall(type, tokensUsed, provider);
        return NextResponse.json({
          success: true,
          message: "API call recorded",
        });
      }

      case "clearAlerts": {
        collector.clearAlerts();
        return NextResponse.json({
          success: true,
          message: "Alerts cleared",
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Invalid action: ${action}` },
          { status: 400 },
        );
    }
  },
);

/**
 * 计算系统健康状态
 */
function calculateHealthStatus(
  metrics: ReturnType<
    ReturnType<typeof getRAGMetricsCollector>["collectMetrics"]
  >,
  alertCount: number,
): "healthy" | "warning" | "critical" {
  // 关键指标检查
  const issues: string[] = [];

  // 延迟检查
  if (metrics.searchLatencyP95 > 1000) {
    issues.push("critical_latency");
  } else if (metrics.searchLatencyP95 > 500) {
    issues.push("warning_latency");
  }

  // 缓存命中率检查
  if (metrics.vectorCacheHitRate < 0.3) {
    issues.push("critical_cache");
  } else if (metrics.vectorCacheHitRate < 0.5) {
    issues.push("warning_cache");
  }

  // 零结果率检查
  if (metrics.zeroResultRate > 0.2) {
    issues.push("critical_zero_result");
  } else if (metrics.zeroResultRate > 0.1) {
    issues.push("warning_zero_result");
  }

  // 告警数量检查
  if (alertCount > 10) {
    issues.push("many_alerts");
  }

  // 判断整体状态
  if (issues.some((i) => i.startsWith("critical"))) {
    return "critical";
  }
  if (issues.length > 0) {
    return "warning";
  }
  return "healthy";
}
