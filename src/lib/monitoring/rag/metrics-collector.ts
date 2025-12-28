/**
 * RAG 指标收集器
 *
 * 实时收集 RAG 系统的性能、质量和成本指标
 *
 * @module monitoring/rag/metrics-collector
 * @version 1.0.0
 * @since 2025-12-28
 */

import { logger } from "@/lib/logger";
import { getVectorCache } from "@/lib/cache";
import {
  DEFAULT_RAG_THRESHOLDS,
  type RAGMetrics,
  type RAGAlert,
  type RAGMetricThresholds,
} from "./types";
import { calculatePercentile } from "./metrics-calculator";

/**
 * 搜索记录
 */
interface SearchRecord {
  timestamp: number;
  latencyMs: number;
  resultCount: number;
  maxSimilarity: number;
  userId?: string;
}

/**
 * API 调用记录
 */
interface ApiCallRecord {
  timestamp: number;
  type: "embedding" | "rerank" | "llm";
  tokensUsed: number;
  costCNY: number;
}

/**
 * RAG 指标收集器
 */
export class RAGMetricsCollector {
  private searchRecords: SearchRecord[] = [];
  private apiCallRecords: ApiCallRecord[] = [];
  private thresholds: RAGMetricThresholds;
  private alerts: RAGAlert[] = [];

  // 滑动窗口配置
  private readonly maxRecords = 10000;
  private readonly windowMs = 24 * 60 * 60 * 1000; // 24 小时

  // 成本配置
  private readonly costConfig = {
    embedding: 0.0002, // 元/千 token (通义千问)
    rerank: 0.001, // 元/千 token (DashScope GTE)
    llm: {
      deepseek: 0.001, // 元/千 token
      openai: 0.03, // 元/千 token
    },
  };

  constructor(thresholds?: Partial<RAGMetricThresholds>) {
    this.thresholds = { ...DEFAULT_RAG_THRESHOLDS, ...thresholds };
  }

  /**
   * 记录搜索请求
   */
  recordSearch(
    latencyMs: number,
    resultCount: number,
    maxSimilarity: number,
    userId?: string,
  ): void {
    const record: SearchRecord = {
      timestamp: Date.now(),
      latencyMs,
      resultCount,
      maxSimilarity,
      userId,
    };

    this.searchRecords.push(record);
    this.cleanupOldRecords();

    // 检查延迟告警
    if (latencyMs > this.thresholds.searchLatencyP95Critical) {
      this.addAlert({
        timestamp: new Date().toISOString(),
        level: "critical",
        type: "latency",
        metric: "searchLatency",
        currentValue: latencyMs,
        threshold: this.thresholds.searchLatencyP95Critical,
        message: `搜索延迟 ${latencyMs}ms 超过临界阈值 ${this.thresholds.searchLatencyP95Critical}ms`,
      });
    } else if (latencyMs > this.thresholds.searchLatencyP95Warning) {
      this.addAlert({
        timestamp: new Date().toISOString(),
        level: "warning",
        type: "latency",
        metric: "searchLatency",
        currentValue: latencyMs,
        threshold: this.thresholds.searchLatencyP95Warning,
        message: `搜索延迟 ${latencyMs}ms 超过警告阈值 ${this.thresholds.searchLatencyP95Warning}ms`,
      });
    }
  }

  /**
   * 记录 API 调用
   */
  recordApiCall(
    type: "embedding" | "rerank" | "llm",
    tokensUsed: number,
    provider: "deepseek" | "openai" | "dashscope" = "deepseek",
  ): void {
    let costCNY = 0;
    if (type === "embedding") {
      costCNY = (tokensUsed / 1000) * this.costConfig.embedding;
    } else if (type === "rerank") {
      costCNY = (tokensUsed / 1000) * this.costConfig.rerank;
    } else if (type === "llm") {
      const rate =
        provider === "openai"
          ? this.costConfig.llm.openai
          : this.costConfig.llm.deepseek;
      costCNY = (tokensUsed / 1000) * rate;
    }

    this.apiCallRecords.push({
      timestamp: Date.now(),
      type,
      tokensUsed,
      costCNY,
    });

    this.cleanupOldRecords();
    this.checkCostAlert();
  }

