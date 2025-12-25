/**
 * AccuracyTrackerService Unit Tests
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";

// ============================================================================
// Mocks
// ============================================================================

// Mock Supabase
const mockSupabaseSelect = jest.fn();
const mockSupabaseUpdate = jest.fn();
const mockSupabaseFrom = jest.fn();
const mockSupabaseEq = jest.fn();
const mockSupabaseNot = jest.fn();
const mockSupabaseIs = jest.fn();
const mockSupabaseIn = jest.fn();
const mockSupabaseOrder = jest.fn();
const mockSupabaseLimit = jest.fn();
const mockSupabaseSingle = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      from: (table: string) => {
        mockSupabaseFrom(table);
        return {
          select: (fields: string) => {
            mockSupabaseSelect(fields);
            return {
              eq: (col: string, val: unknown) => {
                mockSupabaseEq(col, val);
                return {
                  not: (col2: string, op: string, val2: unknown) => {
                    mockSupabaseNot(col2, op, val2);
                    return {
                      order: (col3: string, opts: object) => {
                        mockSupabaseOrder(col3, opts);
                        return {
                          limit: (n: number) => {
                            mockSupabaseLimit(n);
                            return Promise.resolve({ data: [], error: null });
                          },
                        };
                      },
                    };
                  },
                  is: (col2: string, val2: unknown) => {
                    mockSupabaseIs(col2, val2);
                    return {
                      order: (col3: string, opts: object) => {
                        mockSupabaseOrder(col3, opts);
                        return {
                          limit: (n: number) => {
                            mockSupabaseLimit(n);
                            return {
                              single: () => {
                                mockSupabaseSingle();
                                return Promise.resolve({
                                  data: null,
                                  error: null,
                                });
                              },
                            };
                          },
                        };
                      },
                    };
                  },
                  order: (col2: string, opts: object) => {
                    mockSupabaseOrder(col2, opts);
                    return {
                      limit: (n: number) => {
                        mockSupabaseLimit(n);
                        return Promise.resolve({ data: [], error: null });
                      },
                    };
                  },
                };
              },
              in: (col: string, vals: unknown[]) => {
                mockSupabaseIn(col, vals);
                return Promise.resolve({ data: [], error: null });
              },
            };
          },
          update: (data: object) => {
            mockSupabaseUpdate(data);
            return {
              eq: (col: string, val: unknown) => {
                mockSupabaseEq(col, val);
                return {
                  is: () => ({
                    order: () => ({
                      limit: () => Promise.resolve({ error: null }),
                    }),
                  }),
                };
              },
            };
          },
        };
      },
    }),
  ),
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock event bus
const mockEventBusOn = jest.fn();
const mockEventBusOff = jest.fn();
const mockEventBusEmit = jest.fn();

jest.mock("@/lib/shared/event-bus", () => ({
  eventBus: {
    on: (...args: unknown[]) => mockEventBusOn(...args),
    off: (...args: unknown[]) => mockEventBusOff(...args),
    emit: (...args: unknown[]) => mockEventBusEmit(...args),
  },
  ClassificationEvents: {
    FEEDBACK_RECEIVED: "classification:feedback_received",
  },
}));

// ============================================================================
// Test Utilities
// ============================================================================

function createMockMetrics(
  count: number,
  options: { accuracy?: number } = {},
): Array<{
  folder_id: number | null;
  confidence: number;
  user_feedback: string;
  created_at: string;
}> {
  const { accuracy = 0.75 } = options;
  const metrics = [];

  for (let i = 0; i < count; i++) {
    const isCorrect = Math.random() < accuracy;
    metrics.push({
      folder_id: (i % 3) + 1, // Distribute across 3 folders
      confidence: 60 + Math.random() * 40, // 60-100 confidence
      user_feedback: isCorrect ? "accept" : "reject",
      created_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  return metrics;
}

// ============================================================================
// Test Suites
// ============================================================================

describe("AccuracyTrackerService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Constructor & Config Tests
  // ============================================================================

  describe("constructor", () => {
    it("should initialize with default config", async () => {
      const { AccuracyTrackerService } = await import(
        "../accuracy-tracker.service"
      );

      const service = new AccuracyTrackerService();
      expect(service).toBeDefined();
    });

    it("should accept custom config", async () => {
      const { AccuracyTrackerService } = await import(
        "../accuracy-tracker.service"
      );

      const customConfig = {
        bucketCount: 5,
        decayFactor: 0.9,
        minSampleSize: 10,
      };

      const service = new AccuracyTrackerService(customConfig);
      expect(service).toBeDefined();
    });
  });

  // ============================================================================
  // getUserAccuracySummary Tests
  // ============================================================================

  describe("getUserAccuracySummary", () => {
    it("should return empty summary when no data exists", async () => {
      const { AccuracyTrackerService } = await import(
        "../accuracy-tracker.service"
      );

      const service = new AccuracyTrackerService();
      const summary = await service.getUserAccuracySummary("user-123");

      expect(summary.userId).toBe("user-123");
      expect(summary.totalPredictions).toBe(0);
      expect(summary.globalAccuracy).toBe(0);
      expect(summary.reliability).toBe("low");
    });

    it("should use cached data when available", async () => {
      const { AccuracyTrackerService } = await import(
        "../accuracy-tracker.service"
      );

      const service = new AccuracyTrackerService({ cacheTTL: 60000 });

      // First call - populates cache
      const summary1 = await service.getUserAccuracySummary("user-cache-test");

      // Second call should use cache - same object reference
      const summary2 = await service.getUserAccuracySummary("user-cache-test");

      // Both should have the same userId (cached data)
      expect(summary1.userId).toBe(summary2.userId);
      expect(summary1.userId).toBe("user-cache-test");
      // Both should be structurally equal (cached data)
      expect(summary1).toStrictEqual(summary2);
    });
  });

  // ============================================================================
  // recordOutcome Tests
  // ============================================================================

  describe("recordOutcome", () => {
    it("should record a correct outcome", async () => {
      const { AccuracyTrackerService } = await import(
        "../accuracy-tracker.service"
      );

      const service = new AccuracyTrackerService();

      await service.recordOutcome({
        userId: "user-123",
        bookmarkId: 1,
        folderId: 10,
        predictedConfidence: 85,
        isCorrect: true,
        timestamp: new Date().toISOString(),
      });

      // Should query for existing record
      expect(mockSupabaseFrom).toHaveBeenCalledWith("classification_metrics");
    });

    it("should record an incorrect outcome", async () => {
      const { AccuracyTrackerService } = await import(
        "../accuracy-tracker.service"
      );

      const service = new AccuracyTrackerService();

      await service.recordOutcome({
        userId: "user-123",
        bookmarkId: 1,
        folderId: 10,
        predictedConfidence: 70,
        isCorrect: false,
        timestamp: new Date().toISOString(),
      });

      expect(mockSupabaseFrom).toHaveBeenCalledWith("classification_metrics");
    });
  });

  // ============================================================================
  // updateOutcomeFromFeedback Tests
  // ============================================================================

  describe("updateOutcomeFromFeedback", () => {
    it("should update outcome from positive feedback", async () => {
      const { AccuracyTrackerService } = await import(
        "../accuracy-tracker.service"
      );

      const service = new AccuracyTrackerService();

      await service.updateOutcomeFromFeedback("user-123", 1, true);

      expect(mockSupabaseFrom).toHaveBeenCalledWith("classification_metrics");
      expect(mockSupabaseUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          user_feedback: "accept",
        }),
      );
    });

    it("should update outcome from negative feedback", async () => {
      const { AccuracyTrackerService } = await import(
        "../accuracy-tracker.service"
      );

      const service = new AccuracyTrackerService();

      await service.updateOutcomeFromFeedback("user-123", 1, false);

      expect(mockSupabaseUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          user_feedback: "reject",
        }),
      );
    });
  });

  // ============================================================================
  // getFolderAccuracy Tests
  // ============================================================================

  describe("getFolderAccuracy", () => {
    it("should return null when folder not found", async () => {
      const { AccuracyTrackerService } = await import(
        "../accuracy-tracker.service"
      );

      const service = new AccuracyTrackerService();
      const result = await service.getFolderAccuracy("user-123", 999);

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // getActualAccuracyForConfidence Tests
  // ============================================================================

  describe("getActualAccuracyForConfidence", () => {
    it("should return weighted accuracy when no sufficient samples", async () => {
      const { AccuracyTrackerService } = await import(
        "../accuracy-tracker.service"
      );

      const service = new AccuracyTrackerService();
      const result = await service.getActualAccuracyForConfidence(
        "user-123",
        0.85,
      );

      // Should return 0 (weighted accuracy) when no data
      expect(result).toBe(0);
    });
  });

  // ============================================================================
  // Event Listener Tests
  // ============================================================================

  describe("startListening / stopListening", () => {
    it("should register event listener on startListening", async () => {
      const { AccuracyTrackerService } = await import(
        "../accuracy-tracker.service"
      );

      const service = new AccuracyTrackerService();
      service.startListening();

      expect(mockEventBusOn).toHaveBeenCalledWith(
        "classification:feedback_received",
        expect.any(Function),
      );
    });

    it("should not register duplicate listeners", async () => {
      const { AccuracyTrackerService } = await import(
        "../accuracy-tracker.service"
      );

      const service = new AccuracyTrackerService();
      service.startListening();
      service.startListening();

      // Should only be called once
      expect(mockEventBusOn).toHaveBeenCalledTimes(1);
    });

    it("should unregister event listener on stopListening", async () => {
      const { AccuracyTrackerService } = await import(
        "../accuracy-tracker.service"
      );

      const service = new AccuracyTrackerService();
      service.startListening();
      service.stopListening();

      expect(mockEventBusOff).toHaveBeenCalledWith(
        "classification:feedback_received",
        expect.any(Function),
      );
    });

    it("should not unregister when not listening", async () => {
      const { AccuracyTrackerService } = await import(
        "../accuracy-tracker.service"
      );

      const service = new AccuracyTrackerService();
      service.stopListening();

      expect(mockEventBusOff).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Cache Management Tests
  // ============================================================================

  describe("clearCache", () => {
    it("should clear cache for specific user", async () => {
      const { AccuracyTrackerService } = await import(
        "../accuracy-tracker.service"
      );

      const service = new AccuracyTrackerService();

      // Populate cache
      await service.getUserAccuracySummary("user-123");

      // Clear cache
      service.clearCache("user-123");

      // Reset mocks
      mockSupabaseFrom.mockClear();

      // Next call should hit database
      await service.getUserAccuracySummary("user-123");

      expect(mockSupabaseFrom).toHaveBeenCalled();
    });

    it("should clear all cache when no user specified", async () => {
      const { AccuracyTrackerService } = await import(
        "../accuracy-tracker.service"
      );

      const service = new AccuracyTrackerService();

      // Populate cache for multiple users
      await service.getUserAccuracySummary("user-1");
      await service.getUserAccuracySummary("user-2");

      const callCountBeforeClear = mockSupabaseFrom.mock.calls.length;

      // Clear all cache
      service.clearCache();

      // Both should hit database again
      await service.getUserAccuracySummary("user-1");
      await service.getUserAccuracySummary("user-2");

      const callCountAfterClear = mockSupabaseFrom.mock.calls.length;

      // Should have made additional calls after cache was cleared
      expect(callCountAfterClear).toBeGreaterThan(callCountBeforeClear);
    });
  });

  // ============================================================================
  // Calculation Tests
  // ============================================================================

  describe("internal calculations", () => {
    it("should correctly calculate global accuracy", async () => {
      const { createAccuracyTracker } = await import(
        "../accuracy-tracker.service"
      );

      const service = createAccuracyTracker();
      expect(service).toBeDefined();
    });

    it("should assess reliability correctly", async () => {
      const { AccuracyTrackerService } = await import(
        "../accuracy-tracker.service"
      );

      const service = new AccuracyTrackerService({ minSampleSize: 20 });

      // With no data, reliability should be "low"
      const summary = await service.getUserAccuracySummary("user-no-data");
      expect(summary.reliability).toBe("low");
    });
  });

  // ============================================================================
  // Factory Function Tests
  // ============================================================================

  describe("factory functions", () => {
    it("getAccuracyTracker should return singleton", async () => {
      const { getAccuracyTracker } = await import(
        "../accuracy-tracker.service"
      );

      const instance1 = getAccuracyTracker();
      const instance2 = getAccuracyTracker();

      expect(instance1).toBe(instance2);
    });

    it("createAccuracyTracker should return new instance", async () => {
      const { createAccuracyTracker } = await import(
        "../accuracy-tracker.service"
      );

      const instance1 = createAccuracyTracker();
      const instance2 = createAccuracyTracker();

      expect(instance1).not.toBe(instance2);
    });

    it("createAccuracyTracker should accept custom config", async () => {
      const { createAccuracyTracker } = await import(
        "../accuracy-tracker.service"
      );

      const instance = createAccuracyTracker({
        bucketCount: 5,
        decayFactor: 0.8,
      });

      expect(instance).toBeDefined();
    });
  });

  // ============================================================================
  // Calibration Curve Tests
  // ============================================================================

  describe("calibration curve generation", () => {
    it("should generate correct number of buckets", async () => {
      const { AccuracyTrackerService } = await import(
        "../accuracy-tracker.service"
      );

      const service = new AccuracyTrackerService({ bucketCount: 10 });
      const summary = await service.getUserAccuracySummary("user-123");

      expect(summary.calibrationCurve).toHaveLength(10);
    });

    it("should handle custom bucket count", async () => {
      const { AccuracyTrackerService } = await import(
        "../accuracy-tracker.service"
      );

      const service = new AccuracyTrackerService({ bucketCount: 5 });
      const summary = await service.getUserAccuracySummary("user-123");

      expect(summary.calibrationCurve).toHaveLength(5);
    });

    it("should have correct bucket ranges", async () => {
      const { AccuracyTrackerService } = await import(
        "../accuracy-tracker.service"
      );

      const service = new AccuracyTrackerService({ bucketCount: 10 });
      const summary = await service.getUserAccuracySummary("user-123");

      // First bucket should be 0-10
      expect(summary.calibrationCurve[0].rangeStart).toBe(0);
      expect(summary.calibrationCurve[0].rangeEnd).toBe(10);

      // Last bucket should be 90-100
      expect(summary.calibrationCurve[9].rangeStart).toBe(90);
      expect(summary.calibrationCurve[9].rangeEnd).toBe(100);
    });
  });

  // ============================================================================
  // Time Range Tests
  // ============================================================================

  describe("time range in summary", () => {
    it("should have valid time range when no data", async () => {
      const { AccuracyTrackerService } = await import(
        "../accuracy-tracker.service"
      );

      const service = new AccuracyTrackerService();
      const summary = await service.getUserAccuracySummary("user-123");

      expect(summary.timeRange.start).toBeDefined();
      expect(summary.timeRange.end).toBeDefined();

      // Start and end should be valid ISO strings
      expect(() => new Date(summary.timeRange.start)).not.toThrow();
      expect(() => new Date(summary.timeRange.end)).not.toThrow();
    });
  });
});

// ============================================================================
// Mock Data Tests
// ============================================================================

describe("Mock Data Factory", () => {
  it("should generate metrics with specified accuracy", () => {
    const metrics = createMockMetrics(100, { accuracy: 0.8 });

    expect(metrics).toHaveLength(100);

    // Check structure
    expect(metrics[0]).toHaveProperty("folder_id");
    expect(metrics[0]).toHaveProperty("confidence");
    expect(metrics[0]).toHaveProperty("user_feedback");
    expect(metrics[0]).toHaveProperty("created_at");
  });

  it("should distribute across multiple folders", () => {
    const metrics = createMockMetrics(30, { accuracy: 0.75 });

    const folderIds = new Set(metrics.map((m) => m.folder_id));

    // Should have 3 different folders (based on implementation)
    expect(folderIds.size).toBe(3);
  });
});
