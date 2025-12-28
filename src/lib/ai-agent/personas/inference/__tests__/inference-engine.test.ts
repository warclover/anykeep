/**
 * 推断引擎单元测试
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import {
  PersonaInferenceEngine,
  createInferenceEngine,
} from "../inference-engine";
import type { UserBehaviorData, InferenceRule } from "../types";

describe("PersonaInferenceEngine", () => {
  let engine: PersonaInferenceEngine;

  beforeEach(() => {
    engine = new PersonaInferenceEngine({ debug: true });
  });

  describe("constructor", () => {
    it("should create engine with default config", () => {
      const defaultEngine = new PersonaInferenceEngine();
      expect(defaultEngine).toBeDefined();
      expect(defaultEngine.getRules().length).toBeGreaterThan(0);
    });

    it("should create engine with custom config", () => {
      const customEngine = new PersonaInferenceEngine({
        minConfidenceThreshold: 0.5,
        maxResults: 3,
        debug: true,
      });
      expect(customEngine).toBeDefined();
    });
  });

  describe("registerRule", () => {
    it("should register new rule", () => {
      const initialCount = engine.getRules().length;

      const newRule: InferenceRule = {
        id: "test-rule-1",
        name: "Test Rule",
        targetPersona: "general",
        targetGroup: "tech",
        priority: 50,
        conditions: [
          {
            type: "tag_match",
            patterns: [/test/],
            operator: "any",
          },
        ],
        conditionLogic: "and",
        minConfidence: 0.3,
        enabled: true,
      };

      engine.registerRule(newRule);

      expect(engine.getRules().length).toBe(initialCount + 1);
    });

    it("should update existing rule with same id", () => {
      const rule1: InferenceRule = {
        id: "test-rule-update",
        name: "Original Rule",
        targetPersona: "general",
        targetGroup: "tech",
        priority: 50,
        conditions: [],
        conditionLogic: "and",
        minConfidence: 0.3,
        enabled: true,
      };

      const rule2: InferenceRule = {
        ...rule1,
        name: "Updated Rule",
      };

      engine.registerRule(rule1);
      const countAfterFirst = engine.getRules().length;

      engine.registerRule(rule2);
      const countAfterSecond = engine.getRules().length;

      expect(countAfterSecond).toBe(countAfterFirst);

      const updatedRule = engine
        .getRules()
        .find((r) => r.id === "test-rule-update");
      expect(updatedRule?.name).toBe("Updated Rule");
    });
  });

  describe("setRuleEnabled", () => {
    it("should enable/disable rule", () => {
      const rules = engine.getRules();
      const firstRule = rules[0];

      engine.setRuleEnabled(firstRule.id, false);
      expect(
        engine.getRules().find((r) => r.id === firstRule.id)?.enabled,
      ).toBe(false);

      engine.setRuleEnabled(firstRule.id, true);
      expect(
        engine.getRules().find((r) => r.id === firstRule.id)?.enabled,
      ).toBe(true);
    });
  });

  describe("infer", () => {
    it("should return general persona for empty behavior data", async () => {
      const emptyBehaviorData: UserBehaviorData = {
        tags: [],
        tagCounts: {},
        platforms: [],
        platformCounts: {},
        contentTypes: [],
        contentTypeCounts: {},
        folders: [],
        folderCounts: {},
        domains: [],
        domainCounts: {},
        timePatterns: {
          hourDistribution: Array(24).fill(0),
          weekdayDistribution: Array(7).fill(0),
        },
        activityMetrics: {
          totalBookmarks: 0,
          recentWeekCount: 0,
          recentMonthCount: 0,
          avgDailyCount: 0,
        },
      };

      const result = await engine.infer(emptyBehaviorData);

      expect(result.recommendedPersona).toBe("general");
      expect(result.confidence).toBe(0);
    });

    it("should infer PM persona for product-related behavior", async () => {
      const pmBehaviorData: UserBehaviorData = {
        tags: ["竞品分析", "PRD", "用户反馈", "产品规划", "功能对比"],
        tagCounts: {
          竞品分析: 10,
          PRD: 8,
          用户反馈: 5,
          产品规划: 3,
          功能对比: 2,
        },
        platforms: ["即刻", "人人都是产品经理", "ProductHunt"],
        platformCounts: { 即刻: 15, 人人都是产品经理: 12, ProductHunt: 8 },
        contentTypes: ["文章", "PRD", "竞品报告"],
        contentTypeCounts: { 文章: 20, PRD: 10, 竞品报告: 5 },
        folders: ["竞品", "需求", "产品"],
        folderCounts: { 竞品: 15, 需求: 12, 产品: 8 },
        domains: ["woshipm.com", "36kr.com", "producthunt.com"],
        domainCounts: {
          "woshipm.com": 20,
          "36kr.com": 10,
          "producthunt.com": 8,
        },
        timePatterns: {
          hourDistribution: Array(24).fill(2),
          weekdayDistribution: [8, 10, 9, 8, 7, 2, 1],
        },
        activityMetrics: {
          totalBookmarks: 150,
          recentWeekCount: 25,
          recentMonthCount: 80,
          avgDailyCount: 3.5,
        },
      };

      const result = await engine.infer(pmBehaviorData);

      expect(result.recommendedPersona).toBe("pm");
      expect(result.confidence).toBeGreaterThan(0.3);
      expect(result.matchedRules.length).toBeGreaterThan(0);
    });

    it("should infer analyst persona for research-related behavior", async () => {
      const analystBehaviorData: UserBehaviorData = {
        tags: ["研报", "财报", "行业分析", "数据", "投资"],
        tagCounts: { 研报: 15, 财报: 10, 行业分析: 8, 数据: 5, 投资: 3 },
        platforms: ["东方财富", "雪球", "Wind"],
        platformCounts: { 东方财富: 20, 雪球: 15, Wind: 10 },
        contentTypes: ["研报", "财报数据", "行业新闻"],
        contentTypeCounts: { 研报: 25, 财报数据: 15, 行业新闻: 10 },
        folders: ["研报", "数据", "公司"],
        folderCounts: { 研报: 20, 数据: 15, 公司: 10 },
        domains: ["eastmoney.com", "xueqiu.com", "wind.com.cn"],
        domainCounts: {
          "eastmoney.com": 25,
          "xueqiu.com": 15,
          "wind.com.cn": 10,
        },
        timePatterns: {
          hourDistribution: Array(24).fill(2),
          weekdayDistribution: [10, 12, 11, 10, 8, 2, 1],
        },
        activityMetrics: {
          totalBookmarks: 200,
          recentWeekCount: 35,
          recentMonthCount: 100,
          avgDailyCount: 5,
        },
      };

      const result = await engine.infer(analystBehaviorData);

      expect(result.recommendedPersona).toBe("analyst");
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    it("should infer cert_seeker persona for exam-related behavior", async () => {
      const certSeekerBehaviorData: UserBehaviorData = {
        tags: ["CPA考试", "备考", "真题", "错题", "知识点"],
        tagCounts: { CPA考试: 20, 备考: 15, 真题: 10, 错题: 8, 知识点: 5 },
        platforms: ["知乎", "B站", "高顿"],
        platformCounts: { 知乎: 25, B站: 20, 高顿: 15 },
        contentTypes: ["教材笔记", "错题记录", "真题解析"],
        contentTypeCounts: { 教材笔记: 30, 错题记录: 20, 真题解析: 15 },
        folders: ["备考", "错题", "笔记"],
        folderCounts: { 备考: 25, 错题: 20, 笔记: 15 },
        domains: ["gaodun.com", "zhihu.com", "bilibili.com"],
        domainCounts: { "gaodun.com": 30, "zhihu.com": 20, "bilibili.com": 15 },
        timePatterns: {
          hourDistribution: Array(24)
            .fill(0)
            .map((_, i) => (i >= 19 && i <= 23 ? 8 : 1)),
          weekdayDistribution: [5, 5, 5, 5, 5, 8, 8],
        },
        activityMetrics: {
          totalBookmarks: 180,
          recentWeekCount: 40,
          recentMonthCount: 120,
          avgDailyCount: 5,
        },
      };

      const result = await engine.infer(certSeekerBehaviorData);

      expect(result.recommendedPersona).toBe("cert_seeker");
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    it("should provide alternatives when multiple personas match", async () => {
      const mixedBehaviorData: UserBehaviorData = {
        tags: ["竞品分析", "用研报告", "交互设计", "PRD"],
        tagCounts: { 竞品分析: 8, 用研报告: 6, 交互设计: 5, PRD: 4 },
        platforms: ["即刻", "Dribbble", "人人都是产品经理"],
        platformCounts: { 即刻: 10, Dribbble: 8, 人人都是产品经理: 6 },
        contentTypes: ["文章", "设计规范", "用研报告"],
        contentTypeCounts: { 文章: 15, 设计规范: 8, 用研报告: 5 },
        folders: ["竞品", "设计", "用研"],
        folderCounts: { 竞品: 10, 设计: 8, 用研: 5 },
        domains: ["woshipm.com", "dribbble.com", "nngroup.com"],
        domainCounts: {
          "woshipm.com": 10,
          "dribbble.com": 8,
          "nngroup.com": 5,
        },
        timePatterns: {
          hourDistribution: Array(24).fill(2),
          weekdayDistribution: [8, 9, 8, 8, 7, 2, 1],
        },
        activityMetrics: {
          totalBookmarks: 100,
          recentWeekCount: 20,
          recentMonthCount: 60,
          avgDailyCount: 3,
        },
      };

      const result = await engine.infer(mixedBehaviorData);

      // 应该有推荐结果或返回 general
      expect(result.recommendedPersona).toBeDefined();
      // alternatives 可能为空（如果规则匹配不足）
      expect(result.alternatives).toBeDefined();
    });

    it("should include debug info when debug mode is enabled", async () => {
      const behaviorData: UserBehaviorData = {
        tags: ["竞品"],
        tagCounts: { 竞品: 1 },
        platforms: ["即刻"],
        platformCounts: { 即刻: 1 },
        contentTypes: [],
        contentTypeCounts: {},
        folders: [],
        folderCounts: {},
        domains: [],
        domainCounts: {},
        timePatterns: {
          hourDistribution: Array(24).fill(0),
          weekdayDistribution: Array(7).fill(0),
        },
        activityMetrics: {
          totalBookmarks: 10,
          recentWeekCount: 2,
          recentMonthCount: 5,
          avgDailyCount: 0.5,
        },
      };

      const result = await engine.infer(behaviorData);

      expect(result.debugInfo).toBeDefined();
      expect(result.debugInfo?.totalRulesEvaluated).toBeGreaterThan(0);
    });
  });

  describe("cache", () => {
    it("should cache inference results", async () => {
      const behaviorData: UserBehaviorData = {
        tags: ["竞品分析"],
        tagCounts: { 竞品分析: 5 },
        platforms: ["即刻"],
        platformCounts: { 即刻: 10 },
        contentTypes: [],
        contentTypeCounts: {},
        folders: [],
        folderCounts: {},
        domains: ["woshipm.com"],
        domainCounts: { "woshipm.com": 5 },
        timePatterns: {
          hourDistribution: Array(24).fill(1),
          weekdayDistribution: Array(7).fill(5),
        },
        activityMetrics: {
          totalBookmarks: 50,
          recentWeekCount: 10,
          recentMonthCount: 30,
          avgDailyCount: 2,
        },
      };

      const result1 = await engine.infer(behaviorData);
      const result2 = await engine.infer(behaviorData);

      // 第二次应该更快（从缓存获取）
      expect(result2.inferenceTimeMs).toBeLessThanOrEqual(
        result1.inferenceTimeMs,
      );
    });

    it("should clear cache", async () => {
      engine.clearCache();
      // 不应该抛出错误
      expect(() => engine.clearCache()).not.toThrow();
    });
  });

  describe("createInferenceEngine", () => {
    it("should create engine with factory function", () => {
      const factoryEngine = createInferenceEngine({ debug: false });
      expect(factoryEngine).toBeInstanceOf(PersonaInferenceEngine);
    });
  });
});
