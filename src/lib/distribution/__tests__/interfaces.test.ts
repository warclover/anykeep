/**
 * 分发模块接口测试
 *
 * @description 测试接口定义的类型正确性
 */

import type {
  IDistributionAdapter,
  AdapterMetadata,
} from "../interfaces/adapter.interface";
import type {
  IDistributionEventBus,
  Unsubscribe,
} from "../interfaces/event-bus.interface";
import type {
  IDistributionScheduler,
  ScheduledTask,
  SchedulerConfig,
} from "../interfaces/scheduler.interface";
import type {
  DistributionTarget,
  DistributionResult,
  ValidationResult,
  TestConnectionResult,
  DistributionEvent,
  DistributionBookmark,
} from "../types";

describe("distribution/interfaces", () => {
  describe("IDistributionAdapter", () => {
    it("should define the correct interface shape", () => {
      // 创建一个 mock 实现来验证接口
      const mockAdapter: IDistributionAdapter = {
        type: "obsidian",
        displayName: "Obsidian 本地同步",
        description: "将收藏同步到 Obsidian Vault",
        supportedPlatforms: ["desktop"],

        initialize: jest.fn().mockResolvedValue(undefined),
        distribute: jest.fn().mockResolvedValue({
          success: true,
          distributedCount: 1,
          failedCount: 0,
          records: [],
        } as DistributionResult),
        validateConfig: jest.fn().mockResolvedValue({
          valid: true,
          errors: [],
        } as ValidationResult),
        testConnection: jest.fn().mockResolvedValue({
          success: true,
        } as TestConnectionResult),
        getDefaultConfig: jest.fn().mockReturnValue({
          vaultPath: "",
          folderName: "AnyKeep",
        }),
        dispose: jest.fn().mockResolvedValue(undefined),
      };

      expect(mockAdapter.type).toBe("obsidian");
      expect(mockAdapter.displayName).toBe("Obsidian 本地同步");
      expect(mockAdapter.supportedPlatforms).toContain("desktop");
    });

    it("should allow calling adapter methods", async () => {
      const mockAdapter: IDistributionAdapter = {
        type: "notion",
        displayName: "Notion",
        supportedPlatforms: ["web", "mobile", "desktop"],
        initialize: jest.fn().mockResolvedValue(undefined),
        distribute: jest.fn().mockResolvedValue({
          success: true,
          distributedCount: 5,
          failedCount: 0,
          records: [],
        }),
        validateConfig: jest.fn().mockResolvedValue({
          valid: true,
          errors: [],
        }),
        testConnection: jest.fn().mockResolvedValue({
          success: true,
          details: { workspaceName: "Test Workspace" },
        }),
      };

      const target: DistributionTarget = {
        id: "target-1",
        userId: "user-1",
        targetType: "notion",
        name: "My Notion",
        enabled: true,
        trigger: { mode: "manual" },
        targetConfig: { databaseId: "db-1" },
        status: "idle",
        syncedCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const bookmarks: DistributionBookmark[] = [
        {
          id: "b1",
          title: "Test Bookmark",
          url: "https://example.com",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      await mockAdapter.initialize(target);
      const result = await mockAdapter.distribute(bookmarks, target);
      const validation = await mockAdapter.validateConfig(target);
      const connection = await mockAdapter.testConnection(target);

      expect(mockAdapter.initialize).toHaveBeenCalledWith(target);
      expect(result.distributedCount).toBe(5);
      expect(validation.valid).toBe(true);
      expect(connection.success).toBe(true);
    });
  });

  describe("AdapterMetadata", () => {
    it("should define adapter metadata structure", () => {
      const metadata: AdapterMetadata = {
        type: "obsidian",
        displayName: "Obsidian",
        description: "同步到本地 Obsidian Vault",
        supportedPlatforms: ["desktop"],
        icon: "obsidian",
        requiresOAuth: false,
        isBeta: false,
      };

      expect(metadata.type).toBe("obsidian");
      expect(metadata.supportedPlatforms).toContain("desktop");
      expect(metadata.requiresOAuth).toBe(false);
    });
  });

  describe("IDistributionEventBus", () => {
    it("should define the correct interface shape", () => {
      const handlers: Map<
        string,
        Set<(event: DistributionEvent) => Promise<void>>
      > = new Map();

      const mockEventBus: IDistributionEventBus = {
        publish: jest.fn().mockResolvedValue(undefined),
        subscribe: jest.fn().mockImplementation((eventType, handler) => {
          if (!handlers.has(eventType)) {
            handlers.set(eventType, new Set());
          }
          handlers.get(eventType)!.add(handler);
          return () => handlers.get(eventType)?.delete(handler);
        }),
        subscribeAll: jest.fn().mockReturnValue(() => {}),
        getSubscriberCount: jest.fn().mockReturnValue(0),
        clear: jest.fn(),
      };

      expect(mockEventBus.publish).toBeDefined();
      expect(mockEventBus.subscribe).toBeDefined();
    });

    it("should allow subscribing and unsubscribing", async () => {
      let subscriberCount = 0;

      const mockEventBus: IDistributionEventBus = {
        publish: jest.fn().mockResolvedValue(undefined),
        subscribe: jest.fn().mockImplementation(() => {
          subscriberCount++;
          return () => {
            subscriberCount--;
          };
        }),
        getSubscriberCount: jest.fn().mockImplementation(() => subscriberCount),
      };

      const handler = jest.fn().mockResolvedValue(undefined);
      const unsubscribe: Unsubscribe = mockEventBus.subscribe(
        "bookmark_created",
        handler,
      );

      expect(typeof unsubscribe).toBe("function");
      expect(subscriberCount).toBe(1);

      unsubscribe();
      expect(subscriberCount).toBe(0);
    });

    it("should allow publishing events", async () => {
      const publishedEvents: DistributionEvent[] = [];

      const mockEventBus: IDistributionEventBus = {
        publish: jest.fn().mockImplementation(async (event) => {
          publishedEvents.push(event);
        }),
        subscribe: jest.fn().mockReturnValue(() => {}),
      };

      const event: DistributionEvent = {
        type: "bookmark_created",
        bookmarkId: "b1",
        userId: "u1",
      };

      await mockEventBus.publish(event);

      expect(publishedEvents).toHaveLength(1);
      expect(publishedEvents[0].type).toBe("bookmark_created");
    });
  });

  describe("IDistributionScheduler", () => {
    it("should define the correct interface shape", () => {
      const tasks: Map<string, ScheduledTask> = new Map();

      const mockScheduler: IDistributionScheduler = {
        register: jest.fn().mockResolvedValue(undefined),
        unregister: jest.fn().mockResolvedValue(undefined),
        pause: jest.fn().mockResolvedValue(undefined),
        resume: jest.fn().mockResolvedValue(undefined),
        triggerNow: jest.fn().mockResolvedValue(undefined),
        getTask: jest
          .fn()
          .mockImplementation((targetId) => tasks.get(targetId)),
        getTasksByUser: jest.fn().mockReturnValue([]),
        updateTask: jest.fn().mockResolvedValue(undefined),
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
        isRunning: jest.fn().mockReturnValue(false),
      };

      expect(mockScheduler.register).toBeDefined();
      expect(mockScheduler.triggerNow).toBeDefined();
      expect(mockScheduler.start).toBeDefined();
      expect(mockScheduler.stop).toBeDefined();
    });

    it("should allow registering and managing tasks", async () => {
      const tasks: Map<string, ScheduledTask> = new Map();

      const mockScheduler: IDistributionScheduler = {
        register: jest
          .fn()
          .mockImplementation(async (target: DistributionTarget) => {
            tasks.set(target.id, {
              id: `task-${target.id}`,
              targetId: target.id,
              userId: target.userId,
              status: "active",
              createdAt: new Date(),
            });
          }),
        unregister: jest.fn().mockImplementation(async (targetId) => {
          tasks.delete(targetId);
        }),
        pause: jest.fn().mockImplementation(async (targetId) => {
          const task = tasks.get(targetId);
          if (task) {
            task.status = "paused";
          }
        }),
        resume: jest.fn().mockImplementation(async (targetId) => {
          const task = tasks.get(targetId);
          if (task) {
            task.status = "active";
          }
        }),
        triggerNow: jest.fn().mockResolvedValue(undefined),
        getTask: jest
          .fn()
          .mockImplementation((targetId) => tasks.get(targetId)),
        getTasksByUser: jest.fn().mockReturnValue([]),
        updateTask: jest.fn().mockResolvedValue(undefined),
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
        isRunning: jest.fn().mockReturnValue(false),
      };

      const target: DistributionTarget = {
        id: "target-1",
        userId: "user-1",
        targetType: "obsidian",
        name: "Test",
        enabled: true,
        trigger: { mode: "scheduled", scheduleIntervalMinutes: 5 },
        targetConfig: {},
        status: "idle",
        syncedCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await mockScheduler.register(target);
      expect(tasks.has("target-1")).toBe(true);
      expect(tasks.get("target-1")?.status).toBe("active");

      await mockScheduler.pause("target-1");
      expect(tasks.get("target-1")?.status).toBe("paused");

      await mockScheduler.resume("target-1");
      expect(tasks.get("target-1")?.status).toBe("active");

      await mockScheduler.unregister("target-1");
      expect(tasks.has("target-1")).toBe(false);
    });
  });

  describe("SchedulerConfig", () => {
    it("should define scheduler configuration structure", () => {
      const config: SchedulerConfig = {
        minIntervalMinutes: 1,
        maxConcurrentTasks: 5,
        taskTimeoutMs: 30000,
        retryCount: 3,
        retryDelayMs: 1000,
      };

      expect(config.minIntervalMinutes).toBe(1);
      expect(config.maxConcurrentTasks).toBe(5);
      expect(config.taskTimeoutMs).toBe(30000);
    });
  });
});
