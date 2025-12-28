/**
 * 画像推断系统集成测试
 *
 * 测试完整的推断流程：
 * - 行为数据 → 条件匹配 → 规则评估 → 画像推荐
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import {
  PersonaInferenceEngine,
  matchPersonaIntentRules,
  getBestPersonaIntentRule,
  getPersonaSimilarity,
  getPersonaPriority,
  ALL_INFERENCE_RULES,
  PHASE1_INFERENCE_RULES,
  PHASE2_INFERENCE_RULES,
} from "../index";
import type { UserBehaviorData } from "../types";
import { PERSONA_CONFIGS } from "../../configs";

describe("Persona Inference System Integration", () => {
  describe("Rule Coverage", () => {
    it("should have rules for all Phase 1 personas", () => {
      const phase1Personas = ["pm", "consultant", "teacher"];

      for (const persona of phase1Personas) {
        const rules = PHASE1_INFERENCE_RULES.filter(
          (r) => r.targetPersona === persona,
        );
        expect(rules.length).toBeGreaterThan(0);
      }
    });

    it("should have rules for all Phase 2 personas", () => {
      const phase2Personas = ["analyst", "cert_seeker", "ux_researcher"];

      for (const persona of phase2Personas) {
        const rules = PHASE2_INFERENCE_RULES.filter(
          (r) => r.targetPersona === persona,
        );
        expect(rules.length).toBeGreaterThan(0);
      }
    });

    it("should have at least 15 total inference rules", () => {
      expect(ALL_INFERENCE_RULES.length).toBeGreaterThanOrEqual(15);
    });
  });

  describe("Intent Rules Integration", () => {
    it("should match PM intent rules for product-related messages", () => {
      const message = "帮我找一下竞品分析相关的收藏";
      const rules = matchPersonaIntentRules(message, "pm");

      expect(rules.length).toBeGreaterThan(0);
      expect(rules[0].intentSubtype).toBe("competitive_analysis");
    });

    it("should match analyst intent rules for research messages", () => {
      const message = "整理一下最近的研报";
      const rules = matchPersonaIntentRules(message, "analyst");

      expect(rules.length).toBeGreaterThan(0);
    });

    it("should match cert_seeker intent rules for exam messages", () => {
      const message = "帮我整理CPA考试的错题";
      const rules = matchPersonaIntentRules(message, "cert_seeker");

      expect(rules.length).toBeGreaterThan(0);
    });

    it("should match ux_researcher intent rules for design messages", () => {
      const message = "找一下设计模式的案例";
      const rules = matchPersonaIntentRules(message, "ux_researcher");

      expect(rules.length).toBeGreaterThan(0);
    });

    it("should return best matching rule", () => {
      const message = "帮我做竞品分析";
      const bestRule = getBestPersonaIntentRule(message, "pm");

      expect(bestRule).not.toBeNull();
      expect(bestRule?.intentType).toBe("analyze");
    });
  });

  describe("Persona Similarity Matrix", () => {
    it("should return 1.0 for same persona", () => {
      expect(getPersonaSimilarity("pm", "pm")).toBe(1.0);
      expect(getPersonaSimilarity("analyst", "analyst")).toBe(1.0);
    });

    it("should return similarity for related personas", () => {
      // PM 和 UX 研究员有较高相似度
      expect(getPersonaSimilarity("pm", "ux_researcher")).toBeGreaterThan(0.5);

      // 咨询顾问和分析师有相似度
      expect(getPersonaSimilarity("consultant", "analyst")).toBeGreaterThan(
        0.3,
      );
    });

    it("should return 0 for unrelated personas", () => {
      // 备考者和博主没有定义相似度
      expect(getPersonaSimilarity("cert_seeker", "tech_blogger")).toBe(0);
    });
  });

  describe("Persona Priority", () => {
    it("should assign higher priority to professional personas", () => {
      expect(getPersonaPriority("pm")).toBeGreaterThan(
        getPersonaPriority("general"),
      );
      expect(getPersonaPriority("analyst")).toBeGreaterThan(
        getPersonaPriority("general"),
      );
    });

    it("should assign priority to all personas", () => {
      const personas = [
        "pm",
        "consultant",
        "teacher",
        "analyst",
        "cert_seeker",
        "ux_researcher",
      ];

      for (const persona of personas) {
        expect(getPersonaPriority(persona as never)).toBeGreaterThan(0);
      }
    });
  });

  describe("Config Integration", () => {
    it("should have configs for all Phase 2 personas", () => {
      expect(PERSONA_CONFIGS.pm).toBeDefined();
      expect(PERSONA_CONFIGS.consultant).toBeDefined();
      expect(PERSONA_CONFIGS.teacher).toBeDefined();
      expect(PERSONA_CONFIGS.analyst).toBeDefined();
      expect(PERSONA_CONFIGS.cert_seeker).toBeDefined();
      expect(PERSONA_CONFIGS.ux_researcher).toBeDefined();
    });

    it("should have correct groups for personas", () => {
      expect(PERSONA_CONFIGS.pm!.group).toBe("design");
      expect(PERSONA_CONFIGS.analyst!.group).toBe("professional");
      expect(PERSONA_CONFIGS.cert_seeker!.group).toBe("growth");
      expect(PERSONA_CONFIGS.ux_researcher!.group).toBe("design");
    });

    it("should have behavior signals defined", () => {
      const configs = [
        PERSONA_CONFIGS.pm!,
        PERSONA_CONFIGS.consultant!,
        PERSONA_CONFIGS.teacher!,
        PERSONA_CONFIGS.analyst!,
        PERSONA_CONFIGS.cert_seeker!,
        PERSONA_CONFIGS.ux_researcher!,
      ];

      for (const config of configs) {
        expect(config.behaviorSignals).toBeDefined();
        expect(config.behaviorSignals.tagPatterns.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Full Inference Flow", () => {
    it("should correctly infer PM from typical PM behavior", async () => {
      const engine = new PersonaInferenceEngine({ debug: true });

      const pmBehavior: UserBehaviorData = {
        tags: [
          "竞品分析",
          "PRD",
          "需求文档",
          "用户反馈",
          "产品规划",
          "功能对比",
        ],
        tagCounts: {
          竞品分析: 15,
          PRD: 12,
          需求文档: 10,
          用户反馈: 8,
          产品规划: 5,
          功能对比: 3,
        },
        platforms: ["即刻", "人人都是产品经理", "ProductHunt", "36氪"],
        platformCounts: {
          即刻: 20,
          人人都是产品经理: 18,
          ProductHunt: 10,
          "36氪": 8,
        },
        contentTypes: ["文章", "PRD", "竞品报告", "分析"],
        contentTypeCounts: { 文章: 30, PRD: 15, 竞品报告: 10, 分析: 8 },
        folders: ["竞品", "需求", "产品", "调研"],
        folderCounts: { 竞品: 20, 需求: 15, 产品: 10, 调研: 8 },
        domains: ["woshipm.com", "36kr.com", "producthunt.com", "jike.info"],
        domainCounts: {
          "woshipm.com": 25,
          "36kr.com": 15,
          "producthunt.com": 10,
          "jike.info": 8,
        },
        timePatterns: {
          hourDistribution: Array(24)
            .fill(2)
            .map((v, i) => (i >= 9 && i <= 18 ? 5 : v)),
          weekdayDistribution: [10, 12, 11, 10, 9, 3, 2],
        },
        activityMetrics: {
          totalBookmarks: 200,
          recentWeekCount: 30,
          recentMonthCount: 100,
          avgDailyCount: 4,
        },
      };

      const result = await engine.infer(pmBehavior);

      expect(result.recommendedPersona).toBe("pm");
      expect(result.confidence).toBeGreaterThan(0.4);
      expect(result.matchedRules.length).toBeGreaterThan(0);
    });

    it("should correctly infer consultant from typical consultant behavior", async () => {
      const engine = new PersonaInferenceEngine({ debug: true });

      const consultantBehavior: UserBehaviorData = {
        tags: ["案例分析", "方法论", "行业研究", "最佳实践", "咨询"],
        tagCounts: {
          案例分析: 15,
          方法论: 12,
          行业研究: 10,
          最佳实践: 8,
          咨询: 5,
        },
        platforms: ["麦肯锡", "BCG", "HBR"],
        platformCounts: { 麦肯锡: 15, BCG: 12, HBR: 10 },
        contentTypes: ["研报", "白皮书", "案例分析", "行业报告"],
        contentTypeCounts: { 研报: 20, 白皮书: 15, 案例分析: 12, 行业报告: 10 },
        folders: ["案例", "方法论", "行业", "客户"],
        folderCounts: { 案例: 18, 方法论: 15, 行业: 12, 客户: 8 },
        domains: ["mckinsey.com", "bcg.com", "hbr.org"],
        domainCounts: { "mckinsey.com": 20, "bcg.com": 15, "hbr.org": 12 },
        timePatterns: {
          hourDistribution: Array(24).fill(2),
          weekdayDistribution: [10, 12, 11, 10, 9, 2, 1],
        },
        activityMetrics: {
          totalBookmarks: 180,
          recentWeekCount: 25,
          recentMonthCount: 80,
          avgDailyCount: 3.5,
        },
      };

      const result = await engine.infer(consultantBehavior);

      expect(result.recommendedPersona).toBe("consultant");
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    it("should handle mixed persona signals gracefully", async () => {
      const engine = new PersonaInferenceEngine({ debug: true });

      // 混合了 PM 和 UX 研究员的行为特征
      const mixedBehavior: UserBehaviorData = {
        tags: ["竞品分析", "用研洞察", "设计模式", "PRD", "交互设计"],
        tagCounts: {
          竞品分析: 10,
          用研洞察: 8,
          设计模式: 7,
          PRD: 6,
          交互设计: 5,
        },
        platforms: ["即刻", "Dribbble", "人人都是产品经理"],
        platformCounts: { 即刻: 12, Dribbble: 10, 人人都是产品经理: 8 },
        contentTypes: ["文章", "设计规范", "用研报告", "PRD"],
        contentTypeCounts: { 文章: 20, 设计规范: 12, 用研报告: 8, PRD: 6 },
        folders: ["竞品", "设计", "用研"],
        folderCounts: { 竞品: 12, 设计: 10, 用研: 8 },
        domains: ["woshipm.com", "dribbble.com", "nngroup.com"],
        domainCounts: {
          "woshipm.com": 15,
          "dribbble.com": 12,
          "nngroup.com": 8,
        },
        timePatterns: {
          hourDistribution: Array(24).fill(2),
          weekdayDistribution: [8, 10, 9, 8, 7, 3, 2],
        },
        activityMetrics: {
          totalBookmarks: 120,
          recentWeekCount: 18,
          recentMonthCount: 60,
          avgDailyCount: 2.5,
        },
      };

      const result = await engine.infer(mixedBehavior);

      // 应该有推荐结果
      expect(result.recommendedPersona).toBeDefined();
      // 置信度可能为 0（如果规则匹配不足返回 general）
      expect(result.confidence).toBeGreaterThanOrEqual(0);

      // alternatives 可能为空
      expect(result.alternatives).toBeDefined();
    });

    it("should return general for insufficient data", async () => {
      const engine = new PersonaInferenceEngine();

      const minimalBehavior: UserBehaviorData = {
        tags: ["随便"],
        tagCounts: { 随便: 1 },
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
          totalBookmarks: 1,
          recentWeekCount: 0,
          recentMonthCount: 1,
          avgDailyCount: 0.1,
        },
      };

      const result = await engine.infer(minimalBehavior);

      expect(result.recommendedPersona).toBe("general");
      expect(result.confidence).toBe(0);
    });
  });

  describe("Performance", () => {
    it("should complete inference within 100ms", async () => {
      const engine = new PersonaInferenceEngine();

      const behaviorData: UserBehaviorData = {
        tags: ["竞品分析", "PRD", "用户反馈"],
        tagCounts: { 竞品分析: 5, PRD: 3, 用户反馈: 2 },
        platforms: ["即刻", "人人都是产品经理"],
        platformCounts: { 即刻: 10, 人人都是产品经理: 8 },
        contentTypes: ["文章"],
        contentTypeCounts: { 文章: 15 },
        folders: ["竞品"],
        folderCounts: { 竞品: 10 },
        domains: ["woshipm.com"],
        domainCounts: { "woshipm.com": 10 },
        timePatterns: {
          hourDistribution: Array(24).fill(2),
          weekdayDistribution: Array(7).fill(5),
        },
        activityMetrics: {
          totalBookmarks: 50,
          recentWeekCount: 10,
          recentMonthCount: 30,
          avgDailyCount: 2,
        },
      };

      const result = await engine.infer(behaviorData);

      expect(result.inferenceTimeMs).toBeLessThan(100);
    });
  });
});
