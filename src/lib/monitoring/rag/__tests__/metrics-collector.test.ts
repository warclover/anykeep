/**
 * RAG 指标收集器测试
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import {
  RAGMetricsCollector,
  getRAGMetricsCollector,
  resetRAGMetricsCollector,
} from "../metrics-collector";

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock vector cache
jest.mock("@/lib/cache", () => ({
  getVectorCache: jest.fn(() => ({
    getStats: jest.fn(() => ({
      size: 100,
      hitRate: 0.75,
      hits: 150,
      misses: 50,
    })),
  })),
}));

// ============================================================================
// 测试套件
// ============================================================================

describe("RAGMetricsCollector", () => {
  let collector: RAGMetricsCollector;

  beforeEach(() => {
    resetRAGMetricsCollector();
    collector = new RAGMetricsCollector();
  });

  describe("recordSearch", () => {
    it("应该正确记录搜索请求", () => {
      collector.recordSearch(150, 10, 0.85, "user-123");

      const metrics = collector.collectMetrics();
      expect(metrics.avgResultCount).toBe(10);
      expect(metrics.avgSimilarityScore).toBe(0.85);
    });

    it("多次记录应该正确计算平均值", () => {
      collector.recordSearch(100, 5, 0.9);
      collector.recordSearch(200, 15, 0.7);

      const metrics = collector.collectMetrics();
      expect(metrics.searchLatencyAvg).toBe(150);
      expect(metrics.avgResultCount).toBe(10);
      expect(metrics.avgSimilarityScore).toBe(0.8);
    });

    it("高延迟应该触发告警", () => {
      collector.recordSearch(1500, 10, 0.85); // 超过 critical 阈值

      const alerts = collector.getAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].type).toBe("latency");
      expect(alerts[0].level).toBe("critical");
    });

    it("零结果应该被正确统计", () => {
      collector.recordSearch(100, 0, 0);
      collector.recordSearch(100, 10, 0.85);

      const metrics = collector.collectMetrics();
      expect(metrics.zeroResultRate).toBe(0.5);
    });
  });

  describe("recordApiCall", () => {
    it("应该正确记录 embedding 调用", () => {
      collector.recordApiCall("embedding", 1000);

      const metrics = collector.collectMetrics();
      expect(metrics.embeddingApiCalls).toBe(1);
    });

    it("应该正确记录 rerank 调用", () => {
      collector.recordApiCall("rerank", 500);

      const metrics = collector.collectMetrics();
      expect(metrics.rerankApiCalls).toBe(1);
    });

    it("应该正确记录 LLM 调用并计算成本", () => {
      collector.recordApiCall("llm", 10000, "deepseek");

      const metrics = collector.collectMetrics();
      expect(metrics.llmTokensUsed).toBe(10000);
      expect(metrics.estimatedCostCNY).toBeGreaterThan(0);
    });

    it("应该正确累计成本", () => {
      collector.recordApiCall("embedding", 1000);
      collector.recordApiCall("rerank", 500);
      collector.recordApiCall("llm", 10000);

      const metrics = collector.collectMetrics();
      expect(metrics.estimatedCostCNY).toBeGreaterThan(0);
    });
  });

  describe("collectMetrics", () => {
    it("空记录应该返回默认值", () => {
      const metrics = collector.collectMetrics();

      expect(metrics.searchLatencyP50).toBe(0);
      expect(metrics.searchLatencyP95).toBe(0);
      expect(metrics.searchLatencyAvg).toBe(0);
      expect(metrics.avgResultCount).toBe(0);
      expect(metrics.zeroResultRate).toBe(0);
      expect(metrics.embeddingApiCalls).toBe(0);
      expect(metrics.rerankApiCalls).toBe(0);
      expect(metrics.llmTokensUsed).toBe(0);
    });

    it("应该返回正确的时间范围", () => {
      const metrics = collector.collectMetrics();

      expect(metrics.periodStart).toBeDefined();
      expect(metrics.periodEnd).toBeDefined();
      expect(new Date(metrics.periodEnd).getTime()).toBeGreaterThan(
        new Date(metrics.periodStart).getTime(),
      );
    });

    it("应该计算正确的百分位数", () => {
      // 记录 10 次搜索，延迟从 100 到 1000
      for (let i = 1; i <= 10; i++) {
        collector.recordSearch(i * 100, 10, 0.85);
      }

      const metrics = collector.collectMetrics();
      expect(metrics.searchLatencyP50).toBe(500);
      // P95 对于 10 个元素，会取第 10 个（index 9）
      expect(metrics.searchLatencyP95).toBe(1000);
    });
  });

  describe("getAlerts", () => {
    it("应该返回最近的告警", () => {
      collector.recordSearch(1500, 10, 0.85); // 触发延迟告警

      const alerts = collector.getAlerts();
      expect(alerts.length).toBeGreaterThan(0);
    });

    it("应该支持限制返回数量", () => {
      // 触发多个告警
      for (let i = 0; i < 5; i++) {
        collector.recordSearch(1500, 10, 0.85);
      }

      const limitedAlerts = collector.getAlerts(3);
      expect(limitedAlerts.length).toBeLessThanOrEqual(3);
    });
  });

  describe("clearAlerts", () => {
    it("应该清除所有告警", () => {
      collector.recordSearch(1500, 10, 0.85); // 触发告警
      expect(collector.getAlerts().length).toBeGreaterThan(0);

      collector.clearAlerts();
      expect(collector.getAlerts().length).toBe(0);
    });
  });

  describe("getDailyStats", () => {
    it("应该返回今日统计", () => {
      collector.recordSearch(100, 10, 0.85, "user-1");
      collector.recordSearch(150, 8, 0.9, "user-2");
      collector.recordSearch(200, 0, 0, "user-1");

      const stats = collector.getDailyStats();

      expect(stats.date).toBe(new Date().toISOString().split("T")[0]);
      expect(stats.totalSearches).toBe(3);
      expect(stats.uniqueUsers).toBe(2);
      expect(stats.avgLatencyMs).toBe(150);
      expect(stats.zeroResultRate).toBeCloseTo(1 / 3, 2);
    });
  });
});

describe("getRAGMetricsCollector", () => {
  afterEach(() => {
    resetRAGMetricsCollector();
  });

  it("应该返回单例实例", () => {
    const instance1 = getRAGMetricsCollector();
    const instance2 = getRAGMetricsCollector();

    expect(instance1).toBe(instance2);
  });

  it("resetRAGMetricsCollector 应该重置单例", () => {
    const instance1 = getRAGMetricsCollector();
    resetRAGMetricsCollector();
    const instance2 = getRAGMetricsCollector();

    expect(instance1).not.toBe(instance2);
  });
});
