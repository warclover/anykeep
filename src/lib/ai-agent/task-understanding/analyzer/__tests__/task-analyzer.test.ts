/**
 * TaskAnalyzer 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import { TaskAnalyzer, createTaskAnalyzer } from "../task-analyzer";
import type { SmartDefaultsService } from "../../defaults/smart-defaults-service";
import type { TaskContext, SmartDefault } from "../../types";
import type { LanguageModel } from "ai";

// Mock logger
jest.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// Mock ai module
jest.mock("ai", () => ({
  generateObject: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const aiModule = require("ai") as { generateObject: jest.Mock };

describe("TaskAnalyzer", () => {
  // Mock dependencies
  let mockModel: jest.Mocked<LanguageModel>;
  let mockSmartDefaultsService: jest.Mocked<SmartDefaultsService>;
  let analyzer: TaskAnalyzer;

  // Test data
  const createTestContext = (
    overrides?: Partial<TaskContext>,
  ): TaskContext => ({
    userId: "user-test-123",
    input: "帮我整理最近的收藏",
    stats: {
      total: 100,
      inbox: 20,
      platformDistribution: { BILIBILI: 50, ZHIHU: 30, WECHAT: 20 },
      weeklyAdded: 15,
    },
    folders: [
      { id: "folder-1", name: "技术" },
      { id: "folder-2", name: "生活" },
      { id: "folder-3", name: "待整理" },
    ],
    recentPlatforms: ["BILIBILI", "ZHIHU"],
    frequentTags: ["前端", "React", "设计"],
    lastTopic: "整理书签",
    ...overrides,
  });

  const createMockSmartDefaults = (): SmartDefault[] => [
    {
      field: "organizeMethod",
      value: "topic",
      source: "user_preference",
      confidence: 0.9,
      reason: "基于用户历史偏好",
    },
    {
      field: "scope",
      value: "all",
      source: "context_infer",
      confidence: 0.85,
      reason: "数据量适中",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock model
    mockModel = {
      modelId: "test-model",
      provider: "test",
      specificationVersion: "v1",
    } as unknown as jest.Mocked<LanguageModel>;

    // Setup mock smart defaults service
    mockSmartDefaultsService = {
      resolveDefaults: jest.fn().mockResolvedValue(createMockSmartDefaults()),
      resolveDefault: jest.fn(),
    } as unknown as jest.Mocked<SmartDefaultsService>;

    // Create analyzer instance with template engine DISABLED to test LLM path
    analyzer = new TaskAnalyzer({
      model: mockModel,
      smartDefaultsService: mockSmartDefaultsService,
      timeoutMs: 30000,
      temperature: 0.3,
      enableTemplateEngine: false, // 禁用模板引擎以测试 LLM 路径
    });
  });

  describe("constructor", () => {
    it("应正确初始化分析器", () => {
      expect(analyzer).toBeInstanceOf(TaskAnalyzer);
    });
  });

  describe("analyze()", () => {
    const mockLLMResponse = {
      goal: "整理最近收藏的内容到合适的文件夹",
      taskType: "organize" as const,
      reasoning: "用户希望整理收藏，根据输入关键词判断是整理任务",
      executionPlan: [
        {
          description: "获取待整理的收藏列表",
          action: "get_bookmarks",
          params: { status: "unclassified" },
        },
        {
          description: "按主题分类",
          action: "classify_by_topic",
        },
        {
          description: "移动到对应文件夹",
          action: "move_bookmarks",
        },
      ],
      riskLevel: "medium" as const,
      confidence: 0.85,
    };

    beforeEach(() => {
      // Mock generateObject from ai
      aiModule.generateObject.mockResolvedValue({ object: mockLLMResponse });
    });

    it("应成功分析用户任务并返回任务理解结果", async () => {
      const context = createTestContext();

      const result = await analyzer.analyze("帮我整理最近的收藏", context);

      expect(result).toBeDefined();
      expect(result.id).toMatch(/^tu_\d+_[a-z0-9]+$/);
      expect(result.rawInput).toBe("帮我整理最近的收藏");
      expect(result.goal).toBe("整理最近收藏的内容到合适的文件夹");
      expect(result.reasoning).toBe(
        "用户希望整理收藏，根据输入关键词判断是整理任务",
      );
      expect(result.confidence).toBe(0.85);
      expect(result.riskLevel).toBe("medium");
    });

    it("应包含执行计划", async () => {
      const context = createTestContext();

      const result = await analyzer.analyze("帮我整理最近的收藏", context);

      expect(result.executionPlan).toHaveLength(3);
      expect(result.executionPlan[0]).toMatchObject({
        step: 1,
        description: "获取待整理的收藏列表",
        action: "get_bookmarks",
      });
    });

    it("应包含智能默认值", async () => {
      const context = createTestContext();

      const result = await analyzer.analyze("帮我整理最近的收藏", context);

      expect(result.appliedDefaults).toHaveLength(2);
      expect(result.appliedDefaults[0].field).toBe("organizeMethod");
      expect(mockSmartDefaultsService.resolveDefaults).toHaveBeenCalledWith(
        "organize",
        context,
      );
    });

    it("应包含元数据", async () => {
      const context = createTestContext();

      const result = await analyzer.analyze("帮我整理最近的收藏", context);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.source).toBe("llm");
      expect(result.metadata.createdAt).toBeInstanceOf(Date);
      expect(typeof result.metadata.processingTimeMs).toBe("number");
    });

    it("应正确识别删除任务需要确认", async () => {
      aiModule.generateObject.mockResolvedValue({
        object: {
          ...mockLLMResponse,
          taskType: "delete",
          riskLevel: "high",
          executionPlan: [
            {
              description: "删除选中的书签",
              action: "delete_bookmarks",
            },
          ],
        },
      });

      const context = createTestContext({ input: "删除这些书签" });

      const result = await analyzer.analyze("删除这些书签", context);

      expect(result.requiresConfirmation).toBe(true);
      expect(result.confirmationReason).toBe("删除操作不可撤销，请确认");
      expect(result.riskLevel).toBe("high");
    });

    it("非删除操作不应需要确认", async () => {
      aiModule.generateObject.mockResolvedValue({
        object: {
          ...mockLLMResponse,
          taskType: "move",
          riskLevel: "medium",
        },
      });

      const context = createTestContext({ input: "移动到技术文件夹" });

      const result = await analyzer.analyze("移动到技术文件夹", context);

      expect(result.requiresConfirmation).toBe(false);
      expect(result.confirmationReason).toBeUndefined();
    });

    it("应在 LLM 失败时返回兜底结果", async () => {
      aiModule.generateObject.mockRejectedValue(new Error("LLM 服务不可用"));

      const context = createTestContext();

      const result = await analyzer.analyze("帮我整理最近的收藏", context);

      expect(result).toBeDefined();
      expect(result.goal).toBe("执行用户请求");
      expect(result.reasoning).toContain("AI 分析遇到问题");
      expect(result.confidence).toBe(0.5);
      expect(result.riskLevel).toBe("low");
      expect(result.requiresConfirmation).toBe(false);
    });

    it("兜底结果应有正确的执行计划", async () => {
      aiModule.generateObject.mockRejectedValue(new Error("LLM 服务不可用"));

      const context = createTestContext();

      const result = await analyzer.analyze("帮我整理最近的收藏", context);

      expect(result.executionPlan).toHaveLength(1);
      expect(result.executionPlan[0].action).toBe("fallback_processing");
    });

    it("应正确标记包含删除操作的执行步骤需要确认", async () => {
      aiModule.generateObject.mockResolvedValue({
        object: {
          ...mockLLMResponse,
          executionPlan: [
            { description: "筛选重复项", action: "find_duplicates" },
            { description: "删除重复书签", action: "delete_duplicates" },
            { description: "整理剩余书签", action: "organize" },
          ],
          riskLevel: "medium",
        },
      });

      const context = createTestContext();

      const result = await analyzer.analyze("清理重复书签", context);

      expect(result.executionPlan[0].requiresConfirmation).toBeFalsy();
      expect(result.executionPlan[1].requiresConfirmation).toBe(true);
      expect(result.executionPlan[2].requiresConfirmation).toBeFalsy();
    });
  });

  describe("createTaskAnalyzer()", () => {
    it("应创建分析器实例", () => {
      const instance = createTaskAnalyzer({
        model: mockModel,
        smartDefaultsService: mockSmartDefaultsService,
        timeoutMs: 30000,
        temperature: 0.3,
      });

      expect(instance).toBeInstanceOf(TaskAnalyzer);
    });
  });

  describe("模板引擎集成", () => {
    let templateEnabledAnalyzer: TaskAnalyzer;

    beforeEach(() => {
      // 创建启用模板引擎的分析器
      templateEnabledAnalyzer = new TaskAnalyzer({
        model: mockModel,
        smartDefaultsService: mockSmartDefaultsService,
        timeoutMs: 30000,
        temperature: 0.3,
        enableTemplateEngine: true, // 启用模板引擎
      });
    });

    it("应优先使用模板匹配", async () => {
      const context = createTestContext();

      // "搜索 React" 应匹配 search_simple 模板
      const result = await templateEnabledAnalyzer.analyze(
        "搜索 React",
        context,
      );

      expect(result.metadata.source).toBe("template");
      expect(result.matchedTemplate).toBe("search_simple");
      expect(result.goal).toContain("react");
    });

    it("模板未匹配时应回退到 LLM", async () => {
      aiModule.generateObject.mockResolvedValue({
        object: {
          goal: "分析用户收藏的规律并提供建议",
          taskType: "other",
          reasoning: "用户希望了解收藏规律",
          executionPlan: [{ description: "分析收藏数据", action: "analyze" }],
          riskLevel: "low",
          confidence: 0.7,
        },
      });

      const context = createTestContext();

      // 复杂输入不应匹配任何模板
      const result = await templateEnabledAnalyzer.analyze(
        "帮我分析一下我的收藏有什么规律，给我一些建议",
        context,
      );

      expect(result.metadata.source).toBe("llm");
      expect(aiModule.generateObject).toHaveBeenCalled();
    });

    it("模板匹配应包含智能默认值", async () => {
      const context = createTestContext();

      const result = await templateEnabledAnalyzer.analyze("整理收藏", context);

      expect(result.metadata.source).toBe("template");
      expect(result.appliedDefaults).toHaveLength(2);
    });

    it("模板匹配应显著减少处理时间", async () => {
      const context = createTestContext();

      const result = await templateEnabledAnalyzer.analyze(
        "搜索 React",
        context,
      );

      // 模板匹配应该几乎不耗时（< 50ms）
      expect(result.metadata.processingTimeMs).toBeLessThan(50);
    });
  });
});
