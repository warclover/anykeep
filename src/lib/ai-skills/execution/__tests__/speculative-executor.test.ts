/**
 * SpeculativeExecutor 单元测试
 *
 * 测试推测执行器的核心功能：
 * - 置信度执行策略
 * - 风险等级评估
 * - Undo 机制
 *
 * @version 1.0.0
 * @since 2026-01-10
 */

import {
  SpeculativeExecutor,
  createSpeculativeExecutor,
} from "../speculative-executor";
import type { IntentWithSlots, ExecutionContext } from "../types";

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// ============================================
// 测试辅助函数
// ============================================

function createMockIntent(overrides: Partial<IntentWithSlots> = {}): IntentWithSlots {
  return {
    type: "query",
    subType: "search",
    confidence: 0.9,
    slots: {},
    ...overrides,
  };
}

function createMockContext(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    userId: "user-123",
    sessionId: "session-456",
    ...overrides,
  };
}

function createMockExecutor(result: {
  success: boolean;
  message: string;
  data?: unknown;
  affectedCount?: number;
  snapshot?: unknown;
  undoExecutor?: () => Promise<void>;
}) {
  return jest.fn().mockResolvedValue(result);
}

// ============================================
// 测试套件
// ============================================

describe("SpeculativeExecutor", () => {
  let executor: SpeculativeExecutor;

  beforeEach(() => {
    executor = createSpeculativeExecutor({ debug: false });
    jest.useFakeTimers();
  });

  afterEach(() => {
    executor.destroy();
    jest.useRealTimers();
  });

  describe("Strategy Determination", () => {
    it("should return silent_execute for high confidence + low risk", () => {
      const strategy = executor.determineStrategy(0.9, "low");
      expect(strategy).toBe("silent_execute");
    });

    it("should return speculative_execute for medium confidence + low risk", () => {
      const strategy = executor.determineStrategy(0.7, "low");
      expect(strategy).toBe("speculative_execute");
    });

    it("should return clarify for low confidence", () => {
      const strategy = executor.determineStrategy(0.5, "low");
      expect(strategy).toBe("clarify");
    });

    it("should return confirm_required for high risk operations", () => {
      const strategy = executor.determineStrategy(0.95, "high");
      expect(strategy).toBe("confirm_required");
    });

    it("should return speculative_execute for medium confidence + medium risk", () => {
      const strategy = executor.determineStrategy(0.7, "medium");
      expect(strategy).toBe("speculative_execute");
    });
  });

  describe("Risk Level Assessment", () => {
    it("should return low risk for query:search", () => {
      const risk = executor.getRiskLevel("query", "search");
      expect(risk).toBe("low");
    });

    it("should return medium risk for action:move", () => {
      const risk = executor.getRiskLevel("action", "move");
      expect(risk).toBe("medium");
    });

    it("should return high risk for action:delete", () => {
      const risk = executor.getRiskLevel("action", "delete");
      expect(risk).toBe("high");
    });

    it("should return medium risk for unknown intents", () => {
      const risk = executor.getRiskLevel("unknown" as any, "something");
      expect(risk).toBe("medium");
    });
  });

  describe("Silent Execution", () => {
    it("should execute silently for high confidence queries", async () => {
      const intent = createMockIntent({ type: "query", subType: "search", confidence: 0.9 });
      const context = createMockContext();
      const mockExecutor = createMockExecutor({
        success: true,
        message: "Found 10 results",
        affectedCount: 10,
      });

      const result = await executor.execute(intent, context, mockExecutor);

      expect(result.success).toBe(true);
      expect(result.showUndo).toBe(false);
      expect(mockExecutor).toHaveBeenCalledWith(intent, context);
    });

    it("should generate brief report for successful silent execution", async () => {
      const intent = createMockIntent({ type: "query", subType: "search", confidence: 0.9 });
      const context = createMockContext();
      const mockExecutor = createMockExecutor({
        success: true,
        message: "Done",
        affectedCount: 5,
      });

      const result = await executor.execute(intent, context, mockExecutor);

      expect(result.message).toContain("5");
    });
  });

  describe("Speculative Execution with Undo", () => {
    it("should provide undo option for medium confidence", async () => {
      const intent = createMockIntent({ type: "action", subType: "tag", confidence: 0.7 });
      const context = createMockContext();
      const undoFn = jest.fn();
      const mockExecutor = createMockExecutor({
        success: true,
        message: "Tagged 3 bookmarks",
        affectedCount: 3,
        undoExecutor: undoFn,
      });

      const result = await executor.execute(intent, context, mockExecutor);

      expect(result.success).toBe(true);
      expect(result.showUndo).toBe(true);
      expect(result.undoId).toBeDefined();
      expect(result.undoTimeout).toBe(10000);
    });

    it("should allow undo within timeout window", async () => {
      const intent = createMockIntent({ type: "action", subType: "move", confidence: 0.7 });
      const context = createMockContext();
      const undoFn = jest.fn().mockResolvedValue(undefined);
      const mockExecutor = createMockExecutor({
        success: true,
        message: "Moved",
        undoExecutor: undoFn,
      });

      const executeResult = await executor.execute(intent, context, mockExecutor);
      expect(executeResult.undoId).toBeDefined();

      // Undo within window
      const undoResult = await executor.undo(executeResult.undoId!);

      expect(undoResult.success).toBe(true);
      expect(undoFn).toHaveBeenCalled();
    });

    it("should expire undo after timeout", async () => {
      const intent = createMockIntent({ type: "action", subType: "tag", confidence: 0.7 });
      const context = createMockContext();
      const undoFn = jest.fn();
      const mockExecutor = createMockExecutor({
        success: true,
        message: "Done",
        undoExecutor: undoFn,
      });

      const result = await executor.execute(intent, context, mockExecutor);

      // Fast forward past timeout
      jest.advanceTimersByTime(11000);

      const undoResult = await executor.undo(result.undoId!);

      expect(undoResult.success).toBe(false);
      expect(undoResult.message).toContain("过期");
    });
  });

  describe("Clarification Request", () => {
    it("should request clarification for low confidence", async () => {
      const intent = createMockIntent({
        type: "organize",
        subType: "cleanup",
        confidence: 0.5,
        alternatives: [
          { type: "action", subType: "delete", confidence: 0.45 },
        ],
      });
      const context = createMockContext();
      const mockExecutor = createMockExecutor({ success: true, message: "Done" });

      const result = await executor.execute(intent, context, mockExecutor);

      expect(result.success).toBe(false);
      expect(result.requiresClarification).toBe(true);
      expect(result.clarificationQuestion).toBeDefined();
      expect(result.clarificationOptions).toBeDefined();
      expect(mockExecutor).not.toHaveBeenCalled();
    });

    it("should include alternatives in clarification options", async () => {
      const intent = createMockIntent({
        type: "organize",
        subType: "cleanup",
        confidence: 0.5,
        alternatives: [
          { type: "action", subType: "delete", confidence: 0.48 },
          { type: "organize", subType: "dedupe", confidence: 0.45 },
        ],
      });
      const context = createMockContext();
      const mockExecutor = createMockExecutor({ success: true, message: "Done" });

      const result = await executor.execute(intent, context, mockExecutor);

      expect(result.clarificationOptions?.length).toBeGreaterThan(1);
    });
  });

  describe("Confirmation Request", () => {
    it("should require confirmation for high risk operations", async () => {
      const intent = createMockIntent({ type: "action", subType: "delete", confidence: 0.95 });
      const context = createMockContext({ selectedBookmarks: [1, 2, 3] });
      const mockExecutor = createMockExecutor({ success: true, message: "Deleted" });

      const result = await executor.execute(intent, context, mockExecutor);

      expect(result.success).toBe(false);
      expect(result.requiresConfirmation).toBe(true);
      expect(result.impactDescription).toContain("3");
      expect(mockExecutor).not.toHaveBeenCalled();
    });
  });

  describe("Undo Stack Management", () => {
    it("should track active undos", async () => {
      const intent = createMockIntent({ type: "action", subType: "tag", confidence: 0.7 });
      const context = createMockContext({ userId: "user-1" });
      const mockExecutor = createMockExecutor({
        success: true,
        message: "Done",
        undoExecutor: jest.fn(),
      });

      await executor.execute(intent, context, mockExecutor);

      const activeUndos = executor.getActiveUndos("user-1");
      expect(activeUndos.length).toBe(1);
    });

    it("should clear user undos", async () => {
      const intent = createMockIntent({ type: "action", subType: "tag", confidence: 0.7 });
      const context = createMockContext({ userId: "user-1" });
      const mockExecutor = createMockExecutor({
        success: true,
        message: "Done",
        undoExecutor: jest.fn(),
      });

      await executor.execute(intent, context, mockExecutor);
      await executor.execute(intent, context, mockExecutor);

      const cleared = executor.clearUserUndos("user-1");

      expect(cleared).toBe(2);
      expect(executor.getActiveUndos("user-1").length).toBe(0);
    });

    it("should limit undo stack size", async () => {
      const smallStackExecutor = createSpeculativeExecutor({ maxUndoStackSize: 3 });
      const intent = createMockIntent({ type: "action", subType: "tag", confidence: 0.7 });
      const context = createMockContext();
      const mockExecutor = createMockExecutor({
        success: true,
        message: "Done",
        undoExecutor: jest.fn(),
      });

      // Add more than max
      for (let i = 0; i < 5; i++) {
        await smallStackExecutor.execute(intent, context, mockExecutor);
      }

      const activeUndos = smallStackExecutor.getActiveUndos();
      expect(activeUndos.length).toBeLessThanOrEqual(3);

      smallStackExecutor.destroy();
    });
  });

  describe("Error Handling", () => {
    it("should handle executor errors gracefully", async () => {
      const intent = createMockIntent({ type: "query", subType: "search", confidence: 0.9 });
      const context = createMockContext();
      const mockExecutor = jest.fn().mockRejectedValue(new Error("Database error"));

      const result = await executor.execute(intent, context, mockExecutor);

      expect(result.success).toBe(false);
      expect(result.message).toContain("Database error");
    });

    it("should handle undo errors gracefully", async () => {
      const intent = createMockIntent({ type: "action", subType: "tag", confidence: 0.7 });
      const context = createMockContext();
      const undoFn = jest.fn().mockRejectedValue(new Error("Undo failed"));
      const mockExecutor = createMockExecutor({
        success: true,
        message: "Done",
        undoExecutor: undoFn,
      });

      const executeResult = await executor.execute(intent, context, mockExecutor);
      const undoResult = await executor.undo(executeResult.undoId!);

      expect(undoResult.success).toBe(false);
      expect(undoResult.message).toContain("Undo failed");
    });

    it("should return error for non-existent undo", async () => {
      const result = await executor.undo("non-existent-id");

      expect(result.success).toBe(false);
      expect(result.message).toContain("不存在");
    });
  });

  describe("Configuration", () => {
    it("should respect custom confidence thresholds", async () => {
      const customExecutor = createSpeculativeExecutor({
        strategy: {
          highConfidenceThreshold: 0.95,
          mediumConfidenceThreshold: 0.8,
          undoTimeoutMs: 5000,
          clarificationTimeoutMs: 20000,
        },
      });

      // 0.9 confidence should now trigger speculative (not silent)
      const strategy = customExecutor.determineStrategy(0.9, "low");
      expect(strategy).toBe("speculative_execute");

      customExecutor.destroy();
    });

    it("should respect custom undo timeout", async () => {
      const customExecutor = createSpeculativeExecutor({
        strategy: {
          highConfidenceThreshold: 0.85,
          mediumConfidenceThreshold: 0.6,
          undoTimeoutMs: 5000,
          clarificationTimeoutMs: 30000,
        },
      });

      const intent = createMockIntent({ type: "action", subType: "tag", confidence: 0.7 });
      const context = createMockContext();
      const mockExecutor = createMockExecutor({
        success: true,
        message: "Done",
        undoExecutor: jest.fn(),
      });

      const result = await customExecutor.execute(intent, context, mockExecutor);

      expect(result.undoTimeout).toBe(5000);

      customExecutor.destroy();
    });
  });
});
