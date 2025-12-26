/**
 * TaskUnderstandingIntegration 集成测试
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import {
  TaskUnderstandingIntegration,
  createTaskUnderstandingIntegration,
} from "../task-understanding-integration";
import type { EngineContext } from "../types";
import type { UnifiedEngine } from "../unified-engine";
import type { TaskAnalyzer } from "../../../ai-agent/task-understanding/analyzer/task-analyzer";
import type { SmartDefaultsService } from "../../../ai-agent/task-understanding/defaults/smart-defaults-service";
import type { PreferenceLearningServiceV2 } from "../../../ai-agent/task-understanding/defaults/preference-learning-service-v2";
import type { UndoService } from "../../../ai-agent/task-understanding/undo/undo-service";
import type { ZeroTakeoverAdapter } from "../../output/zero-takeover-adapter";
import type { UnifiedStreamChunk } from "../../output/types";
import type { TaskUnderstanding } from "../../../ai-agent/task-understanding/types";

// Mock logger
jest.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// Mock feature flags
jest.mock("../../../ai-agent/config/feature-flags", () => ({
  FeatureFlags: {
    ENABLE_TASK_UNDERSTANDING: true,
    ENABLE_ZERO_TAKEOVER: true,
    ENABLE_UNDO_SERVICE: true,
    ENABLE_PREFERENCE_LEARNING_V2: true,
  },
}));

describe("TaskUnderstandingIntegration", () => {
  // Mock dependencies
  let mockTaskAnalyzer: jest.Mocked<TaskAnalyzer>;
  let mockSmartDefaultsService: jest.Mocked<SmartDefaultsService>;
  let mockPreferenceLearningService: jest.Mocked<PreferenceLearningServiceV2>;
  let mockUndoService: jest.Mocked<UndoService>;
  let mockZeroTakeoverAdapter: jest.Mocked<ZeroTakeoverAdapter>;
  let mockEngine: jest.Mocked<UnifiedEngine>;
  let integration: TaskUnderstandingIntegration;

  // Test helpers
  const createTestContext = (
    overrides?: Partial<EngineContext>,
  ): EngineContext => ({
    userId: "user-test-123",
    conversationId: "conv-456",
    bookmarkIds: [1, 2, 3],
    totalBookmarks: 100,
    totalFolders: 10,
    folders: [
      { id: 1, name: "技术" },
      { id: 2, name: "生活" },
    ],
    tags: ["前端", "React"],
    ...overrides,
  });

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
        source: "user_preference",
        confidence: 0.9,
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

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock task analyzer
    mockTaskAnalyzer = {
      analyze: jest.fn().mockResolvedValue(createTestUnderstanding()),
    } as unknown as jest.Mocked<TaskAnalyzer>;

    // Setup mock smart defaults service
    mockSmartDefaultsService = {
      resolveDefaults: jest.fn(),
      resolveDefault: jest.fn(),
    } as unknown as jest.Mocked<SmartDefaultsService>;

    // Setup mock preference learning service
    mockPreferenceLearningService = {
      learnFromExecution: jest.fn().mockResolvedValue(undefined),
      getPreferences: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<PreferenceLearningServiceV2>;

    // Setup mock undo service
    mockUndoService = {
      recordOperation: jest.fn().mockResolvedValue({
        undoId: "undo_test_123",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      }),
      executeUndo: jest
        .fn()
        .mockResolvedValue({ success: true, message: "已撤销" }),
      isUndoAvailable: jest.fn().mockReturnValue(true),
    } as unknown as jest.Mocked<UndoService>;

    // Setup mock zero takeover adapter
    mockZeroTakeoverAdapter = {
      createThinkingChunk: jest.fn().mockReturnValue({
        type: "thinking",
        data: { phase: "understanding", message: "正在理解..." },
      }),
      generateThinkingChunks: jest
        .fn()
        .mockReturnValue([
          {
            type: "thinking",
            data: { phase: "analyzing", message: "分析中..." },
          },
        ]),
      createSmartDefaultsChunk: jest.fn().mockReturnValue({
        type: "smart_defaults_applied",
        data: { defaults: [], confidence: 0.9 },
      }),
      createZeroTakeoverConfirmChunk: jest.fn().mockReturnValue({
        type: "zero_takeover_confirm",
        data: { confirmId: "confirm_123" },
      }),
      createUndoAvailableChunk: jest.fn().mockReturnValue({
        type: "undo_available",
        data: { undoId: "undo_123" },
      }),
    } as unknown as jest.Mocked<ZeroTakeoverAdapter>;

    // Setup mock engine
    mockEngine = {
      execute: jest.fn().mockImplementation(async function* () {
        yield { type: "text", data: { text: "正在处理..." } };
        yield {
          type: "done",
          data: { success: true, summary: "处理完成", mode: "atomic" },
        };
      }),
    } as unknown as jest.Mocked<UnifiedEngine>;

    // Create integration instance
    integration = new TaskUnderstandingIntegration({
      taskAnalyzer: mockTaskAnalyzer,
      smartDefaultsService: mockSmartDefaultsService,
      preferenceLearningService: mockPreferenceLearningService,
      undoService: mockUndoService,
      zeroTakeoverAdapter: mockZeroTakeoverAdapter,
      debug: false,
    });
  });

  describe("isEnabled()", () => {
    it("当所有条件满足时应返回 true", () => {
      expect(integration.isEnabled()).toBe(true);
    });

    it("当缺少 taskAnalyzer 时应返回 false", () => {
      const noAnalyzerIntegration = new TaskUnderstandingIntegration({
        smartDefaultsService: mockSmartDefaultsService,
      });

      expect(noAnalyzerIntegration.isEnabled()).toBe(false);
    });
  });

  describe("executeWithUnderstanding()", () => {
    it("未启用时应直接使用原引擎", async () => {
      const noAnalyzerIntegration = new TaskUnderstandingIntegration({});
      const context = createTestContext();

      const chunks: UnifiedStreamChunk[] = [];
      for await (const chunk of noAnalyzerIntegration.executeWithUnderstanding(
        "帮我整理收藏",
        context,
        mockEngine,
        { enableTaskUnderstanding: true },
      )) {
        chunks.push(chunk);
      }

      expect(mockEngine.execute).toHaveBeenCalled();
      expect(mockTaskAnalyzer.analyze).not.toHaveBeenCalled();
    });

    it("选项禁用时应直接使用原引擎", async () => {
      const context = createTestContext();

      const chunks: UnifiedStreamChunk[] = [];
      for await (const chunk of integration.executeWithUnderstanding(
        "帮我整理收藏",
        context,
        mockEngine,
        { enableTaskUnderstanding: false },
      )) {
        chunks.push(chunk);
      }

      expect(mockEngine.execute).toHaveBeenCalled();
      expect(mockTaskAnalyzer.analyze).not.toHaveBeenCalled();
    });

    it("应输出思考过程", async () => {
      const context = createTestContext();

      const chunks: UnifiedStreamChunk[] = [];
      for await (const chunk of integration.executeWithUnderstanding(
        "帮我整理收藏",
        context,
        mockEngine,
        { enableTaskUnderstanding: true },
      )) {
        chunks.push(chunk);
      }

      // 应有初始思考块
      expect(mockZeroTakeoverAdapter.createThinkingChunk).toHaveBeenCalled();
      // 应有分析后的思考块
      expect(mockZeroTakeoverAdapter.generateThinkingChunks).toHaveBeenCalled();
    });

    it("应输出智能默认值", async () => {
      const context = createTestContext();

      const chunks: UnifiedStreamChunk[] = [];
      for await (const chunk of integration.executeWithUnderstanding(
        "帮我整理收藏",
        context,
        mockEngine,
        { enableTaskUnderstanding: true },
      )) {
        chunks.push(chunk);
      }

      expect(
        mockZeroTakeoverAdapter.createSmartDefaultsChunk,
      ).toHaveBeenCalled();
    });

    it("删除任务应输出确认请求", async () => {
      mockTaskAnalyzer.analyze.mockResolvedValue(
        createTestUnderstanding({
          requiresConfirmation: true,
          confirmationReason: "删除操作不可撤销，请确认",
        }),
      );

      const context = createTestContext();

      const chunks: UnifiedStreamChunk[] = [];
      for await (const chunk of integration.executeWithUnderstanding(
        "删除这些书签",
        context,
        mockEngine,
        { enableTaskUnderstanding: true },
      )) {
        chunks.push(chunk);
      }

      expect(
        mockZeroTakeoverAdapter.createZeroTakeoverConfirmChunk,
      ).toHaveBeenCalled();
      // 不应调用引擎执行
      expect(mockEngine.execute).not.toHaveBeenCalled();
    });

    it("应记录撤销信息", async () => {
      const context = createTestContext();

      const chunks: UnifiedStreamChunk[] = [];
      for await (const chunk of integration.executeWithUnderstanding(
        "帮我整理收藏",
        context,
        mockEngine,
        { enableTaskUnderstanding: true },
      )) {
        chunks.push(chunk);
      }

      expect(mockUndoService.recordOperation).toHaveBeenCalled();
      expect(
        mockZeroTakeoverAdapter.createUndoAvailableChunk,
      ).toHaveBeenCalled();
    });

    it("低风险任务不应记录撤销", async () => {
      mockTaskAnalyzer.analyze.mockResolvedValue(
        createTestUnderstanding({ riskLevel: "low" }),
      );

      const context = createTestContext();

      const chunks: UnifiedStreamChunk[] = [];
      for await (const chunk of integration.executeWithUnderstanding(
        "搜索收藏",
        context,
        mockEngine,
        { enableTaskUnderstanding: true },
      )) {
        chunks.push(chunk);
      }

      expect(mockUndoService.recordOperation).not.toHaveBeenCalled();
    });

    it("应触发偏好学习", async () => {
      const context = createTestContext();

      const chunks: UnifiedStreamChunk[] = [];
      for await (const chunk of integration.executeWithUnderstanding(
        "帮我整理收藏",
        context,
        mockEngine,
        { enableTaskUnderstanding: true },
      )) {
        chunks.push(chunk);
      }

      // 偏好学习是异步的，使用 catch 处理
      expect(
        mockPreferenceLearningService.learnFromExecution,
      ).toHaveBeenCalledWith(
        "user-test-123",
        expect.any(Object),
        expect.any(Object),
        "accepted",
      );
    });

    it("分析失败时应回退到原引擎", async () => {
      mockTaskAnalyzer.analyze.mockRejectedValue(new Error("分析失败"));

      const context = createTestContext();

      const chunks: UnifiedStreamChunk[] = [];
      for await (const chunk of integration.executeWithUnderstanding(
        "帮我整理收藏",
        context,
        mockEngine,
        { enableTaskUnderstanding: true },
      )) {
        chunks.push(chunk);
      }

      // 应有错误块
      expect(chunks.some((c) => c.type === "error")).toBe(true);
      // 应回退到原引擎
      expect(mockEngine.execute).toHaveBeenCalled();
    });

    it("应正确构建任务上下文", async () => {
      const context = createTestContext({
        bookmarkIds: [1, 2, 3],
        folders: [
          { id: 1, name: "技术" },
          { id: 2, name: "生活" },
        ],
        tags: ["前端", "React"],
      });

      const chunks: UnifiedStreamChunk[] = [];
      for await (const chunk of integration.executeWithUnderstanding(
        "帮我整理收藏",
        context,
        mockEngine,
        { enableTaskUnderstanding: true },
      )) {
        chunks.push(chunk);
      }

      expect(mockTaskAnalyzer.analyze).toHaveBeenCalledWith(
        "帮我整理收藏",
        expect.objectContaining({
          userId: "user-test-123",
          input: "帮我整理收藏",
          folders: expect.arrayContaining([
            expect.objectContaining({ id: "1", name: "技术" }),
          ]),
        }),
      );
    });
  });

  describe("executeUndo()", () => {
    it("应执行撤销操作", async () => {
      const result = await integration.executeUndo("undo_123", "user-123");

      expect(result.success).toBe(true);
      expect(mockUndoService.executeUndo).toHaveBeenCalledWith(
        "undo_123",
        "user-123",
      );
    });

    it("撤销服务未启用时应返回失败", async () => {
      const noUndoIntegration = new TaskUnderstandingIntegration({
        taskAnalyzer: mockTaskAnalyzer,
      });

      const result = await noUndoIntegration.executeUndo(
        "undo_123",
        "user-123",
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("撤销服务未启用");
    });
  });

  describe("recordAdjustment()", () => {
    it("应记录用户调整", async () => {
      // 当前是 TODO 实现，只验证不报错
      await expect(
        integration.recordAdjustment("user-123", "tu_123", "按时间整理"),
      ).resolves.toBeUndefined();
    });
  });
});

describe("createTaskUnderstandingIntegration()", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("应创建集成实例", () => {
    const instance = createTaskUnderstandingIntegration();

    expect(instance).toBeInstanceOf(TaskUnderstandingIntegration);
  });

  it("应接受配置参数", () => {
    const mockAnalyzer = { analyze: jest.fn() } as unknown as TaskAnalyzer;

    const instance = createTaskUnderstandingIntegration({
      taskAnalyzer: mockAnalyzer,
      debug: true,
    });

    expect(instance).toBeInstanceOf(TaskUnderstandingIntegration);
  });
});
