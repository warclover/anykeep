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
});
