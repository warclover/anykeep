/**
 * Prometheus Exporter Tests
 *
 * V4.2.7: Prometheus 指标导出器单元测试
 *
 * @version 1.0.0
 * @since 2025-12-15
 */

import {
  generatePrometheusMetrics,
  resetMetrics,
  getMetricsSnapshot,
} from "../prometheus-exporter";
import { classificationMetrics } from "../classification-metrics";

// ============================================================================
// Mock Dependencies
// ============================================================================

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ============================================================================
// Tests
// ============================================================================

describe("PrometheusExporter", () => {
  beforeEach(() => {
    // Ensure metrics collection is enabled (may be disabled due to Jest module caching)
    classificationMetrics.setEnabled(true);
    // Reset all metrics before each test
    resetMetrics();
  });

  // --------------------------------------------------------------------------
  // generatePrometheusMetrics
  // --------------------------------------------------------------------------

  describe("generatePrometheusMetrics", () => {
    it("should return string output", () => {
      const output = generatePrometheusMetrics();
      expect(typeof output).toBe("string");
    });

    it("should include Node.js runtime metrics", () => {
      const output = generatePrometheusMetrics();
      expect(output).toContain("nodejs_heap_size_bytes");
      expect(output).toContain("nodejs_heap_used_bytes");
      expect(output).toContain("nodejs_uptime_seconds");
    });

    it("should include app_info metric", () => {
      const output = generatePrometheusMetrics();
      expect(output).toContain("app_info");
    });

    it("should format counters correctly", () => {
      // Record a counter metric
      classificationMetrics.counter("classification_requests_total");
      classificationMetrics.counter("classification_requests_total");

      const output = generatePrometheusMetrics();

      expect(output).toContain("# HELP classification_requests_total");
      expect(output).toContain("# TYPE classification_requests_total counter");
      expect(output).toContain("classification_requests_total");
    });

    it("should format gauges correctly", () => {
      classificationMetrics.gauge("pending_confirmations_gauge", 5);

      const output = generatePrometheusMetrics();

      expect(output).toContain("# HELP pending_confirmations_gauge");
      expect(output).toContain("# TYPE pending_confirmations_gauge gauge");
      expect(output).toContain("pending_confirmations_gauge");
    });

    it("should format histograms as summaries with quantiles", () => {
      classificationMetrics.setEnabled(true);

      // Record histogram values (keep under MAX_BUFFER_SIZE=100 to avoid flush)
      for (let i = 0; i < 50; i++) {
        classificationMetrics.histogram("classification_latency_ms", i * 10);
      }

      const output = generatePrometheusMetrics();

      expect(output).toContain("# HELP classification_latency_ms");
      expect(output).toContain("# TYPE classification_latency_ms summary");
      expect(output).toContain('quantile="0.5"');
      expect(output).toContain('quantile="0.9"');
      expect(output).toContain('quantile="0.99"');
      expect(output).toContain("classification_latency_ms_sum");
      expect(output).toContain("classification_latency_ms_count");
    });

    it("should include labels in Prometheus format", () => {
      classificationMetrics.counter("classification_requests_total", 1, {
        trustMode: "full_auto",
        source: "embedding",
      });

      const output = generatePrometheusMetrics();

      expect(output).toContain('trustMode="full_auto"');
      expect(output).toContain('source="embedding"');
    });

    it("should escape special characters in label values", () => {
      classificationMetrics.counter("test_metric", 1, {
        error: 'Quote "test"',
      });

      const output = generatePrometheusMetrics();

      // Double quotes should be escaped
      expect(output).toContain('\\"');
    });
  });

  // --------------------------------------------------------------------------
  // resetMetrics
  // --------------------------------------------------------------------------

  describe("resetMetrics", () => {
    it("should clear all metrics", () => {
      // Add some metrics
      classificationMetrics.counter("test_counter", 5);
      classificationMetrics.gauge("test_gauge", 10);
      classificationMetrics.histogram("test_histogram", 100);

      // Generate to process buffered metrics
      generatePrometheusMetrics();

      // Get snapshot before reset
      const beforeReset = getMetricsSnapshot();
      expect(Object.keys(beforeReset.counters).length).toBeGreaterThan(0);

      // Reset
      resetMetrics();

      // Get snapshot after reset
      const afterReset = getMetricsSnapshot();
      expect(Object.keys(afterReset.counters).length).toBe(0);
      expect(Object.keys(afterReset.gauges).length).toBe(0);
      expect(Object.keys(afterReset.histograms).length).toBe(0);
    });

    it("should clear classification metrics buffer", () => {
      classificationMetrics.counter("test");
      expect(classificationMetrics.getBufferedMetrics().length).toBeGreaterThan(
        0,
      );

      resetMetrics();

      expect(classificationMetrics.getBufferedMetrics().length).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // getMetricsSnapshot
  // --------------------------------------------------------------------------

  describe("getMetricsSnapshot", () => {
    it("should return counters", () => {
      classificationMetrics.counter("test_counter", 3);
      generatePrometheusMetrics();

      const snapshot = getMetricsSnapshot();
      expect(snapshot.counters).toBeDefined();
      expect(snapshot.counters["test_counter"]).toBe(3);
    });

    it("should return gauges", () => {
      classificationMetrics.gauge("test_gauge", 42);
      generatePrometheusMetrics();

      const snapshot = getMetricsSnapshot();
      expect(snapshot.gauges).toBeDefined();
      expect(snapshot.gauges["test_gauge"]).toBe(42);
    });

    it("should return histogram statistics", () => {
      // Add histogram values
      classificationMetrics.histogram("test_histogram", 10);
      classificationMetrics.histogram("test_histogram", 20);
      classificationMetrics.histogram("test_histogram", 30);
      classificationMetrics.histogram("test_histogram", 40);
      classificationMetrics.histogram("test_histogram", 50);
      generatePrometheusMetrics();

      const snapshot = getMetricsSnapshot();
      expect(snapshot.histograms).toBeDefined();
      expect(snapshot.histograms["test_histogram"]).toBeDefined();
      expect(snapshot.histograms["test_histogram"].count).toBe(5);
      expect(snapshot.histograms["test_histogram"].sum).toBe(150);
      expect(snapshot.histograms["test_histogram"].p50).toBeDefined();
      expect(snapshot.histograms["test_histogram"].p90).toBeDefined();
      expect(snapshot.histograms["test_histogram"].p99).toBeDefined();
    });

    it("should handle metrics with labels", () => {
      classificationMetrics.counter("labeled_metric", 1, {
        env: "test",
        version: "1.0",
      });
      generatePrometheusMetrics();

      const snapshot = getMetricsSnapshot();
      // Key should include labels
      const hasLabeledKey = Object.keys(snapshot.counters).some((k) =>
        k.includes("labeled_metric"),
      );
      expect(hasLabeledKey).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Counter Aggregation
  // --------------------------------------------------------------------------

  describe("Counter Aggregation", () => {
    it("should aggregate counter values", () => {
      classificationMetrics.counter("agg_counter", 1);
      classificationMetrics.counter("agg_counter", 2);
      classificationMetrics.counter("agg_counter", 3);
      generatePrometheusMetrics();

      const snapshot = getMetricsSnapshot();
      expect(snapshot.counters["agg_counter"]).toBe(6);
    });

    it("should keep separate counters for different labels", () => {
      classificationMetrics.counter("labeled_counter", 1, { type: "a" });
      classificationMetrics.counter("labeled_counter", 2, { type: "b" });
      classificationMetrics.counter("labeled_counter", 3, { type: "a" });
      generatePrometheusMetrics();

      const snapshot = getMetricsSnapshot();
      const typeAKey = Object.keys(snapshot.counters).find(
        (k) => k.includes("labeled_counter") && k.includes("type=a"),
      );
      const typeBKey = Object.keys(snapshot.counters).find(
        (k) => k.includes("labeled_counter") && k.includes("type=b"),
      );

      expect(typeAKey).toBeDefined();
      expect(typeBKey).toBeDefined();
      expect(snapshot.counters[typeAKey!]).toBe(4); // 1 + 3
      expect(snapshot.counters[typeBKey!]).toBe(2);
    });
  });

  // --------------------------------------------------------------------------
  // Gauge Behavior
  // --------------------------------------------------------------------------

  describe("Gauge Behavior", () => {
    it("should replace gauge value (not aggregate)", () => {
      classificationMetrics.gauge("test_gauge", 10);
      classificationMetrics.gauge("test_gauge", 20);
      classificationMetrics.gauge("test_gauge", 30);
      generatePrometheusMetrics();

      const snapshot = getMetricsSnapshot();
      expect(snapshot.gauges["test_gauge"]).toBe(30); // Last value wins
    });
  });

  // --------------------------------------------------------------------------
  // Histogram Percentiles
  // --------------------------------------------------------------------------

  describe("Histogram Percentiles", () => {
    it("should calculate correct percentiles", () => {
      classificationMetrics.setEnabled(true);
      // Add values 1-50 (keep under MAX_BUFFER_SIZE=100 to avoid flush)
      for (let i = 1; i <= 50; i++) {
        classificationMetrics.histogram("percentile_test", i);
      }
      generatePrometheusMetrics();

      const snapshot = getMetricsSnapshot();
      const hist = snapshot.histograms["percentile_test"];

      expect(hist).toBeDefined();
      // For values 1-50: p50 should be around 25, p90 around 45, p99 around 50
      expect(hist.p50).toBeGreaterThanOrEqual(20);
      expect(hist.p50).toBeLessThanOrEqual(30);
      expect(hist.p90).toBeGreaterThanOrEqual(40);
      expect(hist.p90).toBeLessThanOrEqual(50);
      expect(hist.p99).toBeGreaterThanOrEqual(45);
    });

    it("should handle empty histogram", () => {
      // Don't add any histogram values
      generatePrometheusMetrics();

      const snapshot = getMetricsSnapshot();
      expect(snapshot.histograms["empty_histogram"]).toBeUndefined();
    });

    it("should handle single value histogram", () => {
      classificationMetrics.setEnabled(true);
      classificationMetrics.histogram("single_value", 100);
      generatePrometheusMetrics();

      const snapshot = getMetricsSnapshot();
      expect(snapshot.histograms["single_value"]).toBeDefined();
      expect(snapshot.histograms["single_value"].count).toBe(1);
      expect(snapshot.histograms["single_value"].sum).toBe(100);
      expect(snapshot.histograms["single_value"].p50).toBe(100);
    });
  });

  // --------------------------------------------------------------------------
  // Prometheus Format Compliance
  // --------------------------------------------------------------------------

  describe("Prometheus Format Compliance", () => {
    it("should include HELP comments", () => {
      classificationMetrics.counter("classification_requests_total");
      const output = generatePrometheusMetrics();

      expect(output).toMatch(/^# HELP classification_requests_total/m);
    });

    it("should include TYPE comments", () => {
      classificationMetrics.counter("classification_requests_total");
      const output = generatePrometheusMetrics();

      expect(output).toMatch(/^# TYPE classification_requests_total counter/m);
    });

    it("should format metric lines correctly", () => {
      classificationMetrics.counter("simple_counter", 42);
      const output = generatePrometheusMetrics();

      // Should contain metric name followed by value
      expect(output).toMatch(/simple_counter\s+\d+/);
    });

    it("should format labels with curly braces", () => {
      classificationMetrics.counter("labeled_metric", 1, {
        label1: "value1",
        label2: "value2",
      });
      const output = generatePrometheusMetrics();

      expect(output).toMatch(/labeled_metric\{.*\}\s+\d+/);
    });
  });

  // --------------------------------------------------------------------------
  // Edge Cases
  // --------------------------------------------------------------------------

  describe("Edge Cases", () => {
    it("should handle undefined labels gracefully", () => {
      classificationMetrics.counter("test", 1, {
        defined: "yes",
        undef: undefined,
      });
      const output = generatePrometheusMetrics();

      expect(output).not.toContain("undef");
      expect(output).toContain('defined="yes"');
    });

    it("should handle numeric label values", () => {
      classificationMetrics.counter("test", 1, {
        count: 5,
        rate: 0.5,
      } as Record<string, string | number | boolean | undefined>);
      const output = generatePrometheusMetrics();

      expect(output).toContain('count="5"');
      expect(output).toContain('rate="0.5"');
    });

    it("should handle boolean label values", () => {
      classificationMetrics.counter("test", 1, {
        success: true,
      } as Record<string, string | number | boolean | undefined>);
      const output = generatePrometheusMetrics();

      expect(output).toContain('success="true"');
    });

    it("should handle multiple histogram values within buffer limit", () => {
      classificationMetrics.setEnabled(true);
      // Add values within MAX_BUFFER_SIZE (100) to avoid flush
      for (let i = 0; i < 50; i++) {
        classificationMetrics.histogram("multi_histogram", i * 10);
      }
      generatePrometheusMetrics();

      const snapshot = getMetricsSnapshot();
      expect(snapshot.histograms["multi_histogram"]).toBeDefined();
      expect(snapshot.histograms["multi_histogram"].count).toBe(50);
      // Sum should be 0+10+20+...+490 = 10*(0+1+2+...+49) = 10*49*50/2 = 12250
      expect(snapshot.histograms["multi_histogram"].sum).toBe(12250);
    });
  });
});