  /**
   * 收集当前指标
   */
  collectMetrics(): RAGMetrics {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // 筛选时间窗口内的记录
    const recentSearches = this.searchRecords.filter(
      (r) => r.timestamp >= windowStart,
    );
    const recentApiCalls = this.apiCallRecords.filter(
      (r) => r.timestamp >= windowStart,
    );

    // 搜索性能指标
    const latencies = recentSearches.map((r) => r.latencyMs);
    const searchLatencyP50 = calculatePercentile(latencies, 50);
    const searchLatencyP95 = calculatePercentile(latencies, 95);
    const searchLatencyP99 = calculatePercentile(latencies, 99);
    const searchLatencyAvg =
      latencies.length > 0
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : 0;

    // 缓存效率指标
    const vectorCache = getVectorCache();
    const cacheStats = vectorCache.getStats();
    const vectorCacheHitRate = cacheStats.hitRate;
    const queryCacheHitRate = 0; // TODO: 从 QueryRewriter 缓存获取
    const cacheSize = cacheStats.size;

    // 质量指标
    const avgSimilarityScore =
      recentSearches.length > 0
        ? recentSearches.reduce((sum, r) => sum + r.maxSimilarity, 0) /
          recentSearches.length
        : 0;

    const zeroResultCount = recentSearches.filter(
      (r) => r.resultCount === 0,
    ).length;
    const zeroResultRate =
      recentSearches.length > 0 ? zeroResultCount / recentSearches.length : 0;

    const avgResultCount =
      recentSearches.length > 0
        ? recentSearches.reduce((sum, r) => sum + r.resultCount, 0) /
          recentSearches.length
        : 0;

    // 成本指标
    const embeddingCalls = recentApiCalls.filter((r) => r.type === "embedding");
    const rerankCalls = recentApiCalls.filter((r) => r.type === "rerank");
    const llmCalls = recentApiCalls.filter((r) => r.type === "llm");

    const embeddingApiCalls = embeddingCalls.length;
    const rerankApiCalls = rerankCalls.length;
    const llmTokensUsed = llmCalls.reduce((sum, r) => sum + r.tokensUsed, 0);

    const estimatedCostCNY = recentApiCalls.reduce(
      (sum, r) => sum + r.costCNY,
      0,
    );

    // 检查质量告警
    this.checkQualityAlerts(zeroResultRate, vectorCacheHitRate);

    return {
      // 搜索性能
      searchLatencyP50,
      searchLatencyP95,
      searchLatencyP99,
      searchLatencyAvg,

      // 缓存效率
      vectorCacheHitRate,
      queryCacheHitRate,
      cacheSize,

      // 质量指标
      avgSimilarityScore,
      zeroResultRate,
      avgResultCount,

      // 成本追踪
      embeddingApiCalls,
      rerankApiCalls,
      llmTokensUsed,
      estimatedCostCNY,

      // 时间范围
      periodStart: new Date(windowStart).toISOString(),
      periodEnd: new Date(now).toISOString(),
    };
  }

  /**
   * 获取最近的告警
   */
  getAlerts(limit = 100): RAGAlert[] {
    return this.alerts.slice(-limit);
  }

  /**
   * 清除告警
   */
  clearAlerts(): void {
    this.alerts = [];
  }

  /**
   * 获取每日统计
   */
  getDailyStats(): {
    date: string;
    totalSearches: number;
    uniqueUsers: number;
    avgLatencyMs: number;
    zeroResultRate: number;
    totalCostCNY: number;
  } {
    const today = new Date().toISOString().split("T")[0];
    const todayStart = new Date(today).getTime();

    const todaySearches = this.searchRecords.filter(
      (r) => r.timestamp >= todayStart,
    );
    const todayApiCalls = this.apiCallRecords.filter(
      (r) => r.timestamp >= todayStart,
    );

    const uniqueUsers = new Set(
      todaySearches.filter((r) => r.userId).map((r) => r.userId),
    ).size;

    const latencies = todaySearches.map((r) => r.latencyMs);
    const avgLatencyMs =
      latencies.length > 0
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : 0;

    const zeroResults = todaySearches.filter((r) => r.resultCount === 0).length;
    const zeroResultRate =
      todaySearches.length > 0 ? zeroResults / todaySearches.length : 0;

    const totalCostCNY = todayApiCalls.reduce((sum, r) => sum + r.costCNY, 0);

    return {
      date: today,
      totalSearches: todaySearches.length,
      uniqueUsers,
      avgLatencyMs,
      zeroResultRate,
      totalCostCNY,
    };
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  private cleanupOldRecords(): void {
    const cutoff = Date.now() - this.windowMs;

    // 清理搜索记录
    if (this.searchRecords.length > this.maxRecords) {
      this.searchRecords = this.searchRecords.filter(
        (r) => r.timestamp >= cutoff,
      );
    }

    // 清理 API 调用记录
    if (this.apiCallRecords.length > this.maxRecords) {
      this.apiCallRecords = this.apiCallRecords.filter(
        (r) => r.timestamp >= cutoff,
      );
    }
  }

  private addAlert(alert: RAGAlert): void {
    this.alerts.push(alert);

    // 保留最近 1000 条告警
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }

    // 记录日志
    if (alert.level === "critical") {
      logger.error({ alert }, "RAGMetricsCollector: Critical alert");
    } else if (alert.level === "warning") {
      logger.warn({ alert }, "RAGMetricsCollector: Warning alert");
    } else {
      logger.info({ alert }, "RAGMetricsCollector: Info alert");
    }
  }

