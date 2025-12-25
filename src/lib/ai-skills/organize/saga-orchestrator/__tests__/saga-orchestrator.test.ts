/**
 * SagaOrchestrator 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import {
  SagaOrchestrator,
  createSagaOrchestrator,
  type SagaStep,
  type SagaContext,
} from "../saga-orchestrator";
import { SnapshotManager } from "../../snapshot-manager";

// Mock SnapshotManager
jest.mock("../../snapshot-manager", () => ({
  SnapshotManager: jest.fn().mockImplementation(() => ({
    createSnapshot: jest.fn().mockResolvedValue({ id: "snapshot-123" }),
    updateSnapshot: jest.fn().mockResolvedValue(undefined),
    getSnapshot: jest.fn().mockResolvedValue({
      id: "snapshot-123",
      action: "batch_categorize",
    }),
    undoSnapshot: jest
      .fn()
      .mockResolvedValue({ success: true, restoredCount: 3 }),
    captureBookmarkStates: jest
      .fn()
      .mockResolvedValue([
        {
          id: 1,
          title: "Test",
          url: "http://test.com",
          folderId: null,
          aiTags: [],
          isInTrash: false,
          isStarred: false,
        },
      ]),
  })),
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("SagaOrchestrator", () => {
  let saga: SagaOrchestrator;

  beforeEach(() => {
    jest.clearAllMocks();
    saga = createSagaOrchestrator();
  });

  describe("addStep", () => {
    it("should add steps and return this for chaining", () => {
      const step1: SagaStep<SagaContext, number> = {
        name: "step1",
        snapshotAction: null,
        execute: async () => 1,
      };

      const step2: SagaStep<SagaContext, number> = {
        name: "step2",
        snapshotAction: null,
        execute: async () => 2,
      };

      const result = saga.addStep(step1).addStep(step2);

      expect(result).toBe(saga);
    });
  });

  describe("execute", () => {
    it("should execute all steps in order", async () => {
      const executionOrder: string[] = [];

      saga.addStep({
        name: "step1",
        snapshotAction: null,
        execute: async () => {
          executionOrder.push("step1");
          return "result1";
        },
      });

      saga.addStep({
        name: "step2",
        snapshotAction: null,
        execute: async () => {
          executionOrder.push("step2");
          return "result2";
        },
      });

      const result = await saga.execute("user-1", [1, 2, 3], {
        skipSnapshot: true,
      });

      expect(result.success).toBe(true);
      expect(result.completedSteps).toBe(2);
      expect(result.totalSteps).toBe(2);
      expect(executionOrder).toEqual(["step1", "step2"]);
      expect(result.results.step1).toBe("result1");
      expect(result.results.step2).toBe("result2");
    });

    it("should stop execution on non-skippable step failure", async () => {
      const executionOrder: string[] = [];

      saga.addStep({
        name: "step1",
        snapshotAction: null,
        execute: async () => {
          executionOrder.push("step1");
          return "result1";
        },
      });

      saga.addStep({
        name: "step2",
        snapshotAction: null,
        execute: async () => {
          executionOrder.push("step2");
          throw new Error("Step 2 failed");
        },
        skippable: false,
      });

      saga.addStep({
        name: "step3",
        snapshotAction: null,
        execute: async () => {
          executionOrder.push("step3");
          return "result3";
        },
      });

      const result = await saga.execute("user-1", [1, 2, 3], {
        skipSnapshot: true,
      });

      expect(result.success).toBe(false);
      expect(result.completedSteps).toBe(1);
      expect(result.error).toBe("Step 2 failed");
      expect(executionOrder).toEqual(["step1", "step2"]);
    });

    it("should continue execution on skippable step failure", async () => {
      const executionOrder: string[] = [];

      saga.addStep({
        name: "step1",
        snapshotAction: null,
        execute: async () => {
          executionOrder.push("step1");
          return "result1";
        },
      });

      saga.addStep({
        name: "step2",
        snapshotAction: null,
        execute: async () => {
          executionOrder.push("step2");
          throw new Error("Step 2 failed");
        },
        skippable: true,
      });

      saga.addStep({
        name: "step3",
        snapshotAction: null,
        execute: async () => {
          executionOrder.push("step3");
          return "result3";
        },
      });

      const result = await saga.execute("user-1", [1, 2, 3], {
        skipSnapshot: true,
      });

      expect(result.success).toBe(true);
      expect(result.completedSteps).toBe(2);
      expect(executionOrder).toEqual(["step1", "step2", "step3"]);
    });

    it("should create snapshots for steps with snapshotAction", async () => {
      const mockSnapshotManager = new SnapshotManager();

      saga = new SagaOrchestrator(mockSnapshotManager);

      saga.addStep({
        name: "categorize",
        snapshotAction: "batch_categorize",
        execute: async () => ({ success: 3, failed: 0 }),
      });

      const result = await saga.execute("user-1", [1, 2, 3]);

      expect(result.success).toBe(true);
      expect(result.snapshotIds).toHaveLength(1);
      expect(mockSnapshotManager.captureBookmarkStates).toHaveBeenCalled();
      expect(mockSnapshotManager.createSnapshot).toHaveBeenCalled();
    });

    it("should call progress callback", async () => {
      const progressCalls: Array<{
        step: string;
        percent: number;
        message: string;
      }> = [];

      saga.setProgressCallback((step, percent, message) => {
        progressCalls.push({ step, percent, message });
      });

      saga.addStep({
        name: "step1",
        snapshotAction: null,
        execute: async () => "result",
      });

      await saga.execute("user-1", [1], { skipSnapshot: true });

      expect(progressCalls.length).toBeGreaterThan(0);
      expect(progressCalls.some((p) => p.step === "step1")).toBe(true);
      expect(progressCalls.some((p) => p.step === "完成")).toBe(true);
    });

    it("should retry on failure when maxRetries is set", async () => {
      let attempts = 0;

      saga.addStep({
        name: "flaky_step",
        snapshotAction: null,
        maxRetries: 2,
        execute: async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error("Temporary failure");
          }
          return "success";
        },
      });

      const result = await saga.execute("user-1", [1], { skipSnapshot: true });

      expect(result.success).toBe(true);
      expect(attempts).toBe(3);
    });
  });

  describe("undo", () => {
    it("should undo a snapshot", async () => {
      const mockSnapshotManager = new SnapshotManager();

      saga = new SagaOrchestrator(mockSnapshotManager);

      const result = await saga.undo("snapshot-123", "user-1");

      expect(result.success).toBe(true);
      expect(mockSnapshotManager.undoSnapshot).toHaveBeenCalledWith(
        "snapshot-123",
        "user-1",
      );
    });
  });

  describe("undoAll", () => {
    it("should undo all snapshots in reverse order", async () => {
      const mockSnapshotManager = new SnapshotManager();
      const undoOrder: string[] = [];

      (mockSnapshotManager.undoSnapshot as jest.Mock).mockImplementation(
        async (snapshotId: string) => {
          undoOrder.push(snapshotId);
          return { success: true, restoredCount: 1 };
        },
      );

      saga = new SagaOrchestrator(mockSnapshotManager);

      const results = await saga.undoAll(
        ["snapshot-1", "snapshot-2", "snapshot-3"],
        "user-1",
      );

      expect(results).toHaveLength(3);
      expect(undoOrder).toEqual(["snapshot-3", "snapshot-2", "snapshot-1"]);
    });
  });

  describe("clearSteps", () => {
    it("should clear all steps", async () => {
      saga.addStep({
        name: "step1",
        snapshotAction: null,
        execute: async () => "result",
      });

      saga.clearSteps();

      const result = await saga.execute("user-1", [1], { skipSnapshot: true });

      expect(result.completedSteps).toBe(0);
      expect(result.totalSteps).toBe(0);
    });
  });

  describe("compensation", () => {
    it("should execute custom compensate function on failure", async () => {
      let compensated = false;

      saga.addStep({
        name: "step1",
        snapshotAction: null,
        execute: async () => "result1",
        compensate: async () => {
          compensated = true;
        },
      });

      saga.addStep({
        name: "step2",
        snapshotAction: null,
        execute: async () => {
          throw new Error("Step 2 failed");
        },
      });

      await saga.execute("user-1", [1], { skipSnapshot: true });

      expect(compensated).toBe(true);
    });

    it("should compensate in reverse order", async () => {
      const compensationOrder: string[] = [];

      saga.addStep({
        name: "step1",
        snapshotAction: null,
        execute: async () => "result1",
        compensate: async () => {
          compensationOrder.push("step1");
        },
      });

      saga.addStep({
        name: "step2",
        snapshotAction: null,
        execute: async () => "result2",
        compensate: async () => {
          compensationOrder.push("step2");
        },
      });

      saga.addStep({
        name: "step3",
        snapshotAction: null,
        execute: async () => {
          throw new Error("Step 3 failed");
        },
      });

      await saga.execute("user-1", [1], { skipSnapshot: true });

      expect(compensationOrder).toEqual(["step2", "step1"]);
    });
  });
});

describe("createSagaOrchestrator", () => {
  it("should create a new SagaOrchestrator instance", () => {
    const saga = createSagaOrchestrator();

    expect(saga).toBeInstanceOf(SagaOrchestrator);
  });
});
