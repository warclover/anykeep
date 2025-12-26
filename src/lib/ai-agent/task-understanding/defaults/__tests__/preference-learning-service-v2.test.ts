/**
 * PreferenceLearningServiceV2 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import {
  PreferenceLearningServiceV2,
  InMemoryPreferenceLearningStorage,
  createPreferenceLearningServiceV2,
} from "../preference-learning-service-v2";
import type {
  TaskUnderstanding,
  TaskExecutionResult,
  UserPreferences,
} from "../../types";

// Mock logger
jest.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

describe("PreferenceLearningServiceV2", () => {
  let service: PreferenceLearningServiceV2;
  let storage: InMemoryPreferenceLearningStorage;

  // Test helpers
  const createTestUnderstanding = (
    overrides?: Partial<TaskUnderstanding>,
  ): TaskUnderstanding => ({
    id: "tu_test_123",
    rawInput: "帮我整理收藏",
    goal: "整理用户的收藏",
    reasoning: "用户希望整理收藏",
    executionPlan: [{ step: 1, description: "获取收藏列表" }],
    confidence: 0.85,
    requiresConfirmation: false,
    riskLevel: "medium",
    appliedDefaults: [
      {
        field: "organizeMethod",
        value: "topic",
        source: "system_default",
        confidence: 0.6,
      },
      {
        field: "scope",
        value: "all",
        source: "context_infer",
        confidence: 0.8,
      },
    ],
    matchedTemplate: "organize",
    metadata: {
      createdAt: new Date(),
      source: "llm",
      processingTimeMs: 500,
    },
    ...overrides,
  });

  const createTestResult = (
    overrides?: Partial<TaskExecutionResult>,
  ): TaskExecutionResult => ({
    success: true,
    summary: "整理完成",
    understanding: createTestUnderstanding(),
    canUndo: true,
    executionTimeMs: 1000,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    storage = new InMemoryPreferenceLearningStorage();
    // 同步学习便于测试
    service = new PreferenceLearningServiceV2(storage, {
      asyncLearning: false,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("learnFromExecution()", () => {
    describe("接受行为 (accepted)", () => {
      it("应强化使用的默认值", async () => {
        const understanding = createTestUnderstanding();
        const result = createTestResult();

        await service.learnFromExecution(
          "user-123",
          understanding,
          result,
          "accepted",
        );

        const prefs = await service.getPreferences("user-123");
        expect(prefs).not.toBeNull();
        expect(prefs?.defaultUsage?.["organizeMethod"]?.["topic"]).toBe(1);
        expect(prefs?.defaultUsage?.["scope"]?.["all"]).toBe(1);
      });

      it("多次接受应累加计数", async () => {
        const understanding = createTestUnderstanding();
        const result = createTestResult();

        // 接受 3 次
        for (let i = 0; i < 3; i++) {
          await service.learnFromExecution(
            "user-123",
            understanding,
            result,
            "accepted",
          );
        }

        const prefs = await service.getPreferences("user-123");
        expect(prefs?.defaultUsage?.["organizeMethod"]?.["topic"]).toBe(3);
      });

      it("达到阈值后应提升为偏好", async () => {
        const understanding = createTestUnderstanding();
        const result = createTestResult();

        // 默认阈值是 3，所以接受 3 次
        for (let i = 0; i < 3; i++) {
          await service.learnFromExecution(
            "user-123",
            understanding,
            result,
            "accepted",
          );
        }

        const prefs = await service.getPreferences("user-123");
        expect(prefs?.preferredOrganizeMethod).toBe("topic");
      });

      it("常用文件夹应添加到列表", async () => {
        const understanding = createTestUnderstanding({
          appliedDefaults: [
            {
              field: "targetFolder",
              value: "folder-123",
              source: "context_infer",
              confidence: 0.8,
            },
          ],
        });
        const result = createTestResult();

        // 接受 3 次达到阈值
        for (let i = 0; i < 3; i++) {
          await service.learnFromExecution(
            "user-123",
            understanding,
            result,
            "accepted",
          );
        }

        const prefs = await service.getPreferences("user-123");
        expect(prefs?.frequentFolders).toContain("folder-123");
      });
    });

    describe("撤销行为 (undone)", () => {
      it("应弱化使用的默认值", async () => {
        // 先建立一些使用记录
        const understanding = createTestUnderstanding();
        const result = createTestResult();

        // 接受 2 次
        await service.learnFromExecution(
          "user-123",
          understanding,
          result,
          "accepted",
        );
        await service.learnFromExecution(
          "user-123",
          understanding,
          result,
          "accepted",
        );

        let prefs = await service.getPreferences("user-123");
        expect(prefs?.defaultUsage?.["organizeMethod"]?.["topic"]).toBe(2);

        // 然后撤销（默认弱化权重是 2）
        await service.learnFromExecution(
          "user-123",
          understanding,
          result,
          "undone",
        );

        prefs = await service.getPreferences("user-123");
        expect(prefs?.defaultUsage?.["organizeMethod"]?.["topic"]).toBe(0);
      });

      it("计数不应低于 0", async () => {
        const understanding = createTestUnderstanding();
        const result = createTestResult();

        // 直接撤销（没有之前的使用记录）
        await service.learnFromExecution(
          "user-123",
          understanding,
          result,
          "undone",
        );

        const prefs = await service.getPreferences("user-123");
        expect(prefs?.defaultUsage?.["organizeMethod"]?.["topic"]).toBe(0);
      });

      it("弱化到 0 后应移除偏好", async () => {
        const understanding = createTestUnderstanding();
        const result = createTestResult();

        // 先建立偏好
        for (let i = 0; i < 3; i++) {
          await service.learnFromExecution(
            "user-123",
            understanding,
            result,
            "accepted",
          );
        }

        let prefs = await service.getPreferences("user-123");
        expect(prefs?.preferredOrganizeMethod).toBe("topic");

        // 撤销多次
        await service.learnFromExecution(
          "user-123",
          understanding,
          result,
          "undone",
        );
        await service.learnFromExecution(
          "user-123",
          understanding,
          result,
          "undone",
        );

        prefs = await service.getPreferences("user-123");
        expect(prefs?.preferredOrganizeMethod).toBeUndefined();
      });
    });

    describe("调整行为 (adjusted)", () => {
      it("应学习新的偏好", async () => {
        const understanding = createTestUnderstanding({
          appliedDefaults: [
            {
              field: "organizeMethod",
              value: "topic",
              source: "system_default",
              confidence: 0.6,
            },
          ],
        });
        const result = createTestResult({
          adjustment: {
            type: "modify",
            content: "按时间整理",
            adjustedAt: new Date(),
          },
        });

        await service.learnFromExecution(
          "user-123",
          understanding,
          result,
          "adjusted",
        );

        const prefs = await service.getPreferences("user-123");
        // 原来的 topic 应被弱化
        expect(prefs?.defaultUsage?.["organizeMethod"]?.["topic"]).toBe(0);
        // 新的 time 应被强化
        expect(prefs?.defaultUsage?.["organizeMethod"]?.["time"]).toBe(1);
      });
    });

    describe("异步学习", () => {
      it("应异步执行学习", async () => {
        const asyncService = new PreferenceLearningServiceV2(storage, {
          asyncLearning: true,
        });
        const understanding = createTestUnderstanding();
        const result = createTestResult();

        // 调用不会立即完成
        await asyncService.learnFromExecution(
          "user-123",
          understanding,
          result,
          "accepted",
        );

        // 执行定时器
        await jest.runAllTimersAsync();

        const prefs = await asyncService.getPreferences("user-123");
        expect(prefs?.defaultUsage?.["organizeMethod"]?.["topic"]).toBe(1);
      });
    });
  });

  describe("getPreferences()", () => {
    it("应返回用户偏好", async () => {
      // 先创建偏好
      const understanding = createTestUnderstanding();
      const result = createTestResult();
      await service.learnFromExecution(
        "user-123",
        understanding,
        result,
        "accepted",
      );

      const prefs = await service.getPreferences("user-123");

      expect(prefs).not.toBeNull();
      expect(prefs?.userId).toBe("user-123");
    });

    it("无偏好时应返回 null", async () => {
      const prefs = await service.getPreferences("unknown-user");

      expect(prefs).toBeNull();
    });
  });

  describe("getLearningRecords()", () => {
    it("应返回学习记录", async () => {
      const understanding = createTestUnderstanding();
      const result = createTestResult();

      await service.learnFromExecution(
        "user-123",
        understanding,
        result,
        "accepted",
      );
      await service.learnFromExecution(
        "user-123",
        understanding,
        result,
        "undone",
      );

      const records = await service.getLearningRecords("user-123");

      // 每个 appliedDefault 都会产生一条记录
      expect(records.length).toBeGreaterThan(0);
      expect(records[0].userId).toBe("user-123");
    });

    it("应限制返回数量", async () => {
      const understanding = createTestUnderstanding();
      const result = createTestResult();

      // 创建多条记录
      for (let i = 0; i < 10; i++) {
        await service.learnFromExecution(
          "user-123",
          understanding,
          result,
          "accepted",
        );
      }

      const records = await service.getLearningRecords("user-123", 5);

      expect(records.length).toBeLessThanOrEqual(5);
    });
  });

  describe("resetPreferences()", () => {
    it("应重置用户偏好", async () => {
      // 先创建偏好
      const understanding = createTestUnderstanding();
      const result = createTestResult();
      await service.learnFromExecution(
        "user-123",
        understanding,
        result,
        "accepted",
      );

      let prefs = await service.getPreferences("user-123");
      expect(prefs).not.toBeNull();

      // 重置
      await service.resetPreferences("user-123");

      prefs = await service.getPreferences("user-123");
      expect(prefs).toBeNull();
    });
  });

  describe("配置选项", () => {
    it("应使用自定义阈值", async () => {
      const customService = new PreferenceLearningServiceV2(storage, {
        preferenceThreshold: 5,
        asyncLearning: false,
      });

      const understanding = createTestUnderstanding();
      const result = createTestResult();

      // 接受 3 次（默认阈值）
      for (let i = 0; i < 3; i++) {
        await customService.learnFromExecution(
          "user-456",
          understanding,
          result,
          "accepted",
        );
      }

      // 不应提升为偏好（因为阈值是 5）
      let prefs = await customService.getPreferences("user-456");
      expect(prefs?.preferredOrganizeMethod).toBeUndefined();

      // 再接受 2 次
      for (let i = 0; i < 2; i++) {
        await customService.learnFromExecution(
          "user-456",
          understanding,
          result,
          "accepted",
        );
      }

      // 现在应该提升为偏好
      prefs = await customService.getPreferences("user-456");
      expect(prefs?.preferredOrganizeMethod).toBe("topic");
    });

    it("应使用自定义权重", async () => {
      const customService = new PreferenceLearningServiceV2(storage, {
        acceptReinforceWeight: 2,
        undoWeakenWeight: 1,
        asyncLearning: false,
      });

      const understanding = createTestUnderstanding();
      const result = createTestResult();

      // 接受 1 次（权重 2）
      await customService.learnFromExecution(
        "user-789",
        understanding,
        result,
        "accepted",
      );

      let prefs = await customService.getPreferences("user-789");
      expect(prefs?.defaultUsage?.["organizeMethod"]?.["topic"]).toBe(2);

      // 撤销 1 次（权重 1）
      await customService.learnFromExecution(
        "user-789",
        understanding,
        result,
        "undone",
      );

      prefs = await customService.getPreferences("user-789");
      expect(prefs?.defaultUsage?.["organizeMethod"]?.["topic"]).toBe(1);
    });
  });
});

describe("InMemoryPreferenceLearningStorage", () => {
  let storage: InMemoryPreferenceLearningStorage;

  beforeEach(() => {
    storage = new InMemoryPreferenceLearningStorage();
  });

  describe("getPreferences()", () => {
    it("应返回 null 如果不存在", async () => {
      const result = await storage.getPreferences("unknown");
      expect(result).toBeNull();
    });

    it("应返回保存的偏好", async () => {
      const prefs: UserPreferences = {
        userId: "user-123",
        preferredOrganizeMethod: "topic",
        updatedAt: new Date(),
      };

      await storage.savePreferences(prefs);
      const result = await storage.getPreferences("user-123");

      expect(result).toEqual(prefs);
    });
  });

  describe("savePreferences()", () => {
    it("应保存偏好", async () => {
      const prefs: UserPreferences = {
        userId: "user-456",
        frequentTags: ["tag1", "tag2"],
        updatedAt: new Date(),
      };

      await storage.savePreferences(prefs);
      const result = await storage.getPreferences("user-456");

      expect(result?.frequentTags).toEqual(["tag1", "tag2"]);
    });
  });

  describe("resetPreferences()", () => {
    it("应删除偏好和记录", async () => {
      const prefs: UserPreferences = {
        userId: "user-789",
        updatedAt: new Date(),
      };

      await storage.savePreferences(prefs);
      await storage.saveLearningRecord({
        userId: "user-789",
        taskType: "organize",
        appliedDefault: {
          field: "test",
          value: "test",
          source: "system_default",
          confidence: 0.5,
        },
        userAction: "accepted",
        recordedAt: new Date(),
      });

      await storage.resetPreferences("user-789");

      expect(await storage.getPreferences("user-789")).toBeNull();
      expect(await storage.getLearningRecords("user-789", 10)).toEqual([]);
    });
  });

  describe("getLearningRecords()", () => {
    it("应限制记录数量", async () => {
      // 添加超过 1000 条记录
      for (let i = 0; i < 1005; i++) {
        await storage.saveLearningRecord({
          userId: "user-overflow",
          taskType: "organize",
          appliedDefault: {
            field: "test",
            value: `value-${i}`,
            source: "system_default",
            confidence: 0.5,
          },
          userAction: "accepted",
          recordedAt: new Date(),
        });
      }

      const records = await storage.getLearningRecords("user-overflow", 2000);

      // 最多保留 1000 条
      expect(records.length).toBeLessThanOrEqual(1000);
    });
  });
});

describe("createPreferenceLearningServiceV2()", () => {
  it("应创建服务实例", () => {
    const storage = new InMemoryPreferenceLearningStorage();
    const service = createPreferenceLearningServiceV2(storage);

    expect(service).toBeInstanceOf(PreferenceLearningServiceV2);
  });

  it("应接受配置参数", () => {
    const storage = new InMemoryPreferenceLearningStorage();
    const service = createPreferenceLearningServiceV2(storage, {
      preferenceThreshold: 10,
    });

    expect(service).toBeInstanceOf(PreferenceLearningServiceV2);
  });
});
