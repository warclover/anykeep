/**
 * DistributionScheduler 单元测试
 */

import { DistributionScheduler } from "../core/distribution.scheduler";
import { DistributionEventBus } from "../core/distribution.event-bus";
import type { DistributionService } from "../core/distribution.service";
import type { DistributionTarget, DistributionResult } from "../types";

// Mock DistributionService
function createMockService(
  overrides?: Partial<DistributionService>,
): DistributionService {
  return {
    distribute: jest.fn().mockResolvedValue({
      success: true,
      distributedCount: 1,
      failedCount: 0,
      records: [],
    } as DistributionResult),
    getTarget: jest.fn().mockResolvedValue(null),
    getUnsyncedBookmarks: jest.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as DistributionService;
}

// Mock target factory
function createMockTarget(
  overrides?: Partial<DistributionTarget>,
): DistributionTarget {
  return {
    id: "target-1",
    userId: "user-1",
    targetType: "obsidian",
    name: "Test Target",
    enabled: true,
    trigger: { mode: "manual" },
    targetConfig: { vaultPath: "/test/vault" },
    status: "idle",
    syncedCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("DistributionScheduler", () => {
  let scheduler: DistributionScheduler;
  let eventBus: DistributionEventBus;
  let mockService: DistributionService;

  beforeEach(() => {
    jest.useFakeTimers();
    eventBus = new DistributionEventBus({ enableLogging: false });
    mockService = createMockService();
    scheduler = new DistributionScheduler(eventBus, mockService, {
      minIntervalMinutes: 1,
      maxConcurrentTasks: 3,
      taskTimeoutMs: 5000,
    });
  });

  afterEach(async () => {
    await scheduler.stop();
    jest.useRealTimers();
  });

  describe("start/stop", () => {
    it("should start and stop without error", async () => {
      await expect(scheduler.start()).resolves.not.toThrow();
      await expect(scheduler.stop()).resolves.not.toThrow();
    });

    it("should warn when starting already started scheduler", async () => {
      await scheduler.start();
      await expect(scheduler.start()).resolves.not.toThrow();
    });
  });

  describe("register", () => {
    it("should register a manual trigger task", async () => {
      const target = createMockTarget({ trigger: { mode: "manual" } });

      await scheduler.register(target);

      const task = scheduler.getTask(target.id);
      expect(task).toBeDefined();
      expect(task?.status).toBe("active");
    });

    it("should register a scheduled task with interval", async () => {
      const target = createMockTarget({
        trigger: { mode: "scheduled", scheduleIntervalMinutes: 5 },
      });

      await scheduler.register(target);

      const task = scheduler.getTask(target.id);
      expect(task).toBeDefined();
      expect(task?.nextRunAt).toBeDefined();
    });

    it("should register a realtime task with event subscription", async () => {
      const target = createMockTarget({ trigger: { mode: "realtime" } });

      await scheduler.register(target);

      const task = scheduler.getTask(target.id);
      expect(task).toBeDefined();
      expect(task?.status).toBe("active");
    });

    it("should re-register an existing task", async () => {
      const target = createMockTarget();

      await scheduler.register(target);
      await scheduler.register({ ...target, name: "Updated Name" });

      const task = scheduler.getTask(target.id);
      expect(task).toBeDefined();
    });
  });

  describe("unregister", () => {
    it("should unregister an existing task", async () => {
      const target = createMockTarget();

      await scheduler.register(target);
      expect(scheduler.getTask(target.id)).toBeDefined();

      await scheduler.unregister(target.id);
      expect(scheduler.getTask(target.id)).toBeUndefined();
    });

    it("should not throw when unregistering non-existent task", async () => {
      await expect(scheduler.unregister("non-existent")).resolves.not.toThrow();
    });

    it("should clear interval when unregistering scheduled task", async () => {
      const target = createMockTarget({
        trigger: { mode: "scheduled", scheduleIntervalMinutes: 5 },
      });

      await scheduler.register(target);
      await scheduler.unregister(target.id);

      expect(scheduler.getTask(target.id)).toBeUndefined();
    });
  });

  describe("pause/resume", () => {
    it("should pause and resume a task", async () => {
      const target = createMockTarget({
        trigger: { mode: "scheduled", scheduleIntervalMinutes: 5 },
      });

      await scheduler.register(target);
      expect(scheduler.getTask(target.id)?.status).toBe("active");

      await scheduler.pause(target.id);
      expect(scheduler.getTask(target.id)?.status).toBe("paused");

      await scheduler.resume(target.id);
      expect(scheduler.getTask(target.id)?.status).toBe("active");
    });

    it("should not throw when pausing non-existent task", async () => {
      await expect(scheduler.pause("non-existent")).resolves.not.toThrow();
    });

    it("should not throw when resuming non-existent task", async () => {
      await expect(scheduler.resume("non-existent")).resolves.not.toThrow();
    });
  });

  describe("triggerNow", () => {
    it("should trigger distribution immediately", async () => {
      const target = createMockTarget();

      await scheduler.register(target);
      await scheduler.triggerNow(target.id, ["bookmark-1"]);

      expect(mockService.distribute).toHaveBeenCalledWith(target.id, [
        "bookmark-1",
      ]);
    });

    it("should not throw when triggering non-existent task", async () => {
      await expect(scheduler.triggerNow("non-existent")).resolves.not.toThrow();
    });
  });

  describe("getTasksByUser", () => {
    it("should return all tasks for a user", async () => {
      const target1 = createMockTarget({ id: "target-1", userId: "user-1" });
      const target2 = createMockTarget({ id: "target-2", userId: "user-1" });
      const target3 = createMockTarget({ id: "target-3", userId: "user-2" });

      await scheduler.register(target1);
      await scheduler.register(target2);
      await scheduler.register(target3);

      const user1Tasks = scheduler.getTasksByUser("user-1");
      expect(user1Tasks).toHaveLength(2);

      const user2Tasks = scheduler.getTasksByUser("user-2");
      expect(user2Tasks).toHaveLength(1);
    });

    it("should return empty array for user with no tasks", () => {
      const tasks = scheduler.getTasksByUser("non-existent-user");
      expect(tasks).toEqual([]);
    });
  });

  describe("isRunning", () => {
    it("should return false when task is not running", async () => {
      const target = createMockTarget();

      await scheduler.register(target);

      expect(scheduler.isRunning(target.id)).toBe(false);
    });
  });

  describe("updateTask", () => {
    it("should update existing task configuration", async () => {
      const target = createMockTarget({ trigger: { mode: "manual" } });

      await scheduler.register(target);

      const updatedTarget = {
        ...target,
        trigger: { mode: "scheduled" as const, scheduleIntervalMinutes: 10 },
      };

      await scheduler.updateTask(updatedTarget);

      const task = scheduler.getTask(target.id);
      expect(task?.nextRunAt).toBeDefined();
    });

    it("should register task if it does not exist", async () => {
      const target = createMockTarget();

      expect(scheduler.getTask(target.id)).toBeUndefined();

      await scheduler.updateTask(target);

      expect(scheduler.getTask(target.id)).toBeDefined();
    });
  });

  describe("scheduled task execution", () => {
    it("should execute task after scheduled interval", async () => {
      const target = createMockTarget({
        trigger: { mode: "scheduled", scheduleIntervalMinutes: 1 },
      });

      // Mock getTarget to return the target
      (mockService.getTarget as jest.Mock).mockResolvedValue(target);
      (mockService.getUnsyncedBookmarks as jest.Mock).mockResolvedValue([
        { id: "bookmark-1" },
      ]);

      await scheduler.register(target);

      // Fast-forward time by 1 minute
      jest.advanceTimersByTime(60 * 1000);

      // Flush pending microtasks
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(mockService.getUnsyncedBookmarks).toHaveBeenCalled();
    });
  });

  describe("realtime task execution", () => {
    it("should trigger on bookmark_created event", async () => {
      const target = createMockTarget({
        trigger: { mode: "realtime" },
        userId: "user-1",
      });

      await scheduler.register(target);

      // Publish bookmark_created event
      await eventBus.publish({
        type: "bookmark_created",
        bookmarkId: "bookmark-1",
        userId: "user-1",
      });

      // Wait for debounced execution (1 second delay in scheduler)
      jest.advanceTimersByTime(1100);
      await Promise.resolve();
      await Promise.resolve();

      expect(mockService.distribute).toHaveBeenCalledWith(target.id, [
        "bookmark-1",
      ]);
    });

    it("should not trigger for different user", async () => {
      const target = createMockTarget({
        trigger: { mode: "realtime" },
        userId: "user-1",
      });

      await scheduler.register(target);

      // Publish event from different user
      await eventBus.publish({
        type: "bookmark_created",
        bookmarkId: "bookmark-1",
        userId: "user-2",
      });

      jest.advanceTimersByTime(1100);
      await Promise.resolve();

      expect(mockService.distribute).not.toHaveBeenCalled();
    });

    it("should filter by platform", async () => {
      const target = createMockTarget({
        trigger: { mode: "realtime" },
        userId: "user-1",
        filters: { platforms: ["wechat"] },
      });

      await scheduler.register(target);

      // Publish event with non-matching platform
      await eventBus.publish({
        type: "bookmark_created",
        bookmarkId: "bookmark-1",
        userId: "user-1",
        platform: "bilibili",
      });

      jest.advanceTimersByTime(1100);
      await Promise.resolve();

      expect(mockService.distribute).not.toHaveBeenCalled();

      // Publish event with matching platform
      await eventBus.publish({
        type: "bookmark_created",
        bookmarkId: "bookmark-2",
        userId: "user-1",
        platform: "wechat",
      });

      jest.advanceTimersByTime(1100);
      await Promise.resolve();
      await Promise.resolve();

      expect(mockService.distribute).toHaveBeenCalledWith(target.id, [
        "bookmark-2",
      ]);
    });

    it("should filter by tags", async () => {
      const target = createMockTarget({
        trigger: { mode: "realtime" },
        userId: "user-1",
        filters: { tags: ["tech", "ai"] },
      });

      await scheduler.register(target);

      // Publish event with non-matching tags
      await eventBus.publish({
        type: "bookmark_created",
        bookmarkId: "bookmark-1",
        userId: "user-1",
        tags: ["cooking", "recipe"],
      });

      jest.advanceTimersByTime(1100);
      await Promise.resolve();

      expect(mockService.distribute).not.toHaveBeenCalled();

      // Publish event with matching tag
      await eventBus.publish({
        type: "bookmark_created",
        bookmarkId: "bookmark-2",
        userId: "user-1",
        tags: ["tech", "tutorial"],
      });

      jest.advanceTimersByTime(1100);
      await Promise.resolve();
      await Promise.resolve();

      expect(mockService.distribute).toHaveBeenCalledWith(target.id, [
        "bookmark-2",
      ]);
    });
  });

  describe("concurrency control", () => {
    it("should skip task when already running", async () => {
      const target = createMockTarget({ trigger: { mode: "manual" } });

      // Make distribute slow
      let resolveDistribute: () => void;
      (mockService.distribute as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveDistribute = () =>
              resolve({
                success: true,
                distributedCount: 1,
                failedCount: 0,
                records: [],
              });
          }),
      );

      await scheduler.register(target);

      // Trigger first execution
      const firstTrigger = scheduler.triggerNow(target.id, ["bookmark-1"]);

      // Wait a tick for the task to start
      await Promise.resolve();

      // Trigger second execution (should be skipped)
      await scheduler.triggerNow(target.id, ["bookmark-2"]);

      // Complete first execution
      resolveDistribute!();
      await firstTrigger;

      // distribute should only be called once
      expect(mockService.distribute).toHaveBeenCalledTimes(1);
    });

    it("should skip when max concurrent tasks reached", async () => {
      const scheduler3 = new DistributionScheduler(eventBus, mockService, {
        maxConcurrentTasks: 2,
      });

      const targets = [
        createMockTarget({ id: "target-1" }),
        createMockTarget({ id: "target-2" }),
        createMockTarget({ id: "target-3" }),
      ];

      // Make distribute never resolve
      (mockService.distribute as jest.Mock).mockImplementation(
        () =>
          new Promise(() => {
            /* intentionally never resolving */
          }),
      );

      for (const target of targets) {
        await scheduler3.register(target);
      }

      // Trigger all tasks
      scheduler3.triggerNow("target-1", ["b1"]);
      await Promise.resolve();
      scheduler3.triggerNow("target-2", ["b2"]);
      await Promise.resolve();
      scheduler3.triggerNow("target-3", ["b3"]); // Should be skipped
      await Promise.resolve();

      // Only 2 tasks should be running
      expect(mockService.distribute).toHaveBeenCalledTimes(2);

      await scheduler3.stop();
    });
  });

  describe("incremental sync", () => {
    it("should get unsynced bookmarks for scheduled task", async () => {
      const target = createMockTarget({
        trigger: { mode: "scheduled", scheduleIntervalMinutes: 1 },
      });

      // Mock getTarget to return the target (required for getIncrementalBookmarkIds)
      (mockService.getTarget as jest.Mock).mockResolvedValue(target);
      (mockService.getUnsyncedBookmarks as jest.Mock).mockResolvedValue([
        { id: "bookmark-1" },
        { id: "bookmark-2" },
      ]);

      await scheduler.register(target);

      // Trigger immediately without bookmarkIds
      await scheduler.triggerNow(target.id);

      expect(mockService.getUnsyncedBookmarks).toHaveBeenCalledWith(
        target.id,
        target.userId,
        undefined,
      );
      expect(mockService.distribute).toHaveBeenCalledWith(target.id, [
        "bookmark-1",
        "bookmark-2",
      ]);
    });

    it("should skip sync when no unsynced bookmarks", async () => {
      const target = createMockTarget({ trigger: { mode: "manual" } });

      (mockService.getTarget as jest.Mock).mockResolvedValue(target);
      (mockService.getUnsyncedBookmarks as jest.Mock).mockResolvedValue([]);

      await scheduler.register(target);
      await scheduler.triggerNow(target.id);

      expect(mockService.distribute).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should mark task as error on distribution failure", async () => {
      const target = createMockTarget({ trigger: { mode: "manual" } });

      (mockService.distribute as jest.Mock).mockRejectedValue(
        new Error("Distribution failed"),
      );

      await scheduler.register(target);
      await scheduler.triggerNow(target.id, ["bookmark-1"]);

      const task = scheduler.getTask(target.id);
      expect(task?.status).toBe("error");
      expect(task?.lastResult).toBe("failed");
    });

    it("should mark task as error when distribution result is not success", async () => {
      const target = createMockTarget({ trigger: { mode: "manual" } });

      (mockService.distribute as jest.Mock).mockResolvedValue({
        success: false,
        distributedCount: 0,
        failedCount: 1,
        records: [],
      });

      await scheduler.register(target);
      await scheduler.triggerNow(target.id, ["bookmark-1"]);

      const task = scheduler.getTask(target.id);
      expect(task?.lastResult).toBe("failed");
    });
  });
});
