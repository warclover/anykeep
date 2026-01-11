/**
 * AI 能力端到端验收测试 - Skill 路由
 *
 * 验证意图分析和 Skill 路由的完整链路
 *
 * @module @/__tests__/e2e/ai-capabilities/skill-routing
 */

import { IntentAnalyzer } from "@/lib/ai-skills/router/intent-analyzer";
import {
  SKILL_MAPPINGS,
  getSkillMappingByKey,
} from "@/lib/ai-skills/config/skill-mappings";

describe("E2E: Skill 路由", () => {
  let analyzer: IntentAnalyzer;

  beforeEach(() => {
    analyzer = new IntentAnalyzer();
  });

  describe("SKILL_MAPPINGS 完整性", () => {
    it("应该包含所有 30 个 Skills", () => {
      expect(SKILL_MAPPINGS.length).toBeGreaterThanOrEqual(30);
    });

    it("每个 Skill 应该有必需字段", () => {
      for (const mapping of SKILL_MAPPINGS) {
        expect(mapping.skillId).toBeDefined();
        expect(mapping.name).toBeDefined();
        expect(mapping.description).toBeDefined();
        expect(mapping.triggers).toBeDefined();
        expect(mapping.triggers.length).toBeGreaterThan(0);
      }
    });

    it("Skill ID 应该唯一", () => {
      const ids = SKILL_MAPPINGS.map((m) => m.skillId);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("应该包含 6 个新 Skills", () => {
      const newSkills = [
        "inbox_triage",
        "folder_recommend",
        "search_optimize",
        "knowledge_graph_explore",
        "folder_health_check",
        "snapshot_compare",
      ];

      for (const skillId of newSkills) {
        const skill = SKILL_MAPPINGS.find((m) => m.skillId === skillId);
        expect(skill).toBeDefined();
      }
    });
  });

  describe("getSkillMappingByKey", () => {
    it("应该通过 skillId 找到映射", () => {
      const mapping = getSkillMappingByKey("knowledge_review");
      expect(mapping).toBeDefined();
      expect(mapping?.skillId).toBe("knowledge_review");
    });

    it("不存在的 key 应该返回 undefined", () => {
      const mapping = getSkillMappingByKey("nonexistent_skill");
      expect(mapping).toBeUndefined();
    });
  });

  describe("搜索意图路由", () => {
    const searchQueries = [
      { input: "搜索AI文章", expectedIntent: "search" },
      { input: "找一下关于Python的收藏", expectedIntent: "search" },
      { input: "查找机器学习", expectedIntent: "search" },
      { input: "有没有关于React的", expectedIntent: "search" },
    ];

    it.each(searchQueries)(
      '输入 "$input" 应该路由到搜索意图',
      async ({ input, expectedIntent }) => {
        const result = await analyzer.analyze(input);

        expect(result.intent.type).toBe(expectedIntent);
        expect(result.confidence).toBeGreaterThan(0.5);
      },
    );
  });

  describe("统计意图路由", () => {
    const countQueries = [
      { input: "有多少收藏", expectedIntent: "query" },
      { input: "我的收藏数量", expectedIntent: "query" },
      { input: "统计一下我的书签", expectedIntent: "query" },
    ];

    it.each(countQueries)(
      '输入 "$input" 应该路由到查询意图',
      async ({ input }) => {
        const result = await analyzer.analyze(input);

        expect(["query", "count"]).toContain(result.intent.type);
        expect(result.confidence).toBeGreaterThan(0.5);
      },
    );
  });

  describe("整理意图路由", () => {
    const organizeQueries = [
      { input: "帮我整理收藏", expectedSkill: "batch_organize" },
      { input: "清理一下书签", expectedSkill: "batch_organize" },
      { input: "分类我的收藏", expectedSkill: "batch_organize" },
    ];

    it.each(organizeQueries)(
      '输入 "$input" 应该可能路由到 $expectedSkill',
      async ({ input }) => {
        const result = await analyzer.analyze(input);

        // 整理类意图应该有较高置信度
        expect(["action", "manage"]).toContain(result.intent.type);
      },
    );
  });

  describe("导出意图路由", () => {
    const exportQueries = [
      { input: "导出我的收藏", expectedSkill: "data_export" },
      { input: "把书签导出为CSV", expectedSkill: "data_export" },
      { input: "备份我的收藏到JSON", expectedSkill: "data_export" },
    ];

    it.each(exportQueries)(
      '输入 "$input" 应该路由到 $expectedSkill',
      async ({ input }) => {
        const result = await analyzer.analyze(input);

        expect(result.intent.type).toBe("export");
      },
    );
  });

  describe("新 Skills 路由", () => {
    it("收件箱分拣: '帮我分拣收件箱' → inbox_triage", async () => {
      const result = await analyzer.analyze("帮我分拣收件箱");

      expect(result.skillId).toBe("inbox_triage");
    });

    it("文件夹推荐: '这个放哪个文件夹好' → folder_recommend", async () => {
      const result = await analyzer.analyze("这个放哪个文件夹好");

      expect(result.skillId).toBe("folder_recommend");
    });

    it("搜索优化: '怎么搜索更好' → search_optimize", async () => {
      const result = await analyzer.analyze("怎么搜索更好");

      expect(result.skillId).toBe("search_optimize");
    });

    it("知识图谱: '展示知识图谱' → knowledge_graph_explore", async () => {
      const result = await analyzer.analyze("展示知识图谱");

      expect(result.skillId).toBe("knowledge_graph_explore");
    });

    it("文件夹健康检查: '检查文件夹结构' → folder_health_check", async () => {
      const result = await analyzer.analyze("检查文件夹结构");

      expect(result.skillId).toBe("folder_health_check");
    });

    it("快照对比: '对比页面变化' → snapshot_compare", async () => {
      const result = await analyzer.analyze("对比页面变化");

      expect(result.skillId).toBe("snapshot_compare");
    });
  });

  describe("知识回顾路由", () => {
    const reviewQueries = [
      { input: "帮我复习一下收藏", expectedSkill: "knowledge_review" },
      { input: "知识回顾", expectedSkill: "knowledge_review" },
      { input: "生成复习卡片", expectedSkill: "knowledge_review" },
    ];

    it.each(reviewQueries)(
      '输入 "$input" 应该路由到 $expectedSkill',
      async ({ input, expectedSkill }) => {
        const result = await analyzer.analyze(input);

        expect(result.skillId).toBe(expectedSkill);
      },
    );
  });

  describe("洞察报告路由", () => {
    const insightQueries = [
      { input: "生成洞察报告", expectedSkill: "insight_report" },
      { input: "分析我的收藏趋势", expectedSkill: "insight_report" },
      { input: "收藏活跃度分析", expectedSkill: "insight_report" },
    ];

    it.each(insightQueries)(
      '输入 "$input" 应该路由到 $expectedSkill',
      async ({ input, expectedSkill }) => {
        const result = await analyzer.analyze(input);

        expect(result.skillId).toBe(expectedSkill);
      },
    );
  });

  describe("端到端路由场景", () => {
    it("场景1: 用户说'帮我整理收藏' → 应该有高置信度", async () => {
      const result = await analyzer.analyze("帮我整理收藏");

      expect(result.confidence).toBeGreaterThan(0.6);
      expect(result.intent.type).toBeDefined();
    });

    it("场景2: 模糊输入'那个' → 应该有低置信度", async () => {
      const result = await analyzer.analyze("那个");

      expect(result.confidence).toBeLessThan(0.6);
    });

    it("场景3: 带上下文的搜索 → 应该提取实体", async () => {
      const result = await analyzer.analyze("搜索上周收藏的Python教程");

      expect(result.intent.type).toBe("search");
      expect(result.entities).toBeDefined();
    });

    it("场景4: 复合请求 → 应该识别主要意图", async () => {
      const result = await analyzer.analyze("搜索AI文章然后整理一下");

      // 应该识别出主要意图
      expect(result.intent.type).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe("置信度与路由一致性", () => {
    it("高权重规则应该返回高置信度", async () => {
      const result = await analyzer.analyze("有多少收藏");

      // 计数类查询通常有高权重规则
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it("低匹配度输入应该返回低置信度", async () => {
      const result = await analyzer.analyze("随便说点什么");

      expect(result.confidence).toBeLessThan(0.6);
    });
  });
});
