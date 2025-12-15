/**
 * Classification Metrics Tests
 *
 * V4.2.7: 分类指标收集器单元测试
 *
 * @version 1.0.0
 * @since 2025-12-15
 */

import {
  classificationMetrics,
  CLASSIFICATION_METRICS,
  TRUST_MODE_METRICS,
  FOLDER_METRICS,
  SYSTEM_METRICS,
  type MetricLabels,
  type TimingContext,
} from "../classification-metrics";

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

describe("ClassificationMetricsCollector", () => {
  beforeEach(() => {
    // Clear buffer before each test
    classificationMetrics.clearBuffer();
  });

  // --------------------------------------------------------------------------
  // Metric Constants
  // --------------------------------------------------------------------------

  describe("Metric Constants", () => {
    it("should export CLASSIFICATION_METRICS", () => {
      expect(CLASSIFICATION_METRICS.REQUESTS_TOTAL).toBe(
        "classification_requests_total",
      );
      expect(CLASSIFICATION_METRICS.SUCCESS_TOTAL).toBe(
        "classification_success_total",
      );
      expect(CLASSIFICATION_METRICS.FAILURES_TOTAL).toBe(
        "classification_failures_total",
      );
      expect(CLASSIFICATION_METRICS.LATENCY_MS).toBe(
        "classification_latency_ms",
      );
      expect(CLASSIFICATION_METRICS.CONFIDENCE_DISTRIBUTION).toBe(
        "classification_confidence",
      );
      expect(CLASSIFICATION_METRICS.USER_CORRECTIONS_TOTAL).toBe(
        "user_corrections_total",
      );
    });

    it("should export TRUST_MODE_METRICS", () => {
      expect(TRUST_MODE_METRICS.MODE_DISTRIBUTION).toBe(
        "trust_mode_distribution",
      );
      expect(TRUST_MODE_METRICS.MODE_SWITCHES_TOTAL).toBe(
        "trust_mode_switches_total",
      );
      expect(TRUST_MODE_METRICS.PENDING_CONFIRMATIONS).toBe(
        "pending_confirmations_gauge",
      );
    });

    it("should export FOLDER_METRICS", () => {
      expect(FOLDER_METRICS.AUTO_CREATE_TOTAL).toBe("folder_auto_create_total");
      expect(FOLDER_METRICS.AUTO_MERGE_TOTAL).toBe("folder_auto_merge_total");
    });

    it("should export SYSTEM_METRICS", () => {
      expect(SYSTEM_METRICS.AI_CALLS_TOTAL).toBe("ai_calls_total");
      expect(SYSTEM_METRICS.VECTOR_SEARCH_TOTAL).toBe("vector_search_total");
    });
  });

  // --------------------------------------------------------------------------
  // Basic Methods
  // --------------------------------------------------------------------------

  describe("Basic Methods", () => {
    describe("counter", () => {
      it("should record counter metric", () => {
        classificationMetrics.counter("test_counter", 1);
        const metrics = classificationMetrics.getBufferedMetrics();
        expect(metrics.length).toBeGreaterThanOrEqual(1);

        const lastMetric = metrics[metrics.length - 1];
        expect(lastMetric.name).toBe("test_counter");
        expect(lastMetric.type).toBe("counter");
        expect(lastMetric.value).toBe(1);
      });

      it("should default to value 1", () => {
        classificationMetrics.counter("test_counter_default");
        const metrics = classificationMetrics.getBufferedMetrics();
        const lastMetric = metrics[metrics.length - 1];
        expect(lastMetric.value).toBe(1);
      });

      it("should include labels", () => {
        const labels: MetricLabels = { trustMode: "full_auto", source: "ai" };
        classificationMetrics.counter("test_counter_labels", 1, labels);
        const metrics = classificationMetrics.getBufferedMetrics();
        const lastMetric = metrics[metrics.length - 1];
        expect(lastMetric.labels).toEqual(labels);
      });

      it("should include userId", () => {
        classificationMetrics.counter(
          "test_counter_user",
          1,
          undefined,
          "user-123",
        );
        const metrics = classificationMetrics.getBufferedMetrics();
        const lastMetric = metrics[metrics.length - 1];
        expect(lastMetric.userId).toBe("user-123");
      });
    });

    describe("gauge", () => {
      it("should record gauge metric", () => {
        classificationMetrics.gauge("test_gauge", 42);
        const metrics = classificationMetrics.getBufferedMetrics();
        const lastMetric = metrics[metrics.length - 1];
        expect(lastMetric.name).toBe("test_gauge");
        expect(lastMetric.type).toBe("gauge");
        expect(lastMetric.value).toBe(42);
      });
    });

    describe("histogram", () => {
      it("should record histogram metric", () => {
        classificationMetrics.histogram("test_histogram", 100);
        const metrics = classificationMetrics.getBufferedMetrics();
        const lastMetric = metrics[metrics.length - 1];
        expect(lastMetric.name).toBe("test_histogram");
        expect(lastMetric.type).toBe("histogram");
        expect(lastMetric.value).toBe(100);
      });
    });

    describe("timing", () => {
      it("should start timing and return context", () => {
        const context = classificationMetrics.startTiming("test_timing");
        expect(context.name).toBe("test_timing");
        expect(context.startTime).toBeLessThanOrEqual(Date.now());
      });

      it("should end timing and record duration", async () => {
        const context = classificationMetrics.startTiming("test_timing_end");

        // Wait a bit to have measurable duration
        await new Promise((resolve) => setTimeout(resolve, 10));

        const duration = classificationMetrics.endTiming(context);

        expect(duration).toBeGreaterThanOrEqual(10);
        const metrics = classificationMetrics.getBufferedMetrics();
        const lastMetric = metrics[metrics.length - 1];
        expect(lastMetric.name).toBe("test_timing_end");
        expect(lastMetric.type).toBe("timing");
      });

      it("should include labels in timing context", () => {
        const labels: MetricLabels = { source: "embedding" };
        const context = classificationMetrics.startTiming(
          "test_timing_labels",
          labels,
        );
        expect(context.labels).toEqual(labels);
      });
    });
  });

  // --------------------------------------------------------------------------
  // Classification Methods
  // --------------------------------------------------------------------------

  describe("Classification Methods", () => {
    describe("recordClassificationRequest", () => {
      it("should record request and return timing context", () => {
        const context = classificationMetrics.recordClassificationRequest(
          "user-123",
          { trustMode: "semi_auto" },
        );

        expect(context.name).toBe(CLASSIFICATION_METRICS.LATENCY_MS);
        const metrics = classificationMetrics.getBufferedMetrics();
        expect(
          metrics.some((m) => m.name === CLASSIFICATION_METRICS.REQUESTS_TOTAL),
        ).toBe(true);
      });
    });

    describe("recordClassificationSuccess", () => {
      it("should record success with high confidence", () => {
        const context: TimingContext = {
          startTime: Date.now() - 100,
          name: CLASSIFICATION_METRICS.LATENCY_MS,
        };

        classificationMetrics.recordClassificationSuccess(
          "user-123",
          85,
          context,
        );

        const metrics = classificationMetrics.getBufferedMetrics();
        expect(
          metrics.some((m) => m.name === CLASSIFICATION_METRICS.SUCCESS_TOTAL),
        ).toBe(true);
        expect(
          metrics.some(
            (m) => m.name === CLASSIFICATION_METRICS.CONFIDENCE_DISTRIBUTION,
          ),
        ).toBe(true);
      });

      it("should categorize confidence levels correctly", () => {
        const context: TimingContext = {
          startTime: Date.now(),
          name: CLASSIFICATION_METRICS.LATENCY_MS,
        };

        // High confidence (>= 80)
        classificationMetrics.clearBuffer();
        classificationMetrics.recordClassificationSuccess("u1", 85, context);
        let metrics = classificationMetrics.getBufferedMetrics();
        expect(
          metrics.some(
            (m) =>
              m.name === CLASSIFICATION_METRICS.SUCCESS_TOTAL &&
              m.labels?.confidenceLevel === "high",
          ),
        ).toBe(true);

        // Medium confidence (60-79)
        classificationMetrics.clearBuffer();
        classificationMetrics.recordClassificationSuccess("u2", 70, context);
        metrics = classificationMetrics.getBufferedMetrics();
        expect(
          metrics.some(
            (m) =>
              m.name === CLASSIFICATION_METRICS.SUCCESS_TOTAL &&
              m.labels?.confidenceLevel === "medium",
          ),
        ).toBe(true);

        // Low confidence (< 60)
        classificationMetrics.clearBuffer();
        classificationMetrics.recordClassificationSuccess("u3", 50, context);
        metrics = classificationMetrics.getBufferedMetrics();
        expect(
          metrics.some(
            (m) =>
              m.name === CLASSIFICATION_METRICS.SUCCESS_TOTAL &&
              m.labels?.confidenceLevel === "low",
          ),
        ).toBe(true);
      });
    });

    describe("recordClassificationFailure", () => {
      it("should record failure with error", () => {
        const context: TimingContext = {
          startTime: Date.now() - 100,
          name: CLASSIFICATION_METRICS.LATENCY_MS,
        };

        classificationMetrics.recordClassificationFailure(
          "user-123",
          "API_ERROR",
          context,
        );

        const metrics = classificationMetrics.getBufferedMetrics();
        expect(
          metrics.some((m) => m.name === CLASSIFICATION_METRICS.FAILURES_TOTAL),
        ).toBe(true);
      });
    });

    describe("recordUserCorrection", () => {
      it("should record user correction", () => {
        classificationMetrics.recordUserCorrection("user-123", 75);

        const metrics = classificationMetrics.getBufferedMetrics();
        expect(
          metrics.some(
            (m) => m.name === CLASSIFICATION_METRICS.USER_CORRECTIONS_TOTAL,
          ),
        ).toBe(true);
      });
    });

    describe("recordAutoDecision", () => {
      it("should record auto decision", () => {
        classificationMetrics.recordAutoDecision("user-123", {
          trustMode: "full_auto",
        });

        const metrics = classificationMetrics.getBufferedMetrics();
        expect(
          metrics.some(
            (m) => m.name === CLASSIFICATION_METRICS.AUTO_DECISIONS_TOTAL,
          ),
        ).toBe(true);
      });
    });
  });

  // --------------------------------------------------------------------------
  // Trust Mode Methods
  // --------------------------------------------------------------------------

  describe("Trust Mode Methods", () => {
    describe("recordModeSwitchEvent", () => {
      it("should record mode switch", () => {
        classificationMetrics.recordModeSwitchEvent(
          "user-123",
          "manual",
          "semi_auto",
        );

        const metrics = classificationMetrics.getBufferedMetrics();
        const switchMetric = metrics.find(
          (m) => m.name === TRUST_MODE_METRICS.MODE_SWITCHES_TOTAL,
        );
        expect(switchMetric).toBeDefined();
        expect(switchMetric?.labels?.fromMode).toBe("manual");
        expect(switchMetric?.labels?.toMode).toBe("semi_auto");
      });
    });

    describe("recordPendingConfirmations", () => {
      it("should record pending confirmations count", () => {
        classificationMetrics.recordPendingConfirmations(
          "user-123",
          5,
          "semi_auto",
        );

        const metrics = classificationMetrics.getBufferedMetrics();
        const pendingMetric = metrics.find(
          (m) => m.name === TRUST_MODE_METRICS.PENDING_CONFIRMATIONS,
        );
        expect(pendingMetric).toBeDefined();
        expect(pendingMetric?.value).toBe(5);
        expect(pendingMetric?.labels?.trustMode).toBe("semi_auto");
      });
    });

    describe("recordConfirmationResponse", () => {
      it("should record confirmation response", () => {
        classificationMetrics.recordConfirmationResponse(
          "user-123",
          true,
          1500,
          "semi_auto",
        );

        const metrics = classificationMetrics.getBufferedMetrics();
        const responseMetric = metrics.find(
          (m) => m.name === TRUST_MODE_METRICS.CONFIRMATION_RESPONSE_TIME_MS,
        );
        expect(responseMetric).toBeDefined();
        expect(responseMetric?.value).toBe(1500);
        expect(responseMetric?.labels?.accepted).toBe("true");
      });
    });
  });

  // --------------------------------------------------------------------------
  // Folder Methods
  // --------------------------------------------------------------------------

  describe("Folder Methods", () => {
    describe("recordFolderAutoCreate", () => {
      it("should record folder auto create", () => {
        classificationMetrics.recordFolderAutoCreate("user-123", "full_auto");

        const metrics = classificationMetrics.getBufferedMetrics();
        expect(
          metrics.some((m) => m.name === FOLDER_METRICS.AUTO_CREATE_TOTAL),
        ).toBe(true);
      });
    });

    describe("recordFolderAutoMerge", () => {
      it("should record folder auto merge", () => {
        classificationMetrics.recordFolderAutoMerge("user-123", "full_auto");

        const metrics = classificationMetrics.getBufferedMetrics();
        expect(
          metrics.some((m) => m.name === FOLDER_METRICS.AUTO_MERGE_TOTAL),
        ).toBe(true);
      });
    });
  });

  // --------------------------------------------------------------------------
  // System Methods
  // --------------------------------------------------------------------------

  describe("System Methods", () => {
    describe("recordAICall", () => {
      it("should record AI call with success", () => {
        classificationMetrics.recordAICall(500, true, "deepseek-chat");

        const metrics = classificationMetrics.getBufferedMetrics();
        expect(
          metrics.some((m) => m.name === SYSTEM_METRICS.AI_CALLS_TOTAL),
        ).toBe(true);
        expect(
          metrics.some((m) => m.name === SYSTEM_METRICS.AI_LATENCY_MS),
        ).toBe(true);
      });

      it("should record AI call with failure", () => {
        classificationMetrics.recordAICall(100, false);

        const metrics = classificationMetrics.getBufferedMetrics();
        const callMetric = metrics.find(
          (m) => m.name === SYSTEM_METRICS.AI_CALLS_TOTAL,
        );
        expect(callMetric?.labels?.success).toBe("false");
      });
    });

    describe("recordVectorSearch", () => {
      it("should record vector search", () => {
        classificationMetrics.recordVectorSearch(150, 10);

        const metrics = classificationMetrics.getBufferedMetrics();
        expect(
          metrics.some((m) => m.name === SYSTEM_METRICS.VECTOR_SEARCH_TOTAL),
        ).toBe(true);
        expect(
          metrics.some(
            (m) => m.name === SYSTEM_METRICS.VECTOR_SEARCH_LATENCY_MS,
          ),
        ).toBe(true);
      });
    });
  });

  // --------------------------------------------------------------------------
  // Buffer Management
  // --------------------------------------------------------------------------

  describe("Buffer Management", () => {
    it("should return buffered metrics", () => {
      classificationMetrics.counter("test_1");
      classificationMetrics.counter("test_2");

      const metrics = classificationMetrics.getBufferedMetrics();
      expect(metrics.length).toBe(2);
    });

    it("should clear buffer", () => {
      classificationMetrics.counter("test_clear");
      expect(classificationMetrics.getBufferedMetrics().length).toBe(1);

      classificationMetrics.clearBuffer();
      expect(classificationMetrics.getBufferedMetrics().length).toBe(0);
    });

    it("should include timestamp in metrics", () => {
      const before = Date.now();
      classificationMetrics.counter("test_timestamp");
      const after = Date.now();

      const metrics = classificationMetrics.getBufferedMetrics();
      expect(metrics[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(metrics[0].timestamp).toBeLessThanOrEqual(after);
    });
  });
});
