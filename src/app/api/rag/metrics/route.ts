/**
 * RAG 监控指标 API
 *
 * GET /api/rag/metrics - 获取 RAG 系统实时指标
 *
 * @version 1.0.0
 * @since 2026-01-02
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { getRAGMetricsCollector } from "@/lib/monitoring/rag/metrics-collector";
import { FeatureFlags } from "@/lib/ai-agent/config/feature-flags";
import { logger } from "@/lib/logger";

export const GET = withAuthMiddleware(
  async (_request: NextRequest, { userId }) => {
    // 1. 检查功能开关
    if (!FeatureFlags.ENABLE_RAG_MONITORING) {
      return NextResponse.json(
        { error: "RAG 监控功能未启用" },
        { status: 503 },
      );
    }

    // 2. 收集指标
    const collector = getRAGMetricsCollector();

    // 调试信息：检查收集器状态
    logger.info(
      {
        searchRecordsCount: collector._debugSearchRecordsCount,
        apiCallRecordsCount: collector._debugApiCallRecordsCount,
        featureFlagsEnabled: FeatureFlags.ENABLE_RAG_MONITORING,
      },
      "RAG Metrics: Collector state before collection",
    );

    const metrics = collector.collectMetrics();
    const dailyStats = collector.getDailyStats();
    const alerts = collector.getAlerts(50);

    // 调试日志：记录收集到的指标
    logger.info(
      {
        metrics,
        dailyStats,
        alertsCount: alerts.length,
        searchRecordsCount: collector._debugSearchRecordsCount,
        apiCallRecordsCount: collector._debugApiCallRecordsCount,
      },
      "RAG Metrics: Collected",
    );

    // 3. 获取 Feature Flags 状态
    const featureFlags = {
      queryRewrite: FeatureFlags.ENABLE_QUERY_REWRITE,
      rerank: FeatureFlags.ENABLE_RERANK,
      vectorCache: FeatureFlags.ENABLE_VECTOR_CACHE,
      parentChildChunking: FeatureFlags.ENABLE_PARENT_CHILD_CHUNKING,
      rrfFusion: FeatureFlags.ENABLE_RRF_FUSION,
      smartFilterExtraction: FeatureFlags.ENABLE_SMART_FILTER_EXTRACTION,
    };

    logger.info(
      {
        userId,
        action: "rag_metrics_request",
      },
      "RAG Metrics: Request received",
    );

    // 4. 返回数据
    return NextResponse.json({
      success: true,
      data: {
        metrics,
        dailyStats,
        alerts,
        featureFlags,
        timestamp: new Date().toISOString(),
      },
    });
  },
);
