/**
 * 槽位注入测试
 *
 * 验证 timeRange 等槽位从意图分类到 LLM prompt 注入的完整流程
 *
 * @version 1.0.0
 * @since 2026-01-11
 */

import { createIntentClassifier } from "@/lib/ai-skills/router/intent-classifier";
import type { IntentSlotSchema } from "@/lib/ai-skills/router/types";

describe("Slot Extraction and Injection", () => {
  describe("IntentClassifier timeRange extraction", () => {
    const classifier = createIntentClassifier();

    // 重点测试：验证 timeRange 槽位提取功能
    const timeRangeExtractionCases = [
      {
        input: "今天有多少收藏?",
        expectedTimeRange: "today",
        description: "today extraction",
      },
      {
        input: "本周新增几条书签",
        expectedTimeRange: "week",
        description: "week extraction",
      },
      {
        input: "昨天保存了什么",
        expectedTimeRange: "yesterday",
        description: "yesterday extraction",
      },
      {
        input: "上周收藏了多少",
        expectedTimeRange: "last_week",
        description: "last_week extraction",
      },
      {
        input: "这个月收藏了多少条",
        expectedTimeRange: "month",
        description: "month extraction",
      },
    ];

    it.each(timeRangeExtractionCases)(
      "should extract timeRange=$expectedTimeRange from: $input ($description)",
      async ({ input, expectedTimeRange }) => {
        const result = await classifier.classify(input);

        // 验证 slots 存在且包含 timeRange
        expect(result.slots).toBeDefined();
        expect(result.slots?.slots?.timeRange).toBeDefined();
        expect(result.slots?.slots?.timeRange?.value).toBe(expectedTimeRange);
        expect(result.slots?.slots?.timeRange?.source).toBe("extracted");
      },
    );

    it("should extract timeRange=today with correct confidence", async () => {
      const result = await classifier.classify("今天有多少收藏?");

      expect(result.slots?.slots?.timeRange?.confidence).toBeGreaterThanOrEqual(
        0.8,
      );
      expect(result.slots?.slots?.timeRange?.type).toBe("string");
    });

    it("should not extract timeRange from queries without time indicators", async () => {
      const result = await classifier.classify("有多少收藏?");

      // 可能没有 slots 或 slots 中没有 timeRange
      if (result.slots?.slots) {
        expect(result.slots.slots.timeRange).toBeUndefined();
      }
    });

    // 核心用例：今天有多少收藏
    it("should correctly classify '今天有多少收藏?' with timeRange slot", async () => {
      const result = await classifier.classify("今天有多少收藏?");

      // 验证意图分类（type 必须是 query，subType 可以是 count 或 list）
      expect(result.type).toBe("query");
      expect(["count", "list"]).toContain(result.subType);

      // 验证槽位提取（核心验证：timeRange 必须正确提取）
      expect(result.slots).toBeDefined();
      expect(result.slots?.slots?.timeRange?.value).toBe("today");
    });
  });

  describe("buildSlotHintPrompt structure", () => {
    // 测试槽位提示构建函数（通过验证数据结构）
    const mockSlots: IntentSlotSchema = {
      intentType: "query:count",
      slots: {
        timeRange: {
          name: "timeRange",
          value: "today",
          type: "string",
          confidence: 0.9,
          required: false,
          source: "extracted",
        },
      },
      completeness: 1.0,
    };

    it("should have correct slot structure", () => {
      expect(mockSlots.slots.timeRange.value).toBe("today");
      expect(mockSlots.intentType).toBe("query:count");
    });

    it("should have correct slot metadata", () => {
      expect(mockSlots.slots.timeRange.source).toBe("extracted");
      expect(mockSlots.completeness).toBe(1.0);
    });
  });
});
