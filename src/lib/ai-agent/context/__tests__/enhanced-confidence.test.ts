/**
 * 增强置信度计算器测试
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import type { DynamicContext } from "../types";
import type { IntentClassificationLite } from "../enhanced-confidence";
import {
  calculateEnhancedConfidence,
  getEnhancedConfidence,
} from "../enhanced-confidence";

// 创建测试用的 DynamicContext
function createMockContext(
  overrides: Partial<DynamicContext> = {},
): DynamicContext {
  return {
    time: {
      current: "2025-12-27 14:30",
      period: "afternoon",
      isWeekend: false,
    },
    stats: {
      totalBookmarks: 100,
      recentWeekCount: 5,
      topPlatform: { name: "微信公众号", code: "wechat", count: 60 },
      topFolders: [{ id: 1, name: "工作", count: 30 }],
    },
    preferences: {
      responseStyle: "concise",
      frequentTags: ["技术", "产品"],
    },
    recentActivity: {},
    session: {},
    ...overrides,
  };
}

// 创建测试用的意图分类
function createMockIntent(
  overrides: Partial<IntentClassificationLite> = {},
): IntentClassificationLite {
  return {
    type: "query",
    confidence: 0.85,
    entities: [],
    ...overrides,
  };
}

describe("enhanced-confidence", () => {
  describe("calculateEnhancedConfidence", () => {
    it("should return EnhancedConfidenceResult with all required properties", () => {
      const intent = createMockIntent();
      const context = createMockContext();
      const result = calculateEnhancedConfidence(intent, context, "查找收藏");

      expect(result).toHaveProperty("originalConfidence");
      expect(result).toHaveProperty("enhancedConfidence");
      expect(result).toHaveProperty("factors");
      expect(result).toHaveProperty("level");
      expect(result).toHaveProperty("suggestedStrategy");
    });

    it("should have 5 factors", () => {
      const intent = createMockIntent();
      const context = createMockContext();
      const result = calculateEnhancedConfidence(intent, context, "查找收藏");

      expect(result.factors).toHaveLength(5);
      expect(result.factors.map((f) => f.name)).toEqual([
        "rule_confidence",
        "entity_completeness",
        "context_relevance",
        "history_match",
        "message_clarity",
      ]);
    });

    it("should preserve originalConfidence", () => {
      const intent = createMockIntent({ confidence: 0.75 });
      const context = createMockContext();
      const result = calculateEnhancedConfidence(intent, context, "测试");

      expect(result.originalConfidence).toBe(0.75);
    });

    it("should return high level for confidence >= 0.85", () => {
      const intent = createMockIntent({ confidence: 0.95 });
      const context = createMockContext();
      const result = calculateEnhancedConfidence(
        intent,
        context,
        "查找技术相关收藏",
      );

      // enhancedConfidence 应该接近原始置信度
      expect(result.level).toBe("high");
      expect(result.suggestedStrategy).toBe("silent");
    });

    it("should return low level for low confidence", () => {
      const intent = createMockIntent({ confidence: 0.3 });
      const context = createMockContext();
      const result = calculateEnhancedConfidence(intent, context, "嗯");

      expect(result.level).toBe("low");
      expect(result.suggestedStrategy).toBe("clarify");
    });

    describe("entity completeness factor", () => {
      it("should score 1.0 when no entities required", () => {
        const intent = createMockIntent({
          type: "query",
          confidence: 0.8,
          entities: [],
        });
        const context = createMockContext();
        const result = calculateEnhancedConfidence(intent, context, "测试");

        const entityFactor = result.factors.find(
          (f) => f.name === "entity_completeness",
        );
        expect(entityFactor?.score).toBe(1.0);
      });

      it("should score lower when required entities are missing", () => {
        const intent = createMockIntent({
          type: "organize", // requires platform, folder
          confidence: 0.8,
          entities: [],
        });
        const context = createMockContext();
        const result = calculateEnhancedConfidence(intent, context, "整理收藏");

        const entityFactor = result.factors.find(
          (f) => f.name === "entity_completeness",
        );
        expect(entityFactor?.score).toBeLessThan(1.0);
      });

      it("should score 1.0 when all required entities present", () => {
        const intent = createMockIntent({
          type: "organize",
          confidence: 0.8,
          entities: [
            { type: "platform", value: "微信", confidence: 0.9, raw: "微信" },
            { type: "folder", value: "工作", confidence: 0.9, raw: "工作" },
          ],
        });
        const context = createMockContext();
        const result = calculateEnhancedConfidence(
          intent,
          context,
          "整理微信收藏到工作文件夹",
        );

        const entityFactor = result.factors.find(
          (f) => f.name === "entity_completeness",
        );
        expect(entityFactor?.score).toBe(1.0);
      });
    });

    describe("context relevance factor", () => {
      it("should reduce score for organize intent with few bookmarks", () => {
        const intent = createMockIntent({
          type: "organize",
          confidence: 0.8,
        });
        const context = createMockContext({
          stats: {
            totalBookmarks: 5,
            recentWeekCount: 2,
            topPlatform: { name: "微信", code: "wechat", count: 3 },
            topFolders: [],
          },
        });
        const result = calculateEnhancedConfidence(intent, context, "整理收藏");

        const contextFactor = result.factors.find(
          (f) => f.name === "context_relevance",
        );
        expect(contextFactor?.score).toBe(0.5);
      });

      it("should reduce score for search without topic entity", () => {
        const intent = createMockIntent({
          type: "query",
          subType: "search",
          confidence: 0.8,
          entities: [],
        });
        const context = createMockContext();
        const result = calculateEnhancedConfidence(intent, context, "搜索");

        const contextFactor = result.factors.find(
          (f) => f.name === "context_relevance",
        );
        expect(contextFactor?.score).toBe(0.6);
      });
    });

    describe("message clarity factor", () => {
      it("should reduce score for very short messages", () => {
        const intent = createMockIntent({ confidence: 0.8 });
        const context = createMockContext();
        const result = calculateEnhancedConfidence(intent, context, "嗯");

        const clarityFactor = result.factors.find(
          (f) => f.name === "message_clarity",
        );
        expect(clarityFactor?.score).toBe(0.5);
      });

      it("should reduce score for very long messages", () => {
        const intent = createMockIntent({ confidence: 0.8 });
        const context = createMockContext();
        const longMessage = "这是一条非常长的消息".repeat(20);
        const result = calculateEnhancedConfidence(
          intent,
          context,
          longMessage,
        );

        const clarityFactor = result.factors.find(
          (f) => f.name === "message_clarity",
        );
        expect(clarityFactor?.score).toBe(0.7);
      });

      it("should reduce score for question marks with non-query intent", () => {
        const intent = createMockIntent({
          type: "action",
          confidence: 0.8,
        });
        const context = createMockContext();
        const result = calculateEnhancedConfidence(
          intent,
          context,
          "可以删除吗？",
        );

        const clarityFactor = result.factors.find(
          (f) => f.name === "message_clarity",
        );
        expect(clarityFactor?.score).toBeLessThan(0.8);
      });
    });

    describe("boundary cases", () => {
      it("should clamp enhancedConfidence between 0 and 1", () => {
        const intent = createMockIntent({ confidence: 1.0 });
        const context = createMockContext();
        const result = calculateEnhancedConfidence(
          intent,
          context,
          "正常长度的查询消息内容",
        );

        expect(result.enhancedConfidence).toBeLessThanOrEqual(1);
        expect(result.enhancedConfidence).toBeGreaterThanOrEqual(0);
      });

      it("should handle empty entities array", () => {
        const intent = createMockIntent({
          type: "query",
          confidence: 0.8,
          entities: [],
        });
        const context = createMockContext();

        expect(() => {
          calculateEnhancedConfidence(intent, context, "测试");
        }).not.toThrow();
      });
    });
  });

  describe("getEnhancedConfidence", () => {
    it("should return only the enhancedConfidence number", () => {
      const intent = createMockIntent({ confidence: 0.85 });
      const context = createMockContext();
      const result = getEnhancedConfidence(intent, context, "查找收藏");

      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it("should match calculateEnhancedConfidence result", () => {
      const intent = createMockIntent({ confidence: 0.75 });
      const context = createMockContext();
      const message = "测试消息";

      const fullResult = calculateEnhancedConfidence(intent, context, message);
      const quickResult = getEnhancedConfidence(intent, context, message);

      expect(quickResult).toBe(fullResult.enhancedConfidence);
    });
  });
});
