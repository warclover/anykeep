/**
 * 智能分类 v5.0 - 分类指标查询 API
 *
 * GET /api/classification/v5/metrics?days=7
 *
 * 功能：
 * - 查询分类性能指标
 * - 计算 T0/T1 准确率、延迟、成本等
 * - 支持时间范围筛选
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { LoggerService } from "@/lib/classification/infrastructure/shared-services/logger";

/**
 * 指标记录类型
 */
interface MetricRecord {
  stage?: string;
  is_correct?: boolean | null;
  latency_ms?: number;
  confidence?: number;
  embedding_tokens?: number | null;
  llm_tokens?: number | null;
  degradation_level?: number;
}

/**
 * 分类指标摘要
 */
interface MetricsSummary {
  /** 时间范围（天数） */
  days: number;
  /** 总分类次数 */
  totalClassifications: number;
  /** T0 阶段指标 */
  t0: {
    count: number;
    accuracy: number | null;
    avgLatency: number;
    p95Latency: number;
    avgConfidence: number;
  };
  /** T1 阶段指标 */
  t1: {
    count: number;
    accuracy: number | null;
    avgLatency: number;
    p95Latency: number;
    avgConfidence: number;
  };
  /** LLM 调用率 */
  llmCallRate: number;
  /** 成本统计 */
  cost: {
    embeddingCost: number;
    llmCost: number;
    totalCost: number;
  };
  /** 降级统计 */
  degradation: {
    v5Count: number;
    v4Count: number;
    ruleCount: number;
    degradationRate: number;
  };
}

/**
 * GET /api/classification/v5/metrics
 * 查询分类指标
 */
export async function GET(request: NextRequest) {
  const logger = new LoggerService({}, { module: "MetricsAPI" });

  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. 获取查询参数
    const days = parseInt(request.nextUrl.searchParams.get("days") || "7");
    if (days < 1 || days > 90) {
      return NextResponse.json(
        { error: "Invalid days parameter (must be 1-90)" },
        { status: 400 },
      );
    }

    logger.info("Fetching metrics", { userId: user.id, days });

    // 3. 计算时间范围
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 4. 查询指标数据
    const { data: metrics, error: metricsError } = await supabase
      .from("classification_metrics_v5")
      .select("*")
      .eq("user_id", user.id)
      .gte("created_at", startDate.toISOString());

    if (metricsError) {
      logger.error("Failed to fetch metrics", metricsError);
      return NextResponse.json(
        { error: "Failed to fetch metrics" },
        { status: 500 },
      );
    }

    if (!metrics || metrics.length === 0) {
      // 没有数据，返回空指标
      const emptyMetrics: MetricsSummary = {
        days,
        totalClassifications: 0,
        t0: {
          count: 0,
          accuracy: null,
          avgLatency: 0,
          p95Latency: 0,
          avgConfidence: 0,
        },
        t1: {
          count: 0,
          accuracy: null,
          avgLatency: 0,
          p95Latency: 0,
          avgConfidence: 0,
        },
        llmCallRate: 0,
        cost: {
          embeddingCost: 0,
          llmCost: 0,
          totalCost: 0,
        },
        degradation: {
          v5Count: 0,
          v4Count: 0,
          ruleCount: 0,
          degradationRate: 0,
        },
      };

      return NextResponse.json(emptyMetrics);
    }

    // 5. 计算指标
    const summary = calculateMetricsSummary(metrics, days);

    logger.info("Metrics calculated", {
      userId: user.id,
      totalClassifications: summary.totalClassifications,
    });

    return NextResponse.json(summary);
  } catch (error) {
    logger.error(
      "Metrics API error",
      error instanceof Error ? error : undefined,
    );
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}

/**
 * 计算指标摘要
 */