  private checkCostAlert(): void {
    const dailyStats = this.getDailyStats();

    if (dailyStats.totalCostCNY > this.thresholds.dailyCostBudgetCNY) {
      this.addAlert({
        timestamp: new Date().toISOString(),
        level: "critical",
        type: "cost",
        metric: "dailyCost",
        currentValue: dailyStats.totalCostCNY,
        threshold: this.thresholds.dailyCostBudgetCNY,
        message: `今日成本 ¥${dailyStats.totalCostCNY.toFixed(2)} 超过预算 ¥${this.thresholds.dailyCostBudgetCNY}`,
      });
    } else if (
      dailyStats.totalCostCNY >
      this.thresholds.dailyCostBudgetCNY * 0.8
    ) {
      this.addAlert({
        timestamp: new Date().toISOString(),
        level: "warning",
        type: "cost",
        metric: "dailyCost",
        currentValue: dailyStats.totalCostCNY,
        threshold: this.thresholds.dailyCostBudgetCNY * 0.8,
        message: `今日成本 ¥${dailyStats.totalCostCNY.toFixed(2)} 已达预算的 80%`,
      });
    }
  }

  private checkQualityAlerts(
    zeroResultRate: number,
    cacheHitRate: number,
  ): void {
    // 零结果率告警
    if (zeroResultRate > this.thresholds.zeroResultRateCritical) {
      this.addAlert({
        timestamp: new Date().toISOString(),
        level: "critical",
        type: "quality",
        metric: "zeroResultRate",
        currentValue: zeroResultRate,
        threshold: this.thresholds.zeroResultRateCritical,
        message: `零结果率 ${(zeroResultRate * 100).toFixed(1)}% 超过临界阈值`,
      });
    } else if (zeroResultRate > this.thresholds.zeroResultRateWarning) {
      this.addAlert({
        timestamp: new Date().toISOString(),
        level: "warning",
        type: "quality",
        metric: "zeroResultRate",
        currentValue: zeroResultRate,
        threshold: this.thresholds.zeroResultRateWarning,
        message: `零结果率 ${(zeroResultRate * 100).toFixed(1)}% 超过警告阈值`,
      });
    }

    // 缓存命中率告警
    if (cacheHitRate < this.thresholds.cacheHitRateCritical) {
      this.addAlert({
        timestamp: new Date().toISOString(),
        level: "critical",
        type: "cache",
        metric: "cacheHitRate",
        currentValue: cacheHitRate,
        threshold: this.thresholds.cacheHitRateCritical,
        message: `缓存命中率 ${(cacheHitRate * 100).toFixed(1)}% 低于临界阈值`,
      });
    } else if (cacheHitRate < this.thresholds.cacheHitRateWarning) {
      this.addAlert({
        timestamp: new Date().toISOString(),
        level: "warning",
        type: "cache",
        metric: "cacheHitRate",
        currentValue: cacheHitRate,
        threshold: this.thresholds.cacheHitRateWarning,
        message: `缓存命中率 ${(cacheHitRate * 100).toFixed(1)}% 低于警告阈值`,
      });
    }
  }
}

// 单例实例
let collectorInstance: RAGMetricsCollector | null = null;

/**
 * 获取 RAG 指标收集器单例
 */
export function getRAGMetricsCollector(
  thresholds?: Partial<RAGMetricThresholds>,
): RAGMetricsCollector {
  if (!collectorInstance) {
    collectorInstance = new RAGMetricsCollector(thresholds);
  }
  return collectorInstance;
}

/**
 * 重置收集器（用于测试）
 */
export function resetRAGMetricsCollector(): void {
  collectorInstance = null;
}
