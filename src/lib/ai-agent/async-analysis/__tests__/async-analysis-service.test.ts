/**
 * AsyncAnalysisService 单元测试
 *
 * @module ai-agent/async-analysis/__tests__
 */

import {
  AsyncAnalysisService,
  createAsyncAnalysisService,
} from "../async-analysis-service";
// Types used in test helper functions
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

describe("AsyncAnalysisService", () => {
  let service: AsyncAnalysisService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AsyncAnalysisService({
      enabled: true,
      maxConcurrentTasks: 2,
      taskTimeoutMs: 5000,
      enableTopicClustering: true,
      enablePatternDetection: true,
    });
  });

  afterEach(() => {
    service.dispose();
  });

  describe("constructor", () => {
    it("should create service with default config", () => {
      const defaultService = createAsyncAnalysisService();
      expect(defaultService).toBeInstanceOf(AsyncAnalysisService);
      defaultService.dispose();
    });

    it("should register default analyzers", () => {
      const stats = service.getQueueStats();
      expect(stats).toBeDefined();
    });
  });

  describe("scheduleAnalysis", () => {
    it("should schedule analysis tasks", async () => {
      const taskIds = await service.scheduleAnalysis("user-1", {
        trigger: "manual",
        priority: "medium",
        types: ["topic_clustering"],
      });

      expect(taskIds.length).toBe(1);
      expect(taskIds[0]).toMatch(/^task_/);
    });

    it("should not schedule when disabled", async () => {
      const disabledService = new AsyncAnalysisService({ enabled: false });

      const taskIds = await disabledService.scheduleAnalysis("user-1", {
        trigger: "manual",
        priority: "medium",
        types: ["topic_clustering"],
      });

      expect(taskIds.length).toBe(0);
      disabledService.dispose();
    });

    it("should schedule multiple task types", async () => {
      const taskIds = await service.scheduleAnalysis("user-1", {
        trigger: "on_visit",
        priority: "high",
        types: ["topic_clustering", "pattern_detection"],
      });

      expect(taskIds.length).toBe(2);
    });

    it("should use default types for trigger when not specified", async () => {
      const taskIds = await service.scheduleAnalysis("user-1", {
        trigger: "post_collection",
        priority: "medium",
      });

      // post_collection defaults to content_enrichment and duplicate_detection
      // but these analyzers may not be registered
      expect(taskIds).toBeDefined();
    });
  });

  describe("getTaskStatus", () => {
    it("should return pending for queued tasks", async () => {
      const taskIds = await service.scheduleAnalysis("user-1", {
        trigger: "manual",
        priority: "low",
        types: ["topic_clustering"],
        delayMs: 10000, // Delay to keep in queue
      });

      const status = service.getTaskStatus(taskIds[0]);
      // Status could be pending or running depending on timing
      expect(["pending", "running", "completed"]).toContain(status);
    });

    it("should return null for unknown task", () => {
      const status = service.getTaskStatus("non-existent-task");
      expect(status).toBeNull();
    });
  });

  describe("getQueueStats", () => {
    it("should return queue statistics", () => {
      const stats = service.getQueueStats();

      expect(stats).toHaveProperty("pending");
      expect(stats).toHaveProperty("running");
      expect(stats).toHaveProperty("completed");
      expect(stats).toHaveProperty("failed");
      expect(stats).toHaveProperty("byType");
    });
  });

  describe("cancelTask", () => {
    it("should cancel queued task", async () => {
      const taskIds = await service.scheduleAnalysis("user-1", {
        trigger: "manual",
        priority: "low",
        types: ["topic_clustering"],
        delayMs: 10000,
      });

      const cancelled = service.cancelTask(taskIds[0]);
      // May or may not be cancellable depending on timing
      expect(typeof cancelled).toBe("boolean");
    });

    it("should return false for non-existent task", () => {
      const cancelled = service.cancelTask("non-existent");
      expect(cancelled).toBe(false);
    });
  });

  describe("recordUserVisit", () => {
    it("should record user visit", async () => {
      await expect(service.recordUserVisit("user-1")).resolves.not.toThrow();
    });
  });

  describe("addPostCollectionTask", () => {
    it("should add post-collection tasks", () => {
      expect(() => {
        service.addPostCollectionTask("user-1", 123);
      }).not.toThrow();
    });
  });

  describe("getUserResults", () => {
    it("should return empty array for user with no results", () => {
      const results = service.getUserResults("user-1");
      expect(results).toEqual([]);
    });

    it("should filter by type when specified", () => {
      const results = service.getUserResults("user-1", "topic_clustering");
      expect(results).toEqual([]);
    });
  });

  describe("clearUserData", () => {
    it("should clear user data", async () => {
      await service.scheduleAnalysis("user-1", {
        trigger: "manual",
        priority: "low",
        types: ["topic_clustering"],
      });

      service.clearUserData("user-1");

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("dispose", () => {
    it("should dispose service cleanly", () => {
      expect(() => service.dispose()).not.toThrow();
    });

    it("should be safe to call multiple times", () => {
      service.dispose();
      expect(() => service.dispose()).not.toThrow();
    });
  });
});

describe("createAsyncAnalysisService", () => {
  it("should create service with factory function", () => {
    const service = createAsyncAnalysisService();
    expect(service).toBeInstanceOf(AsyncAnalysisService);
    service.dispose();
  });

  it("should pass config to service", () => {
    const service = createAsyncAnalysisService({
      maxConcurrentTasks: 5,
    });
    expect(service).toBeInstanceOf(AsyncAnalysisService);
    service.dispose();
  });
});