function calculateMetricsSummary(
  metrics: MetricRecord[],
  days: number,
): MetricsSummary {
  const totalClassifications = metrics.length;

  // 分离 T0 和 T1 指标
  const t0Metrics = metrics.filter((m) => m.stage === "T0");
  const t1Metrics = metrics.filter((m) => m.stage === "T1");

  // 计算 T0 指标
  const t0Summary = {
    count: t0Metrics.length,
    accuracy: calculateAccuracy(t0Metrics),
    avgLatency: calculateAvgLatency(t0Metrics),
    p95Latency: calculateP95Latency(t0Metrics),
    avgConfidence: calculateAvgConfidence(t0Metrics),
  };

  // 计算 T1 指标
  const t1Summary = {
    count: t1Metrics.length,
    accuracy: calculateAccuracy(t1Metrics),
    avgLatency: calculateAvgLatency(t1Metrics),
    p95Latency: calculateP95Latency(t1Metrics),
    avgConfidence: calculateAvgConfidence(t1Metrics),
  };

  // 计算 LLM 调用率
  const llmCallRate =
    totalClassifications > 0 ? t1Metrics.length / totalClassifications : 0;

  // 计算成本
  const cost = calculateCost(metrics);

  // 计算降级统计
  const degradation = calculateDegradation(metrics);

  return {
    days,
    totalClassifications,
    t0: t0Summary,
    t1: t1Summary,
    llmCallRate,
    cost,
    degradation,
  };
}

/**
 * 计算准确率
 */
function calculateAccuracy(metrics: MetricRecord[]): number | null {
  const withFeedback = metrics.filter((m) => m.is_correct !== null);
  if (withFeedback.length === 0) return null;

  const correctCount = withFeedback.filter((m) => m.is_correct === true).length;
  return correctCount / withFeedback.length;
}

/**
 * 计算平均延迟
 */
function calculateAvgLatency(metrics: MetricRecord[]): number {
  if (metrics.length === 0) return 0;

  const totalLatency = metrics.reduce((sum, m) => sum + (m.latency_ms || 0), 0);
  return Math.round(totalLatency / metrics.length);
}

/**
 * 计算 P95 延迟
 */
function calculateP95Latency(metrics: MetricRecord[]): number {
  if (metrics.length === 0) return 0;

  const latencies = metrics.map((m) => m.latency_ms || 0).sort((a, b) => a - b);
  const p95Index = Math.floor(latencies.length * 0.95);
  return latencies[p95Index] || 0;
}

/**
 * 计算平均置信度
 */
function calculateAvgConfidence(metrics: MetricRecord[]): number {
  if (metrics.length === 0) return 0;

  const totalConfidence = metrics.reduce(
    (sum, m) => sum + (m.confidence || 0),
    0,
  );
  return totalConfidence / metrics.length;
}

/**
 * 计算成本
 */
function calculateCost(metrics: MetricRecord[]): {
  embeddingCost: number;
  llmCost: number;
  totalCost: number;
} {
  const embeddingTokens = metrics.reduce(
    (sum, m) => sum + (m.embedding_tokens || 0),
    0,
  );
  const llmTokens = metrics.reduce((sum, m) => sum + (m.llm_tokens || 0), 0);

  // OpenAI text-embedding-3-small: $0.00002 per 1K tokens
  const embeddingCost = (embeddingTokens / 1000) * 0.00002;

  // DeepSeek: $0.0014 per 1K tokens
  const llmCost = (llmTokens / 1000) * 0.0014;

  return {
    embeddingCost: parseFloat(embeddingCost.toFixed(4)),
    llmCost: parseFloat(llmCost.toFixed(4)),
    totalCost: parseFloat((embeddingCost + llmCost).toFixed(4)),
  };
}

/**
 * 计算降级统计
 */
function calculateDegradation(metrics: MetricRecord[]): {
  v5Count: number;
  v4Count: number;
  ruleCount: number;
  degradationRate: number;
} {
  const v5Count = metrics.filter((m) => m.degradation_level === 0).length;
  const v4Count = metrics.filter((m) => m.degradation_level === 1).length;
  const ruleCount = metrics.filter((m) => m.degradation_level === 2).length;

  const degradationRate =
    metrics.length > 0 ? (v4Count + ruleCount) / metrics.length : 0;

  return {
    v5Count,
    v4Count,
    ruleCount,
    degradationRate,
  };
}
