/**
 * LazyTrigger 单元测试
 *
 * @module ai-agent/async-analysis/__tests__
 */

import { LazyTrigger, createLazyTrigger } from "../scheduler/lazy-trigger";
// Types referenced in test documentation
import type {
  AnalysisTaskType as _AnalysisTaskType,
  TaskPriority as _TaskPriority,
} from "../types";

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("LazyTrigger", () => {
  let trigger: LazyTrigger;
  let mockCallback: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockCallback = jest.fn().mockResolvedValue(undefined);
    trigger = new LazyTrigger({
      enabled: true,
      minOfflineDurationMs: 4 * 60 * 60 * 1000, // 4 hours
      triggerDelayMs: 1000,
      maxTasksPerTrigger: 3,
    });
    trigger.setTriggerCallback(mockCallback);
  });

  afterEach(() => {
    trigger.dispose();
    jest.useRealTimers();
  });

  describe("constructor", () => {
    it("should create with default config", () => {
      const defaultTrigger = createLazyTrigger();
      expect(defaultTrigger).toBeInstanceOf(LazyTrigger);
      defaultTrigger.dispose();
    });

    it("should merge custom config", () => {
      const customTrigger = new LazyTrigger({
        minOfflineDurationMs: 1000,
      });
      expect(customTrigger).toBeInstanceOf(LazyTrigger);
      customTrigger.dispose();
    });
  });

  describe("recordUserVisit", () => {
    it("should record first visit without triggering", async () => {
      await trigger.recordUserVisit("user-1");

      // No trigger on first visit
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it("should not trigger if offline duration is too short", async () => {
      // First visit
      await trigger.recordUserVisit("user-1");

      // Advance time by 1 hour (less than 4 hour threshold)
      jest.advanceTimersByTime(1 * 60 * 60 * 1000);

      // Second visit
      await trigger.recordUserVisit("user-1");

      // Advance past trigger delay
      jest.advanceTimersByTime(2000);

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it("should trigger if offline duration exceeds threshold", async () => {
      // First visit
      await trigger.recordUserVisit("user-1");

      // Advance time by 5 hours (exceeds 4 hour threshold)
      jest.advanceTimersByTime(5 * 60 * 60 * 1000);

      // Second visit
      await trigger.recordUserVisit("user-1");

      // Advance past trigger delay
      jest.advanceTimersByTime(2000);

      expect(mockCallback).toHaveBeenCalledWith("user-1", expect.any(Array));
    });

    it("should not trigger when disabled", async () => {
      const disabledTrigger = new LazyTrigger({ enabled: false });
      disabledTrigger.setTriggerCallback(mockCallback);

      await disabledTrigger.recordUserVisit("user-1");
      jest.advanceTimersByTime(5 * 60 * 60 * 1000);
      await disabledTrigger.recordUserVisit("user-1");
      jest.advanceTimersByTime(2000);

      expect(mockCallback).not.toHaveBeenCalled();
      disabledTrigger.dispose();
    });
  });

  describe("addPendingTask", () => {
    it("should add pending task for user", () => {
      trigger.addPendingTask("user-1", "topic_clustering", "medium");

      const count = trigger.getPendingTaskCount("user-1");
      expect(count).toBe(1);
    });

    it("should not duplicate same task type", () => {
      trigger.addPendingTask("user-1", "topic_clustering", "medium");
      trigger.addPendingTask("user-1", "topic_clustering", "high");

      const count = trigger.getPendingTaskCount("user-1");
      expect(count).toBe(1);
    });

    it("should add different task types", () => {
      trigger.addPendingTask("user-1", "topic_clustering", "medium");
      trigger.addPendingTask("user-1", "pattern_detection", "medium");

      const count = trigger.getPendingTaskCount("user-1");
      expect(count).toBe(2);
    });

    it("should create user state if not exists", () => {
      trigger.addPendingTask("new-user", "topic_clustering", "medium");

      const count = trigger.getPendingTaskCount("new-user");
      expect(count).toBe(1);
    });
  });

  describe("getPendingTaskCount", () => {
    it("should return 0 for unknown user", () => {
      const count = trigger.getPendingTaskCount("unknown-user");
      expect(count).toBe(0);
    });
  });

  describe("clearUserState", () => {
    it("should clear user state", async () => {
      await trigger.recordUserVisit("user-1");
      trigger.addPendingTask("user-1", "topic_clustering", "medium");

      trigger.clearUserState("user-1");

      const count = trigger.getPendingTaskCount("user-1");
      expect(count).toBe(0);
    });

    it("should cancel pending timers", async () => {
      // First visit
      await trigger.recordUserVisit("user-1");

      // Advance time
      jest.advanceTimersByTime(5 * 60 * 60 * 1000);

      // Second visit (schedules trigger)
      await trigger.recordUserVisit("user-1");

      // Clear before trigger fires
      trigger.clearUserState("user-1");

      // Advance past trigger delay
      jest.advanceTimersByTime(2000);

      // Callback should not be called
      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  describe("triggerNow", () => {
    it("should trigger immediately with specified types", async () => {
      await trigger.triggerNow("user-1", ["topic_clustering"]);

      expect(mockCallback).toHaveBeenCalledWith("user-1", [
        { type: "topic_clustering", priority: "medium" },
      ]);
    });

    it("should use default types when not specified", async () => {
      await trigger.triggerNow("user-1");

      expect(mockCallback).toHaveBeenCalledWith("user-1", expect.any(Array));
    });

    it("should warn when callback not set", async () => {
      const noCallbackTrigger = new LazyTrigger();

      // Should not throw
      await expect(
        noCallbackTrigger.triggerNow("user-1"),
      ).resolves.not.toThrow();

      noCallbackTrigger.dispose();
    });
  });

  describe("dispose", () => {
    it("should dispose cleanly", () => {
      expect(() => trigger.dispose()).not.toThrow();
    });

    it("should clear all timers and state", async () => {
      await trigger.recordUserVisit("user-1");
      trigger.addPendingTask("user-1", "topic_clustering", "medium");

      trigger.dispose();

      // After dispose, getPendingTaskCount should return 0
      const count = trigger.getPendingTaskCount("user-1");
      expect(count).toBe(0);
    });
  });
});

describe("createLazyTrigger", () => {
  it("should create trigger with factory function", () => {
    const trigger = createLazyTrigger();
    expect(trigger).toBeInstanceOf(LazyTrigger);
    trigger.dispose();
  });

  it("should pass config to trigger", () => {
    const trigger = createLazyTrigger({
      maxTasksPerTrigger: 10,
    });
    expect(trigger).toBeInstanceOf(LazyTrigger);
    trigger.dispose();
  });
});
