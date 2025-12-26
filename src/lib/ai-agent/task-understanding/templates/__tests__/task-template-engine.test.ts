/**
 * TaskTemplateEngine 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import {
  TaskTemplateEngine,
  createTaskTemplateEngine,
} from "../task-template-engine";
import {
  defaultTemplates,
  searchSimpleTemplate,
  organizeGeneralTemplate,
  deleteBookmarksTemplate,
} from "../templates";
import type { TaskContext } from "../../types";
import type { TaskTemplate } from "../types";

// Mock logger
jest.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

describe("TaskTemplateEngine", () => {
  let engine: TaskTemplateEngine;

  // Test helper
  const createTestContext = (
    overrides?: Partial<TaskContext>,
  ): TaskContext => ({
    userId: "user-test-123",
    input: "测试输入",
    stats: {
      total: 100,
      inbox: 20,
      platformDistribution: { BILIBILI: 50, ZHIHU: 30, WECHAT: 20 },
      weeklyAdded: 15,
    },
    folders: [
      { id: "folder-1", name: "技术" },
      { id: "folder-2", name: "生活" },
    ],
    recentPlatforms: ["BILIBILI", "ZHIHU"],
    frequentTags: ["前端", "React"],
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new TaskTemplateEngine({
      templates: defaultTemplates,
      minConfidence: 0.7,
      debug: false,
    });
  });

  describe("constructor", () => {
    it("应正确初始化引擎", () => {
      expect(engine).toBeInstanceOf(TaskTemplateEngine);
      expect(engine.getTemplates()).toHaveLength(defaultTemplates.length);
    });

    it("应按优先级排序模板", () => {
      const templates = engine.getTemplates();
      for (let i = 1; i < templates.length; i++) {
        expect(templates[i - 1].priority).toBeGreaterThanOrEqual(
          templates[i].priority,
        );
      }
    });
  });

  describe("match()", () => {
    describe("搜索模板匹配", () => {
      it("应匹配「搜索 XXX」格式", () => {
        const context = createTestContext();
        const result = engine.match("搜索 React", context);

        expect(result.matched).toBe(true);
        expect(result.template?.id).toBe("search_simple");
        expect(result.extractedParams.query).toBe("react");
      });

      it("应匹配「查找 XXX」格式", () => {
        const context = createTestContext();
        const result = engine.match("查找前端文章", context);

        expect(result.matched).toBe(true);
        expect(result.template?.id).toBe("search_simple");
      });

      it("应匹配「找一下 XXX」格式", () => {
        const context = createTestContext();
        const result = engine.match("找一下设计资料", context);

        expect(result.matched).toBe(true);
        expect(result.template?.id).toBe("search_simple");
      });
    });

    describe("整理模板匹配", () => {
      it("应匹配「整理收藏」", () => {
        const context = createTestContext();
        const result = engine.match("整理收藏", context);

        expect(result.matched).toBe(true);
        expect(result.template?.id).toBe("organize_general");
      });

      it("应匹配「帮我整理一下收藏」", () => {
        const context = createTestContext();
        const result = engine.match("帮我整理一下收藏", context);

        expect(result.matched).toBe(true);
        expect(result.template?.id).toBe("organize_general");
      });

      it("应匹配「按时间整理」", () => {
        const context = createTestContext();
        const result = engine.match("按时间整理", context);

        expect(result.matched).toBe(true);
        expect(result.template?.id).toBe("organize_by_time");
      });

      it("「按时间整理」应排除通用整理模板", () => {
        const context = createTestContext();
        const result = engine.match("按时间整理收藏", context);

        expect(result.matched).toBe(true);
        // 按时间整理优先级更高
        expect(result.template?.id).toBe("organize_by_time");
      });
    });

    describe("移动模板匹配", () => {
      it("应匹配「移动到 XXX 文件夹」", () => {
        const context = createTestContext();
        const result = engine.match("移动到技术文件夹", context);

        expect(result.matched).toBe(true);
        expect(result.template?.id).toBe("move_to_folder");
        expect(result.extractedParams.folder).toBe("技术");
      });

      it("应匹配「移到 XXX」", () => {
        const context = createTestContext();
        const result = engine.match("移到生活", context);

        expect(result.matched).toBe(true);
        expect(result.template?.id).toBe("move_to_folder");
        expect(result.extractedParams.folder).toBe("生活");
      });

      it("应匹配「放到 XXX」", () => {
        const context = createTestContext();
        const result = engine.match("放到工作", context);

        expect(result.matched).toBe(true);
        expect(result.template?.id).toBe("move_to_folder");
      });
    });

    describe("导出模板匹配", () => {
      it("应匹配「导出收藏」", () => {
        const context = createTestContext();
        const result = engine.match("导出收藏", context);

        expect(result.matched).toBe(true);
        expect(result.template?.id).toBe("export_general");
      });

      it("应匹配「导出为 csv」", () => {
        const context = createTestContext();
        const result = engine.match("导出为 csv", context);

        expect(result.matched).toBe(true);
        expect(result.template?.id).toBe("export_with_format");
        expect(result.extractedParams.format).toBe("csv");
      });

      it("应匹配「导出 json 格式」", () => {
        const context = createTestContext();
        const result = engine.match("导出 json 格式", context);

        expect(result.matched).toBe(true);
        expect(result.template?.id).toBe("export_with_format");
        expect(result.extractedParams.format).toBe("json");
      });

      it("应匹配「导出为 markdown」", () => {
        const context = createTestContext();
        const result = engine.match("导出为 markdown", context);

        expect(result.matched).toBe(true);
        expect(result.template?.id).toBe("export_with_format");
        expect(result.extractedParams.format).toBe("markdown");
      });
    });

    describe("查询统计模板匹配", () => {
      it("应匹配「我有多少收藏」", () => {
        const context = createTestContext();
        const result = engine.match("我有多少收藏", context);

        expect(result.matched).toBe(true);
        expect(result.template?.id).toBe("query_stats");
      });

      it("应匹配「统计一下」", () => {
        const context = createTestContext();
        const result = engine.match("统计一下收藏", context);

        expect(result.matched).toBe(true);
        expect(result.template?.id).toBe("query_stats");
      });
    });

    describe("删除模板匹配", () => {
      it("应匹配「删除书签」", () => {
        const context = createTestContext();
        const result = engine.match("删除书签", context);

        expect(result.matched).toBe(true);
        expect(result.template?.id).toBe("delete_bookmarks");
        expect(result.template?.requiresConfirmation).toBe(true);
      });

      it("应匹配「删掉这些收藏」", () => {
        const context = createTestContext();
        const result = engine.match("删掉这些收藏", context);

        expect(result.matched).toBe(true);
        expect(result.template?.id).toBe("delete_bookmarks");
      });
    });

    describe("未匹配情况", () => {
      it("复杂输入应不匹配", () => {
        const context = createTestContext();
        const result = engine.match(
          "帮我分析一下最近收藏的内容有什么规律，然后给我一些整理建议",
          context,
        );

        expect(result.matched).toBe(false);
        expect(result.confidence).toBe(0);
      });

      it("无关输入应不匹配", () => {
        const context = createTestContext();
        const result = engine.match("今天天气怎么样", context);

        expect(result.matched).toBe(false);
      });
    });

    describe("置信度计算", () => {
      it("正则匹配应有更高置信度", () => {
        const context = createTestContext();
        const result = engine.match("搜索 React", context);

        expect(result.confidence).toBeGreaterThan(0.8);
      });

      it("有上下文时置信度不应低于无上下文时", () => {
        const contextWithData = createTestContext({
          stats: { total: 100, inbox: 20, platformDistribution: {} },
        });
        const contextWithoutData = createTestContext({
          stats: { total: 0, inbox: 0, platformDistribution: {} },
        });

        const resultWithData = engine.match("搜索 React", contextWithData);
        const resultWithoutData = engine.match(
          "搜索 React",
          contextWithoutData,
        );

        // 有上下文时置信度不应低于无上下文时（可能相等，因为置信度被限制在 0-1）
        expect(resultWithData.confidence).toBeGreaterThanOrEqual(
          resultWithoutData.confidence,
        );
        // 两者都应高于最小阈值
        expect(resultWithData.confidence).toBeGreaterThanOrEqual(0.7);
        expect(resultWithoutData.confidence).toBeGreaterThanOrEqual(0.7);
      });
    });

    describe("排除词处理", () => {
      it("通用整理不应匹配含「按时间」的输入", () => {
        // 创建只有通用整理模板的引擎
        const limitedEngine = new TaskTemplateEngine({
          templates: [organizeGeneralTemplate],
          minConfidence: 0.7,
        });

        const context = createTestContext();
        const result = limitedEngine.match("按时间整理收藏", context);

        expect(result.matched).toBe(false);
      });

      it("通用导出不应匹配含格式关键词的输入", () => {
        const context = createTestContext();
        // 导出为 csv 应该匹配 export_with_format 而不是 export_general
        const result = engine.match("导出为 csv", context);

        expect(result.template?.id).not.toBe("export_general");
      });
    });
  });

  describe("generateUnderstanding()", () => {
    it("应从匹配结果生成任务理解", () => {
      const context = createTestContext();
      const matchResult = engine.match("搜索 React", context);
      const smartDefaults = [
        {
          field: "searchMode",
          value: "keyword",
          source: "system_default" as const,
          confidence: 0.8,
        },
      ];

      const understanding = engine.generateUnderstanding(
        matchResult,
        "搜索 React",
        smartDefaults,
      );

      expect(understanding.id).toMatch(/^tu_\d+_[a-z0-9]+$/);
      expect(understanding.rawInput).toBe("搜索 React");
      expect(understanding.goal).toContain("react");
      expect(understanding.matchedTemplate).toBe("search_simple");
      expect(understanding.metadata.source).toBe("template");
      expect(understanding.appliedDefaults).toEqual(smartDefaults);
    });

    it("应正确渲染执行计划", () => {
      const context = createTestContext();
      const matchResult = engine.match("移动到技术", context);

      const understanding = engine.generateUnderstanding(
        matchResult,
        "移动到技术",
        [],
      );

      expect(understanding.executionPlan.length).toBeGreaterThan(0);
      expect(understanding.executionPlan[0].description).toContain("技术");
    });

    it("删除模板应设置需要确认", () => {
      const context = createTestContext();
      const matchResult = engine.match("删除书签", context);

      const understanding = engine.generateUnderstanding(
        matchResult,
        "删除书签",
        [],
      );

      expect(understanding.requiresConfirmation).toBe(true);
      expect(understanding.riskLevel).toBe("high");
    });

    it("未匹配时应抛出错误", () => {
      const unmatchedResult = {
        matched: false,
        extractedParams: {},
        confidence: 0,
      };

      expect(() =>
        engine.generateUnderstanding(unmatchedResult, "test", []),
      ).toThrow("无法从未匹配的结果生成任务理解");
    });
  });

  describe("模板管理", () => {
    it("应添加新模板", () => {
      const newTemplate: TaskTemplate = {
        id: "custom_test",
        name: "自定义测试",
        taskType: "other",
        patterns: [/^测试模板$/],
        keywords: [],
        goalTemplate: "执行自定义测试",
        reasoningTemplate: "这是一个测试模板",
        executionPlanTemplate: [
          { descriptionTemplate: "测试步骤", action: "test" },
        ],
        riskLevel: "low",
        baseConfidence: 0.9,
        requiresConfirmation: false,
        priority: 200,
        enabled: true,
      };

      engine.addTemplate(newTemplate);

      expect(
        engine.getTemplates().find((t) => t.id === "custom_test"),
      ).toBeDefined();
    });

    it("添加后应重新排序", () => {
      const highPriorityTemplate: TaskTemplate = {
        id: "high_priority",
        name: "高优先级",
        taskType: "other",
        patterns: [/^高优先级$/],
        keywords: [],
        goalTemplate: "高优先级任务",
        reasoningTemplate: "优先级最高",
        executionPlanTemplate: [],
        riskLevel: "low",
        baseConfidence: 0.9,
        requiresConfirmation: false,
        priority: 999,
        enabled: true,
      };

      engine.addTemplate(highPriorityTemplate);

      expect(engine.getTemplates()[0].id).toBe("high_priority");
    });

    it("应移除模板", () => {
      const result = engine.removeTemplate("search_simple");

      expect(result).toBe(true);
      expect(
        engine.getTemplates().find((t) => t.id === "search_simple"),
      ).toBeUndefined();
    });

    it("移除不存在的模板应返回 false", () => {
      const result = engine.removeTemplate("non_existent");

      expect(result).toBe(false);
    });

    it("应启用/禁用模板", () => {
      engine.setTemplateEnabled("search_simple", false);

      const context = createTestContext();
      const result = engine.match("搜索 React", context);

      // 禁用后不应匹配
      expect(result.template?.id).not.toBe("search_simple");
    });

    it("启用/禁用不存在的模板应返回 false", () => {
      const result = engine.setTemplateEnabled("non_existent", true);

      expect(result).toBe(false);
    });
  });

  describe("createTaskTemplateEngine()", () => {
    it("应创建引擎实例", () => {
      const instance = createTaskTemplateEngine({
        templates: defaultTemplates,
      });

      expect(instance).toBeInstanceOf(TaskTemplateEngine);
    });

    it("应使用默认配置", () => {
      const instance = createTaskTemplateEngine({
        templates: [],
      });

      expect(instance.getTemplates()).toHaveLength(0);
    });
  });
});

describe("预定义模板", () => {
  describe("searchSimpleTemplate", () => {
    it("应有正确的配置", () => {
      expect(searchSimpleTemplate.id).toBe("search_simple");
      expect(searchSimpleTemplate.taskType).toBe("search");
      expect(searchSimpleTemplate.riskLevel).toBe("low");
      expect(searchSimpleTemplate.requiresConfirmation).toBe(false);
    });
  });

  describe("deleteBookmarksTemplate", () => {
    it("应需要确认", () => {
      expect(deleteBookmarksTemplate.requiresConfirmation).toBe(true);
      expect(deleteBookmarksTemplate.riskLevel).toBe("high");
      expect(deleteBookmarksTemplate.confirmationReason).toBeDefined();
    });
  });

  describe("defaultTemplates", () => {
    it("应包含所有必需的模板", () => {
      const templateIds = defaultTemplates.map((t) => t.id);

      expect(templateIds).toContain("search_simple");
      expect(templateIds).toContain("organize_general");
      expect(templateIds).toContain("organize_by_time");
      expect(templateIds).toContain("move_to_folder");
      expect(templateIds).toContain("export_general");
      expect(templateIds).toContain("export_with_format");
      expect(templateIds).toContain("query_stats");
      expect(templateIds).toContain("delete_bookmarks");
      expect(templateIds).toContain("batch_add_tags");
      expect(templateIds).toContain("batch_remove_tags");
      expect(templateIds).toContain("review_knowledge");
    });

    it("所有模板应有唯一 ID", () => {
      const ids = defaultTemplates.map((t) => t.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });

    it("所有模板应启用", () => {
      for (const template of defaultTemplates) {
        expect(template.enabled).toBe(true);
      }
    });
  });
});
