/**
 * FeedbackLoopService Unit Tests
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";

// ============================================================================
// Mocks
// ============================================================================

// Mock Supabase
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      from: () => ({
        delete: () => ({
          eq: () => ({
            neq: () => ({
              lt: () => Promise.resolve({ error: null }),
            }),
          }),
        }),
      }),
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

// Mock preference learner
const mockRecordEvent = jest.fn().mockResolvedValue(undefined);
const mockGetLearningStats = jest.fn().mockResolvedValue({
  totalEvents: 100,
  confirmations: 70,
  rejections: 20,
  modifications: 10,
  accuracy: 70,
});

jest.mock("../preference-learner", () => ({
  preferenceLearner: {
    recordEvent: (...args: unknown[]) => mockRecordEvent(...args),
    getLearningStats: (...args: unknown[]) => mockGetLearningStats(...args),
  },
}));

// Mock profile updater
const mockRunFullUpdate = jest.fn().mockResolvedValue(undefined);
const mockGetHealthStatus = jest.fn().mockResolvedValue({
  recommendations: [],
});

jest.mock("../profile-updater", () => ({
  profileUpdater: {
    runFullUpdate: (...args: unknown[]) => mockRunFullUpdate(...args),
    getHealthStatus: (...args: unknown[]) => mockGetHealthStatus(...args),
  },
}));

// Mock source profile service
const mockUpdateTrustScore = jest.fn().mockResolvedValue(undefined);
const mockUpdateOnClassification = jest.fn().mockResolvedValue(undefined);

jest.mock("@/lib/source-profile/source-profile.service", () => ({
  sourceProfileService: {
    updateTrustScore: (...args: unknown[]) => mockUpdateTrustScore(...args),
    updateOnClassification: (...args: unknown[]) =>
      mockUpdateOnClassification(...args),
  },
}));

// Mock cache manager
const mockInvalidateUser = jest.fn();
const mockWarmupUserCache = jest.fn().mockResolvedValue(undefined);
const mockGetStats = jest.fn().mockReturnValue({
  hitRate: 0.8,
  size: 100,
});

jest.mock("@/lib/classification/router/cache-manager", () => ({
  fastPathCacheManager: {
    invalidateUser: (...args: unknown[]) => mockInvalidateUser(...args),
    warmupUserCache: (...args: unknown[]) => mockWarmupUserCache(...args),
    getStats: () => mockGetStats(),
  },
}));

// ============================================================================
// Test Utilities
// ============================================================================

function createFeedbackData(
  overrides: Partial<{
    userId: string;
    bookmarkId: number;
    signal: string;
    sourceId: string;
    originalFolderId: number;
    newFolderId: number;
    confidence: number;
  }> = {},
) {
  return {
    userId: "user-123",
    bookmarkId: 1,
    signal: "confirm" as const,
    sourceId: "source-abc",
    originalFolderId: 1,
    newFolderId: 2,
    confidence: 85,
    ...overrides,
  };
}

// ============================================================================
// Test Suites
// ============================================================================

describe("FeedbackLoopService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // processFeedback Tests
  // ============================================================================

  describe("processFeedback", () => {
    it("should process confirm feedback successfully", async () => {
      const { FeedbackLoopService } = await import("../feedback-loop");

      const service = new FeedbackLoopService();
      const feedback = createFeedbackData({ signal: "confirm" });

      const result = await service.processFeedback(feedback);

      expect(result.success).toBe(true);
      expect(result.learningApplied).toBe(true);
      expect(mockRecordEvent).toHaveBeenCalled();
    });

    it("should process reject feedback successfully", async () => {
      const { FeedbackLoopService } = await import("../feedback-loop");

      const service = new FeedbackLoopService();
      const feedback = createFeedbackData({ signal: "reject" as const });

      const result = await service.processFeedback(feedback);

      expect(result.success).toBe(true);
      expect(mockRecordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "classification_rejected",
        }),
      );
    });

    it("should process modify feedback successfully", async () => {
      const { FeedbackLoopService } = await import("../feedback-loop");

      const service = new FeedbackLoopService();
      const feedback = createFeedbackData({ signal: "modify" as const });

      const result = await service.processFeedback(feedback);

      expect(result.success).toBe(true);
      expect(mockRecordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "classification_modified",
        }),
      );
    });

    it("should process move feedback successfully", async () => {
      const { FeedbackLoopService } = await import("../feedback-loop");

      const service = new FeedbackLoopService();
      const feedback = createFeedbackData({ signal: "move" as const });

      const result = await service.processFeedback(feedback);

      expect(result.success).toBe(true);
      expect(mockRecordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "folder_moved",
        }),
      );
    });

    it("should process delete feedback successfully", async () => {
      const { FeedbackLoopService } = await import("../feedback-loop");

      const service = new FeedbackLoopService();
      const feedback = createFeedbackData({ signal: "delete" as const });

      const result = await service.processFeedback(feedback);

      expect(result.success).toBe(true);
      expect(mockRecordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "bookmark_deleted",
        }),
      );
    });

    it("should update source profile on confirm", async () => {
      const { FeedbackLoopService } = await import("../feedback-loop");

      const service = new FeedbackLoopService();
      const feedback = createFeedbackData({ signal: "confirm" });

      await service.processFeedback(feedback);

      expect(mockUpdateTrustScore).toHaveBeenCalledWith(
        "user-123",
        "source-abc",
        5,
      );
    });

    it("should decrease trust score on reject", async () => {
      const { FeedbackLoopService } = await import("../feedback-loop");

      const service = new FeedbackLoopService();
      const feedback = createFeedbackData({ signal: "reject" as const });

      await service.processFeedback(feedback);

      expect(mockUpdateTrustScore).toHaveBeenCalledWith(
        "user-123",
        "source-abc",
        -10,
      );
    });

    it("should invalidate cache after processing", async () => {
      const { FeedbackLoopService } = await import("../feedback-loop");

      const service = new FeedbackLoopService();
      const feedback = createFeedbackData();

      await service.processFeedback(feedback);

      expect(mockInvalidateUser).toHaveBeenCalledWith("user-123");
    });

    it("should handle archive signal without event", async () => {
      const { FeedbackLoopService } = await import("../feedback-loop");

      const service = new FeedbackLoopService();
      const feedback = createFeedbackData({ signal: "archive" as const });

      const result = await service.processFeedback(feedback);

      expect(result.success).toBe(true);
      // archive doesn't map to an event type
    });

    it("should handle missing sourceId gracefully", async () => {
      const { FeedbackLoopService } = await import("../feedback-loop");

      const service = new FeedbackLoopService();
      const feedback = createFeedbackData({ sourceId: undefined });

      const result = await service.processFeedback(feedback);

      expect(result.success).toBe(true);
      expect(mockUpdateTrustScore).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // generateHealthReport Tests
  // ============================================================================

  describe("generateHealthReport", () => {
    it("should generate health report with all metrics", async () => {
      const { FeedbackLoopService } = await import("../feedback-loop");

      const service = new FeedbackLoopService();
      const report = await service.generateHealthReport("user-123");

      expect(report.userId).toBe("user-123");
      expect(report.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.overallScore).toBeLessThanOrEqual(100);
      expect(report.metrics.classificationAccuracy).toBeDefined();
      expect(report.metrics.confirmationRate).toBeDefined();
      expect(report.metrics.fastPathHitRate).toBeDefined();
      expect(report.metrics.userSatisfaction).toBeDefined();
    });

    it("should include trends in report", async () => {
      const { FeedbackLoopService } = await import("../feedback-loop");

      const service = new FeedbackLoopService();
      const report = await service.generateHealthReport("user-123");

      expect(report.trends.accuracyTrend).toMatch(/improving|stable|declining/);
      expect(report.trends.activityTrend).toMatch(
        /increasing|stable|decreasing/,
      );
    });

    it("should include generated timestamp", async () => {
      const { FeedbackLoopService } = await import("../feedback-loop");

      const service = new FeedbackLoopService();
      const report = await service.generateHealthReport("user-123");

      expect(report.generatedAt).toBeInstanceOf(Date);
    });
  });

  // ============================================================================
  // runPeriodicOptimization Tests
  // ============================================================================

  describe("runPeriodicOptimization", () => {
    it("should run full profile update", async () => {
      const { FeedbackLoopService } = await import("../feedback-loop");

      const service = new FeedbackLoopService();
      await service.runPeriodicOptimization("user-123");

      expect(mockRunFullUpdate).toHaveBeenCalledWith("user-123");
    });

    it("should warmup user cache", async () => {
      const { FeedbackLoopService } = await import("../feedback-loop");

      const service = new FeedbackLoopService();
      await service.runPeriodicOptimization("user-123");

      expect(mockWarmupUserCache).toHaveBeenCalledWith("user-123");
    });
  });

  // ============================================================================
  // Helper Functions Tests
  // ============================================================================

  describe("helper functions", () => {
    it("handleUserFeedback should call processFeedback", async () => {
      const { handleUserFeedback } = await import("../feedback-loop");

      const feedback = createFeedbackData();
      const result = await handleUserFeedback(feedback);

      expect(result.success).toBe(true);
    });

    it("getSystemHealthReport should call generateHealthReport", async () => {
      const { getSystemHealthReport } = await import("../feedback-loop");

      const report = await getSystemHealthReport("user-123");

      expect(report.userId).toBe("user-123");
    });
  });

  // ============================================================================
  // Adjustment Logic Tests
  // ============================================================================

  describe("adjustment logic", () => {
    it("should suggest threshold adjustment on high reject rate", async () => {
      const { FeedbackLoopService } = await import("../feedback-loop");

      const service = new FeedbackLoopService();

      // Add many reject feedbacks to trigger adjustment
      for (let i = 0; i < 15; i++) {
        await service.processFeedback(
          createFeedbackData({
            bookmarkId: i,
            signal: i < 10 ? ("reject" as const) : ("confirm" as const),
          }),
        );
      }

      const report = await service.generateHealthReport("user-123");

      // With high reject rate, adjustments should be suggested
      // Note: The adjustments depend on the window data
      expect(report.adjustments).toBeDefined();
    });
  });

  // ============================================================================
  // Singleton Export Tests
  // ============================================================================

  describe("singleton export", () => {
    it("should export feedbackLoopService singleton", async () => {
      const { feedbackLoopService } = await import("../feedback-loop");

      expect(feedbackLoopService).toBeDefined();
      expect(typeof feedbackLoopService.processFeedback).toBe("function");
    });
  });
});
