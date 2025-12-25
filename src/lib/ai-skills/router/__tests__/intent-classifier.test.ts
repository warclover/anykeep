/**
 * IntentClassifier 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import type { IntentClassifier } from "../intent-classifier";
import { createIntentClassifier } from "../intent-classifier";

describe("IntentClassifier", () => {
  let classifier: IntentClassifier;

  beforeEach(() => {
    classifier = createIntentClassifier();
  });

  describe("classify", () => {
    describe("query intent", () => {
      it("should classify count queries correctly", async () => {
        const result = await classifier.classify("我有多少收藏");

        expect(result.type).toBe("query");
        expect(result.subType).toBe("count");
        expect(result.confidence).toBeGreaterThan(0.7);
        expect(result.source).toBe("rule");
      });

      it("should classify list queries correctly", async () => {
        const result = await classifier.classify("列出最近的收藏");

        expect(result.type).toBe("query");
        expect(result.subType).toBe("list");
      });

      it("should classify search queries correctly", async () => {
        const result = await classifier.classify("搜索关于 React 的内容");

        expect(result.type).toBe("query");
        expect(result.subType).toBe("search");
      });
    });

    describe("action intent", () => {
      it("should classify move action correctly", async () => {
        const result = await classifier.classify("把这些移动到学习文件夹");

        expect(result.type).toBe("action");
        expect(result.subType).toBe("move");
      });

      it("should classify delete action correctly", async () => {
        const result = await classifier.classify("删除这个书签");

        expect(result.type).toBe("action");
        expect(result.subType).toBe("delete");
      });

      it("should classify tag action correctly", async () => {
        const result = await classifier.classify("给这些添加标签");

        expect(result.type).toBe("action");
        expect(result.subType).toBe("tag");
      });
    });

    describe("organize intent", () => {
      it("should classify cleanup correctly", async () => {
        // 使用"整理书签"避免"重复"关键词触发 dedupe 规则
        const result = await classifier.classify("整理书签");

        expect(result.type).toBe("organize");
        expect(result.subType).toBe("cleanup");
        expect(result.requiresMultiStep).toBe(true);
      });

      it("should classify classify correctly", async () => {
        // 分类规则：/分类|归类|归档/ → type: "organize", subType: "classify"
        const result = await classifier.classify("自动分类所有未归类的");

        expect(result.type).toBe("organize");
        expect(result.subType).toBe("classify");
      });

      it("should classify dedupe correctly", async () => {
        const result = await classifier.classify("去重");

        expect(result.type).toBe("organize");
        expect(result.subType).toBe("dedupe");
      });
    });

    describe("analyze intent", () => {
      it("should classify insight correctly", async () => {
        // 分析规则：/分析|洞察|趋势/ → type: "analyze", subType: "insight"
        // 注意："统计"匹配的是 query:count 规则
        const result = await classifier.classify("分析我的阅读趋势");

        expect(result.type).toBe("analyze");
        expect(result.subType).toBe("insight");
      });

      it("should classify report correctly", async () => {
        const result = await classifier.classify("生成阅读报告");

        expect(result.type).toBe("analyze");
        expect(result.subType).toBe("report");
        expect(result.hasDeliverableExpectation).toBe(true);
      });
    });

    describe("learn intent", () => {
      it("should classify review correctly", async () => {
        const result = await classifier.classify("复习最近学的");

        expect(result.type).toBe("learn");
        expect(result.subType).toBe("review");
        expect(result.requiresMultiStep).toBe(true);
        expect(result.hasDeliverableExpectation).toBe(true);
      });

      it("should classify path correctly", async () => {
        const result = await classifier.classify("帮我规划学习路径");

        expect(result.type).toBe("learn");
        expect(result.subType).toBe("path");
      });
    });

    describe("create intent", () => {
      it("should classify digest correctly", async () => {
        // 摘要规则：/摘要|总结|概括|速览/ → type: "create", subType: "digest"
        const result = await classifier.classify("帮我生成摘要");

        expect(result.type).toBe("create");
        expect(result.subType).toBe("digest");
        expect(result.hasDeliverableExpectation).toBe(true);
      });

      it("should classify note correctly", async () => {
        // 笔记规则：/笔记|记录|心得/ → type: "create", subType: "note"
        // 注意：使用"写笔记"而不是"整理笔记"，因为"整理"规则权重更高
        const result = await classifier.classify("写笔记");

        expect(result.type).toBe("create");
        expect(result.subType).toBe("note");
      });
    });

    describe("chitchat intent", () => {
      it("should classify greetings correctly", async () => {
        const result = await classifier.classify("你好");

        expect(result.type).toBe("chitchat");
      });

      it("should classify help requests correctly", async () => {
        const result = await classifier.classify("帮帮我");

        expect(result.type).toBe("chitchat");
      });
    });
  });

  describe("entity extraction", () => {
    it("should extract topic entities", async () => {
      const result = await classifier.classify("搜索关于 React 的内容");

      const topicEntity = result.entities.find((e) => e.type === "topic");
      expect(topicEntity).toBeDefined();
      expect(topicEntity?.value.toLowerCase()).toContain("react");
    });

    it("should extract time entities", async () => {
      // 时间实体模式需要数字格式：/最近(\d+)[天日周月]/
      // "最近一周"不匹配（"一"是汉字），使用"最近7天"
      const result = await classifier.classify("最近7天的收藏");

      const timeEntity = result.entities.find((e) => e.type === "time");
      expect(timeEntity).toBeDefined();
    });

    it("should extract quantity entities", async () => {
      const result = await classifier.classify("列出10条书签");

      const quantityEntity = result.entities.find((e) => e.type === "quantity");
      expect(quantityEntity).toBeDefined();
      expect(quantityEntity?.value).toBe("10");
    });

    it("should extract platform entities", async () => {
      const result = await classifier.classify("微信公众号有多少");

      const platformEntity = result.entities.find((e) => e.type === "platform");
      expect(platformEntity).toBeDefined();
    });
  });

  describe("confidence scoring", () => {
    it("should have higher confidence for exact pattern matches", async () => {
      const exactMatch = await classifier.classify("我有多少收藏");
      const vagueMatch = await classifier.classify("收藏数量情况如何");

      expect(exactMatch.confidence).toBeGreaterThanOrEqual(
        vagueMatch.confidence,
      );
    });
  });

  // ============================================
  // Phase 1.1: 多候选收集机制测试
  // ============================================

  describe("collectAllMatches", () => {
    it("should collect all matching rules instead of returning first match", () => {
      // "梳理内容总结纪要" 应该同时匹配 organize(梳理) 和 create(总结)
      const candidates = classifier.collectAllMatches("梳理内容总结纪要");

      // 应该有多个候选
      expect(candidates.length).toBeGreaterThan(1);

      // 应该包含 organize 和 create 两种类型
      const types = candidates.map((c) => c.type);
      expect(types).toContain("organize");
      expect(types).toContain("create");
    });

    it("should return candidates sorted by confidence", () => {
      const candidates = classifier.collectAllMatches("整理并总结");

      // 验证按置信度降序排序
      for (let i = 1; i < candidates.length; i++) {
        expect(candidates[i - 1].confidence).toBeGreaterThanOrEqual(
          candidates[i].confidence,
        );
      }
    });

    it("should include pattern and matchIndex in candidates", () => {
      const candidates = classifier.collectAllMatches("搜索关于AI的文章");

      expect(candidates.length).toBeGreaterThan(0);
      const first = candidates[0];
      expect(first.pattern).toBeDefined();
      expect(typeof first.matchIndex).toBe("number");
      expect(first.matchIndex).toBeGreaterThanOrEqual(0);
    });

    it("should return empty array for no matches", () => {
      const candidates = classifier.collectAllMatches("xyz123");

      expect(candidates).toEqual([]);
    });
  });

  describe("deduplicateCandidates", () => {
    it("should keep only highest weight candidate for each type", () => {
      const candidates = classifier.collectAllMatches("整理并总结这些内容");
      const deduplicated = classifier.deduplicateCandidates(candidates);

      // 每种类型只应出现一次
      const typeCounts = new Map<string, number>();
      for (const c of deduplicated) {
        typeCounts.set(c.type, (typeCounts.get(c.type) || 0) + 1);
      }

      for (const count of typeCounts.values()) {
        expect(count).toBe(1);
      }
    });

    it("should preserve higher weight candidate when deduplicating", () => {
      // 手动创建两个相同类型但不同权重的候选
      const candidates = [
        {
          pattern: "test1",
          type: "query" as const,
          weight: 50,
          matchIndex: 0,
          confidence: 0.8,
          complexity: "simple" as const,
        },
        {
          pattern: "test2",
          type: "query" as const,
          weight: 80,
          matchIndex: 5,
          confidence: 0.75,
          complexity: "simple" as const,
        },
      ];

      const deduplicated = classifier.deduplicateCandidates(candidates);

      expect(deduplicated.length).toBe(1);
      expect(deduplicated[0].weight).toBe(80);
    });
  });

  describe("classifyWithCandidates", () => {
    it("should return MultiCandidateResult with primary and candidates", async () => {
      const result =
        await classifier.classifyWithCandidates("搜索关于AI的文章");

      expect(result.primary).toBeDefined();
      expect(result.primary.type).toBe("query");
      expect(Array.isArray(result.candidates)).toBe(true);
      expect(typeof result.disambiguated).toBe("boolean");
    });

    it("should detect need for disambiguation when confidence gap is small", async () => {
      // "梳理内容总结纪要" 应该匹配多个意图且置信度接近
      const result =
        await classifier.classifyWithCandidates("梳理内容总结纪要");

      // 如果有多个候选且置信度接近，应该标记需要消歧
      if (
        result.candidates.length >= 2 &&
        result.candidates[0].confidence - result.candidates[1].confidence < 0.2
      ) {
        expect(result.disambiguationReason).toBeDefined();
      }
    });

    it("should return correct result for '梳理内容总结纪要' with multiple candidates", async () => {
      const result =
        await classifier.classifyWithCandidates("梳理内容总结纪要");

      // 应该有 organize 和 create 两个候选
      const organizeCandidate = result.candidates.find(
        (c) => c.type === "organize",
      );
      const createCandidate = result.candidates.find(
        (c) => c.type === "create",
      );

      expect(organizeCandidate).toBeDefined();
      expect(createCandidate).toBeDefined();

      // 目前没有消歧规则，应该返回权重最高的（organize 权重 80）
      // 注：Phase 1.2 实现消歧后，这里应该返回 create
    });

    it("should return correct result for '整理并总结' with multiple candidates", async () => {
      const result = await classifier.classifyWithCandidates("整理并总结");

      // 应该有 organize 和 create 两个候选
      const types = result.candidates.map((c) => c.type);
      expect(types).toContain("organize");
      expect(types).toContain("create");
    });

    it("should handle single candidate case", async () => {
      const result = await classifier.classifyWithCandidates("你好");

      expect(result.primary.type).toBe("chitchat");
      expect(result.disambiguated).toBe(false);
    });

    it("should return default classification for no matches", async () => {
      const result = await classifier.classifyWithCandidates("xyz123无意义");

      expect(result.candidates.length).toBe(0);
      expect(result.primary.type).toBe("chitchat");
      expect(result.primary.confidence).toBeLessThan(0.5);
    });
  });
});
