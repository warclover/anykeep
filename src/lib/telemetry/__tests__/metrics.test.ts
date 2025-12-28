/**
 * 性能指标模块测试
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  metricsCollector,
  initMetrics,
  apiMetrics,
  agentMetrics,
  toolMetrics,
  dbMetrics,
  cacheMetrics,
  recordApiRequest,
  recordAgentResponse,
  recordToolCall,
  recordDbQuery,
  recordCacheAccess,
  METRIC_NAMES,
  DEFAULT_ALERT_THRESHOLDS,
} from "../index";

describe("metrics", () => {
  beforeEach(() => {
    // 重置指标状态
    metricsCollector.reset();
    initMetrics({ enabled: true, consoleExport: false });
  });

  describe("metricsCollector", () => {
    describe("Counter", () => {
      it("should create and increment counter", () => {
        const counter = metricsCollector.createCounter(
          "test.counter",
          "Test counter",
        );

        counter.inc();
        counter.inc();
        counter.add(5);

        const dataPoints = metricsCollector.collect();
        const testCounter = dataPoints.find((dp) => dp.name === "test.counter");

        expect(testCounter).toBeDefined();
        expect(testCounter?.value).toBe(7);
      });

      it("should support labels", () => {
        const counter = metricsCollector.createCounter(
          "test.labeled.counter",
          "Test labeled counter",
        );

        counter.inc({ status: "success" });
        counter.inc({ status: "success" });
        counter.inc({ status: "error" });

        const dataPoints = metricsCollector.collect();
        const successCounter = dataPoints.find(
          (dp) =>
            dp.name === "test.labeled.counter" &&
            dp.labels.status === "success",
        );
        const errorCounter = dataPoints.find(
          (dp) =>
            dp.name === "test.labeled.counter" && dp.labels.status === "error",
        );

        expect(successCounter?.value).toBe(2);
        expect(errorCounter?.value).toBe(1);
      });
    });

    describe("Histogram", () => {
      it("should record values and calculate average", () => {
        const histogram = metricsCollector.createHistogram(
          "test.histogram",
          "Test histogram",
          { unit: "ms" },
        );

        histogram.record(100);
        histogram.record(200);
        histogram.record(300);

        const dataPoints = metricsCollector.collect();
        const testHistogram = dataPoints.find(
          (dp) => dp.name === "test.histogram",
        );

        expect(testHistogram).toBeDefined();
        expect(testHistogram?.value).toBe(200); // 平均值
      });

      it("should populate buckets correctly", () => {
        const histogram = metricsCollector.createHistogram(
          "test.bucket.histogram",
          "Test bucket histogram",
          { buckets: [10, 50, 100, 500] },
        );

        histogram.record(5); // bucket 10
        histogram.record(25); // bucket 50
        histogram.record(75); // bucket 100
        histogram.record(250); // bucket 500

        const dataPoints = metricsCollector.collect();
        const testHistogram = dataPoints.find(
          (dp) => dp.name === "test.bucket.histogram",
        );

        expect(testHistogram?.buckets).toBeDefined();
        expect(testHistogram?.buckets).toHaveLength(4);
        expect(testHistogram?.buckets?.[0]).toEqual({ bound: 10, count: 1 });
        expect(testHistogram?.buckets?.[1]).toEqual({ bound: 50, count: 2 });
        expect(testHistogram?.buckets?.[2]).toEqual({ bound: 100, count: 3 });
        expect(testHistogram?.buckets?.[3]).toEqual({ bound: 500, count: 4 });
      });

      it("should support startTimer", async () => {
        const histogram = metricsCollector.createHistogram(
          "test.timer.histogram",
          "Test timer histogram",
        );

        const endTimer = histogram.startTimer();
        await new Promise((resolve) => setTimeout(resolve, 50));
        const duration = endTimer();

        expect(duration).toBeGreaterThanOrEqual(40);
        expect(duration).toBeLessThan(200);
      });
    });

    describe("Gauge", () => {
      it("should set, increment, and decrement values", () => {
        const gauge = metricsCollector.createGauge("test.gauge", "Test gauge");

        gauge.set(100);
        gauge.inc(10);
        gauge.dec(5);

        const dataPoints = metricsCollector.collect();
        const testGauge = dataPoints.find((dp) => dp.name === "test.gauge");

        expect(testGauge?.value).toBe(105);
      });
    });

    describe("getStats", () => {
      it("should return correct statistics", () => {
        metricsCollector.createCounter("c1", "Counter 1");
        metricsCollector.createCounter("c2", "Counter 2");
        metricsCollector.createHistogram("h1", "Histogram 1");
        metricsCollector.createGauge("g1", "Gauge 1");

        const stats = metricsCollector.getStats();

        expect(stats.totalMetrics).toBeGreaterThanOrEqual(4);
        expect(stats.counters).toBeGreaterThanOrEqual(2);
        expect(stats.histograms).toBeGreaterThanOrEqual(1);
        expect(stats.gauges).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe("Pre-defined metrics", () => {
    it("should have API metrics defined", () => {
      expect(apiMetrics.latency).toBeDefined();
      expect(apiMetrics.requests).toBeDefined();
      expect(apiMetrics.errors).toBeDefined();
    });

    it("should have Agent metrics defined", () => {
      expect(agentMetrics.responseTime).toBeDefined();
      expect(agentMetrics.requests).toBeDefined();
      expect(agentMetrics.tokensUsed).toBeDefined();
    });

    it("should have Tool metrics defined", () => {
      expect(toolMetrics.calls).toBeDefined();
      expect(toolMetrics.latency).toBeDefined();
      expect(toolMetrics.errors).toBeDefined();
    });

    it("should have DB metrics defined", () => {
      expect(dbMetrics.queryLatency).toBeDefined();
      expect(dbMetrics.queries).toBeDefined();
      expect(dbMetrics.activeConnections).toBeDefined();
    });

    it("should have Cache metrics defined", () => {
      expect(cacheMetrics.hits).toBeDefined();
      expect(cacheMetrics.misses).toBeDefined();
      expect(cacheMetrics.size).toBeDefined();
    });
  });

  describe("Convenience functions", () => {
    describe("recordApiRequest", () => {
      it("should record successful request", () => {
        recordApiRequest("/api/bookmarks", "GET", 200, 150);

        const dataPoints = metricsCollector.collect();
        const latency = dataPoints.find(
          (dp) =>
            dp.name === METRIC_NAMES.API_LATENCY &&
            dp.labels.route === "/api/bookmarks",
        );
        const requests = dataPoints.find(
          (dp) =>
            dp.name === METRIC_NAMES.API_REQUESTS_TOTAL &&
            dp.labels.route === "/api/bookmarks",
        );

        expect(latency).toBeDefined();
        expect(requests).toBeDefined();
      });

      it("should record error request", () => {
        recordApiRequest("/api/bookmarks", "POST", 500, 100);

        const dataPoints = metricsCollector.collect();
        const errors = dataPoints.find(
          (dp) =>
            dp.name === METRIC_NAMES.API_ERRORS_TOTAL &&
            dp.labels.route === "/api/bookmarks",
        );

        expect(errors).toBeDefined();
        expect(errors?.labels.error_type).toBe("server");
      });

      it("should classify client errors correctly", () => {
        recordApiRequest("/api/bookmarks", "POST", 400, 50);

        const dataPoints = metricsCollector.collect();
        const errors = dataPoints.find(
          (dp) =>
            dp.name === METRIC_NAMES.API_ERRORS_TOTAL &&
            dp.labels.status_code === "400",
        );

        expect(errors?.labels.error_type).toBe("client");
      });
    });

    describe("recordAgentResponse", () => {
      it("should record successful response", () => {
        recordAgentResponse("deepseek-chat", 1500, 500, true);

        const dataPoints = metricsCollector.collect();
        const responseTime = dataPoints.find(
          (dp) =>
            dp.name === METRIC_NAMES.AGENT_RESPONSE_TIME &&
            dp.labels.model === "deepseek-chat",
        );
        const tokens = dataPoints.find(
          (dp) =>
            dp.name === METRIC_NAMES.AGENT_TOKENS_USED &&
            dp.labels.model === "deepseek-chat",
        );

        expect(responseTime).toBeDefined();
        expect(tokens).toBeDefined();
      });

      it("should record failed response", () => {
        recordAgentResponse("deepseek-chat", 500, 0, false);

        const dataPoints = metricsCollector.collect();
        const requests = dataPoints.find(
          (dp) =>
            dp.name === METRIC_NAMES.AGENT_REQUESTS_TOTAL &&
            dp.labels.status === "error",
        );

        expect(requests).toBeDefined();
      });
    });

    describe("recordToolCall", () => {
      it("should record successful tool call", () => {
        recordToolCall("search_bookmarks", 200, true);

        const dataPoints = metricsCollector.collect();
        const calls = dataPoints.find(
          (dp) =>
            dp.name === METRIC_NAMES.TOOL_CALLS_TOTAL &&
            dp.labels.tool === "search_bookmarks" &&
            dp.labels.status === "success",
        );

        expect(calls).toBeDefined();
      });

      it("should record failed tool call with error type", () => {
        recordToolCall("move_bookmark", 100, false, "validation");

        const dataPoints = metricsCollector.collect();
        const errors = dataPoints.find(
          (dp) =>
            dp.name === METRIC_NAMES.TOOL_ERRORS_TOTAL &&
            dp.labels.tool === "move_bookmark",
        );

        expect(errors).toBeDefined();
        expect(errors?.labels.error_type).toBe("validation");
      });
    });

    describe("recordDbQuery", () => {
      it("should record successful query", () => {
        recordDbQuery("select", "bookmarks", 50, true);

        const dataPoints = metricsCollector.collect();
        const latency = dataPoints.find(
          (dp) =>
            dp.name === METRIC_NAMES.DB_QUERY_LATENCY &&
            dp.labels.operation === "select" &&
            dp.labels.table === "bookmarks",
        );

        expect(latency).toBeDefined();
      });
    });

    describe("recordCacheAccess", () => {
      it("should record cache hit", () => {
        recordCacheAccess("memory", true);

        const dataPoints = metricsCollector.collect();
        const hits = dataPoints.find(
          (dp) =>
            dp.name === METRIC_NAMES.CACHE_HIT_TOTAL &&
            dp.labels.cache_layer === "memory",
        );

        expect(hits).toBeDefined();
      });

      it("should record cache miss", () => {
        recordCacheAccess("vector", false);

        const dataPoints = metricsCollector.collect();
        const misses = dataPoints.find(
          (dp) =>
            dp.name === METRIC_NAMES.CACHE_MISS_TOTAL &&
            dp.labels.cache_layer === "vector",
        );

        expect(misses).toBeDefined();
      });
    });
  });

  describe("Alert thresholds", () => {
    it("should have correct default thresholds", () => {
      expect(DEFAULT_ALERT_THRESHOLDS.apiLatencyP95).toBe(3000);
      expect(DEFAULT_ALERT_THRESHOLDS.agentResponseTime).toBe(15000);
      expect(DEFAULT_ALERT_THRESHOLDS.toolSuccessRate).toBe(95);
      expect(DEFAULT_ALERT_THRESHOLDS.dbQueryLatency).toBe(500);
      expect(DEFAULT_ALERT_THRESHOLDS.heapUsagePercent).toBe(80);
    });
  });

  describe("Disabled metrics", () => {
    it("should not record when disabled", () => {
      initMetrics({ enabled: false });
      metricsCollector.reset();

      const counter = metricsCollector.createCounter(
        "disabled.counter",
        "Disabled counter",
      );
      counter.inc();
      counter.inc();

      const dataPoints = metricsCollector.collect();
      const testCounter = dataPoints.find(
        (dp) => dp.name === "disabled.counter",
      );

      // 即使禁用，也会创建指标，但值应该为 0
      expect(testCounter?.value ?? 0).toBe(0);
    });
  });
});
