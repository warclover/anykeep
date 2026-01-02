/**
 * RAG 监控指标 API
 *
 * GET /api/rag/metrics - 获取 RAG 系统实时指标
 *
 * @version 1.0.0
 * @since 2026-01-02
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRAGMetricsCollector } from "@/lib/monitoring/rag/metrics-collector";
import { FeatureFlags } from "@/lib/ai-agent/config/feature-flags";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    // 2. 检查功能开关
    if (!FeatureFlags.ENABLE_RAG_MONITORING) {
      return NextResponse.json(
        { error: "RAG 监控功能未启用" },
        { status: 503 },
      );
    }

    // 3. 收集指标
    const collector = getRAGMetricsCollector();
    const metrics = collector.collectMetrics();
    const dailyStats = collector.getDailyStats();
    const alerts = collector.getAlerts(50);

    // 4. 获取 Feature Flags 状态
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
        userId: user.id,
        action: "rag_metrics_request",
      },
      "RAG Metrics: Request received",
    );

    // 5. 返回数据
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
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "GET /api/rag/metrics error",
    );

    return NextResponse.json({ error: "获取 RAG 指标失败" }, { status: 500 });
  }
}
