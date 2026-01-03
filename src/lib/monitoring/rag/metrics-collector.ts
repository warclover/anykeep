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

  // 公开访问器用于调试（仅开发环境）
  get _debugSearchRecordsCount(): number {
    return this.searchRecords.length;
  }

  get _debugApiCallRecordsCount(): number {
    return this.apiCallRecords.length;
  }

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

    // 调试日志：记录指标收集情况
    logger.debug(
      {
        searchRecordsCount: this.searchRecords.length,
        latencyMs,
        resultCount,
        maxSimilarity,
      },
      "RAGMetricsCollector: Search recorded",
    );

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

    // 调试日志：记录 API 调用收集情况
    logger.debug(
      {
        apiCallRecordsCount: this.apiCallRecords.length,
        type,
        tokensUsed,
        costCNY,
      },
      "RAGMetricsCollector: API call recorded",
    );
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

    // 调试日志：记录收集情况
    logger.debug(
      {
        totalSearchRecords: this.searchRecords.length,
        recentSearches: recentSearches.length,
        totalApiCallRecords: this.apiCallRecords.length,
        recentApiCalls: recentApiCalls.length,
        windowMs: this.windowMs,
        windowStart: new Date(windowStart).toISOString(),
        now: new Date(now).toISOString(),
      },
      "RAGMetricsCollector: Collecting metrics",
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

    // H6: 修复内存泄漏 - 无论记录数量，都清理过期记录
    // 同时限制最大记录数防止极端情况

    // 清理过期的搜索记录
    const validSearchRecords = this.searchRecords.filter(
      (r) => r.timestamp >= cutoff,
    );
    // 如果仍超过限制，只保留最新的
    this.searchRecords =
      validSearchRecords.length > this.maxRecords
        ? validSearchRecords.slice(-this.maxRecords)
        : validSearchRecords;

    // 清理过期的 API 调用记录
    const validApiCallRecords = this.apiCallRecords.filter(
      (r) => r.timestamp >= cutoff,
    );
    this.apiCallRecords =
      validApiCallRecords.length > this.maxRecords
        ? validApiCallRecords.slice(-this.maxRecords)
        : validApiCallRecords;

    // 清理过期的告警（保留最近 24 小时）
    const alertCutoff = Date.now() - this.windowMs;
    this.alerts = this.alerts.filter((a) => {
      const alertTime = new Date(a.timestamp).getTime();
      return alertTime >= alertCutoff;
    });
    // 同时限制告警数量
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }
  }

  private addAlert(alert: RAGAlert): void {
    this.alerts.push(alert);

    // H6: 告警清理已移至 cleanupOldRecords()，这里只记录日志
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

// 单例实例 - 使用 globalThis 确保在 Next.js 服务器端跨请求共享
// 在 Node.js 环境中，globalThis 是全局对象，可以跨模块共享
declare global {
  var __ragMetricsCollector: RAGMetricsCollector | undefined;
}

/**
 * 获取 RAG 指标收集器单例
 *
 * 使用 globalThis 存储单例实例，确保在 Next.js 服务器端跨请求共享。
 * 在开发模式下，Next.js 可能会热重载导致实例重置，这是正常的。
 */
export function getRAGMetricsCollector(
  thresholds?: Partial<RAGMetricThresholds>,
): RAGMetricsCollector {
  // 使用 globalThis 确保跨请求共享（在 Node.js 环境中）
  if (typeof globalThis !== "undefined") {
    if (!globalThis.__ragMetricsCollector) {
      globalThis.__ragMetricsCollector = new RAGMetricsCollector(thresholds);
      logger.info(
        {
          instanceId: globalThis.__ragMetricsCollector.constructor.name,
          timestamp: new Date().toISOString(),
          storage: "globalThis",
        },
        "RAGMetricsCollector: New instance created (globalThis)",
      );
    } else {
      logger.debug(
        {
          searchRecordsCount:
            globalThis.__ragMetricsCollector.searchRecords.length,
          apiCallRecordsCount:
            globalThis.__ragMetricsCollector.apiCallRecords.length,
          storage: "globalThis",
        },
        "RAGMetricsCollector: Using existing instance (globalThis)",
      );
    }
    return globalThis.__ragMetricsCollector;
  }

  // 降级方案：如果 globalThis 不可用（边缘运行时），使用模块级变量
  // 注意：这在边缘运行时中可能不会跨请求共享

  let collectorInstance: RAGMetricsCollector | null = null;
  if (!collectorInstance) {
    collectorInstance = new RAGMetricsCollector(thresholds);
    logger.warn(
      {
        instanceId: collectorInstance.constructor.name,
        timestamp: new Date().toISOString(),
        storage: "module-level",
        warning:
          "Using module-level singleton - may not persist across requests in edge runtime",
      },
      "RAGMetricsCollector: New instance created (module-level fallback)",
    );
  }
  return collectorInstance;
}

/**
 * 重置收集器（用于测试）
 */
export function resetRAGMetricsCollector(): void {
  if (typeof globalThis !== "undefined") {
    globalThis.__ragMetricsCollector = undefined;
  }
}
