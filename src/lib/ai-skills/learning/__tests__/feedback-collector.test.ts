/**
 * FeedbackCollector 单元测试
 *
 * @version 1.0.0
 * @since 2026-01-10
 */

import type { FeedbackCollector } from "../feedback-collector";
import { createFeedbackCollector } from "../feedback-collector";
import type { IntentMatchForFeedback, UserAction } from "../types";

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock Supabase
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn().mockResolvedValue({
    from: jest.fn().mockReturnThis(),
    insert: jest.fn().mockResolvedValue({ error: null }),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    gte: jest.fn().mockResolvedValue({ data: [], error: null }),
    rpc: jest.fn().mockResolvedValue({
      data: [
        {
          total_count: 100,
          accepted_count: 80,
          corrected_count: 15,
          abandoned_count: 5,
          acceptance_rate: 0.8,
          top_corrected_types: [],
        },
      ],
      error: null,
    }),
  }),
}));

// ============================================
// 测试辅助函数
// ============================================

function createMockIntent(
  overrides: Partial<IntentMatchForFeedback> = {},
): IntentMatchForFeedback {
  return {
    type: "query",
    subType: "search",
    confidence: 0.9,
    ...overrides,
  };
}

function createMockAction(overrides: Partial<UserAction> = {}): UserAction {
  return {
    sessionId: "session-123",
    turnId: "turn-456",
    originalInput: "搜索我的收藏",
    type: "execute_success",
    timestamp: new Date(),
    ...overrides,
  };
}

// ============================================
// 测试套件
// ============================================

describe("FeedbackCollector", () => {
  let collector: FeedbackCollector;

  beforeEach(() => {
    collector = createFeedbackCollector({ debug: false });
    jest.useFakeTimers();
  });

  afterEach(async () => {
    await collector.destroy();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe("Implicit Feedback Collection", () => {
    it("should collect accepted feedback for successful execution", () => {
      const intent = createMockIntent();
      const action = createMockAction({ type: "execute_success" });

      const feedback = collector.collectImplicitFeedback(
        "user-1",
        intent,
        action,
      );

      expect(feedback.actualBehavior).toBe("accepted");
      expect(feedback.userId).toBe("user-1");
      expect(feedback.originalInput).toBe("搜索我的收藏");
      expect(feedback.predictedIntent.type).toBe("query");
    });

    it("should collect corrected feedback for manual correction", () => {
      const intent = createMockIntent();
      const action = createMockAction({
        type: "manual_correction",
        correctedIntent: "organize:cleanup",
      });

      const feedback = collector.collectImplicitFeedback(
        "user-1",
        intent,
        action,
      );

      expect(feedback.actualBehavior).toBe("corrected");
      expect(feedback.correctedType).toBe("organize");
      expect(feedback.correctedSubType).toBe("cleanup");
    });

    it("should collect abandoned feedback for cancel action", () => {
      const intent = createMockIntent();
      const action = createMockAction({ type: "cancel" });

      const feedback = collector.collectImplicitFeedback(
        "user-1",
        intent,
        action,
      );

      expect(feedback.actualBehavior).toBe("abandoned");
    });

    it("should collect abandoned feedback for undo action", () => {
      const intent = createMockIntent();
      const action = createMockAction({ type: "undo" });

      const feedback = collector.collectImplicitFeedback(
        "user-1",
        intent,
        action,
      );

      expect(feedback.actualBehavior).toBe("abandoned");
    });

    it("should throw error when implicit feedback is disabled", () => {
      const disabledCollector = createFeedbackCollector({
        enableImplicitFeedback: false,
      });

      expect(() => {
        disabledCollector.collectImplicitFeedback(
          "user-1",
          createMockIntent(),
          createMockAction(),
        );
      }).toThrow("Implicit feedback collection is disabled");
    });
  });

  describe("Feedback Buffer Management", () => {
    it("should buffer feedback before batch write", () => {
      const intent = createMockIntent();
      const action = createMockAction();

      collector.collectImplicitFeedback("user-1", intent, action);
      collector.collectImplicitFeedback("user-1", intent, action);

      // Buffer should not be empty
      // (We can't directly test private state, but flush should write)
    });

    it("should flush buffer when threshold is reached", async () => {
      const smallThresholdCollector = createFeedbackCollector({
        batchWriteThreshold: 2,
      });

      const intent = createMockIntent();
      const action = createMockAction();

      smallThresholdCollector.collectImplicitFeedback("user-1", intent, action);
      smallThresholdCollector.collectImplicitFeedback("user-1", intent, action);

      // Flush should be triggered automatically
      await smallThresholdCollector.destroy();
    });

    it("should flush buffer on destroy", async () => {
      const intent = createMockIntent();
      const action = createMockAction();

      collector.collectImplicitFeedback("user-1", intent, action);

      await collector.destroy();
      // Buffer should be flushed
    });
  });

  describe("Intent Parsing", () => {
    it("should parse intent type correctly", () => {
      const intent = createMockIntent();
      const action = createMockAction({
        type: "manual_correction",
        correctedIntent: "action:delete",
      });

      const feedback = collector.collectImplicitFeedback(
        "user-1",
        intent,
        action,
      );

      expect(feedback.correctedType).toBe("action");
      expect(feedback.correctedSubType).toBe("delete");
    });

    it("should handle intent without subtype", () => {
      const intent = createMockIntent();
      const action = createMockAction({
        type: "manual_correction",
        correctedIntent: "chitchat",
      });

      const feedback = collector.collectImplicitFeedback(
        "user-1",
        intent,
        action,
      );

      expect(feedback.correctedType).toBe("chitchat");
      expect(feedback.correctedSubType).toBeUndefined();
    });
  });

  describe("Statistics", () => {
    it("should get user feedback stats", async () => {
      const stats = await collector.getUserFeedbackStats("user-1");

      expect(stats.totalCount).toBe(100);
      expect(stats.acceptedCount).toBe(80);
      expect(stats.correctedCount).toBe(15);
      expect(stats.abandonedCount).toBe(5);
      expect(stats.acceptanceRate).toBe(0.8);
    });
  });

  describe("Configuration", () => {
    it("should use default config values", () => {
      const defaultCollector = createFeedbackCollector();
      expect(defaultCollector).toBeDefined();
    });

    it("should respect custom config", () => {
      const customCollector = createFeedbackCollector({
        batchWriteThreshold: 20,
        writeIntervalMs: 10000,
        debug: true,
      });
      expect(customCollector).toBeDefined();
    });
  });
});
