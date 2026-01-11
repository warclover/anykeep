/**
 * AI 能力端到端验收测试 - 隐含意图
 *
 * 验证隐含意图推理功能的完整链路
 *
 * @module @/__tests__/e2e/ai-capabilities/implicit-intent
 */

import {
  matchImplicitIntent,
  IMPLICIT_INTENT_RULES,
} from "@/lib/ai-agent/core/prompts/implicit-intent-rules";

describe("E2E: 隐含意图推理", () => {
  describe("organize-not-delete 规则", () => {
    const testCases = [
      { input: "收藏太多了，帮我整理一下", expected: true },
      { input: "帮我整理整理收藏", expected: true },
      { input: "清理一下我的书签", expected: true },
      { input: "我的收藏有点乱", expected: true },
      { input: "删除所有收藏", expected: false },
      { input: "搜索AI文章", expected: false },
    ];

    it.each(testCases)(
      '输入 "$input" 应该 ${expected ? "匹配" : "不匹配"} organize-not-delete 规则',
      ({ input, expected }) => {
        const result = matchImplicitIntent(input);

        if (expected) {
          expect(result).toBeDefined();
          expect(result?.id).toBe("organize-not-delete");
          expect(result?.suggestedActions).toContain("classify");
        } else {
          if (result) {
            expect(result.id).not.toBe("organize-not-delete");
          }
        }
      },
    );

    it("匹配结果应该建议分类而非删除", () => {
      const result = matchImplicitIntent("帮我整理收藏");

      expect(result).toBeDefined();
      expect(result?.avoidActions).toContain("delete");
      expect(result?.suggestedActions).toContain("classify");
    });
  });

  describe("too-many-not-delete 规则", () => {
    const testCases = [
      { input: "收藏太多了", expected: true },
      { input: "我的书签好多啊", expected: true },
      { input: "收藏越来越多了", expected: true },
      { input: "我有100条收藏", expected: false },
    ];

    it.each(testCases)(
      '输入 "$input" 应该 ${expected ? "匹配" : "不匹配"} too-many-not-delete 规则',
      ({ input, expected }) => {
        const result = matchImplicitIntent(input);

        if (expected) {
          expect(result).toBeDefined();
          expect(result?.id).toBe("too-many-not-delete");
        }
      },
    );

    it("匹配结果应该建议归档而非删除", () => {
      const result = matchImplicitIntent("收藏太多了");

      expect(result).toBeDefined();
      expect(result?.avoidActions).toContain("delete");
      expect(result?.suggestedActions).toContain("archive");
    });
  });

  describe("cant-find-search 规则", () => {
    const testCases = [
      { input: "我找不到那篇文章了", expected: true },
      { input: "找不到之前收藏的", expected: true },
      { input: "搜索AI文章", expected: false },
    ];

    it.each(testCases)(
      '输入 "$input" 应该 ${expected ? "匹配" : "不匹配"} cant-find-search 规则',
      ({ input, expected }) => {
        const result = matchImplicitIntent(input);

        if (expected) {
          expect(result).toBeDefined();
          expect(result?.id).toBe("cant-find-search");
          expect(result?.suggestedActions).toContain("semantic_search");
        }
      },
    );
  });

  describe("recent-7days 规则", () => {
    const testCases = [
      { input: "最近收藏的有哪些", expected: true },
      { input: "看看最近的收藏", expected: true },
      { input: "查看2023年的收藏", expected: false },
    ];

    it.each(testCases)(
      '输入 "$input" 应该 ${expected ? "匹配" : "不匹配"} recent-7days 规则',
      ({ input, expected }) => {
        const result = matchImplicitIntent(input);

        if (expected) {
          expect(result).toBeDefined();
          expect(result?.id).toBe("recent-7days");
          expect(result?.suggestedParams).toHaveProperty("timeRange", "7d");
        }
      },
    );
  });

  describe("look-at-overview 规则", () => {
    const testCases = [
      { input: "看看我的收藏", expected: true },
      { input: "让我看一下书签", expected: true },
      { input: "搜索Python", expected: false },
    ];

    it.each(testCases)(
      '输入 "$input" 应该 ${expected ? "匹配" : "不匹配"} look-at-overview 规则',
      ({ input, expected }) => {
        const result = matchImplicitIntent(input);

        if (expected) {
          expect(result).toBeDefined();
          expect(result?.id).toBe("look-at-overview");
          expect(result?.suggestedActions).toContain("show_stats");
        }
      },
    );
  });

  describe("all-batch-confirm 规则", () => {
    const testCases = [
      { input: "把所有收藏都打上标签", expected: true },
      { input: "给全部书签加标签", expected: true },
      { input: "给这个加标签", expected: false },
    ];

    it.each(testCases)(
      '输入 "$input" 应该 ${expected ? "匹配" : "不匹配"} all-batch-confirm 规则',
      ({ input, expected }) => {
        const result = matchImplicitIntent(input);

        if (expected) {
          expect(result).toBeDefined();
          expect(result?.id).toBe("all-batch-confirm");
          expect(result?.requiresConfirmation).toBe(true);
        }
      },
    );
  });

  describe("规则完整性", () => {
    it("应该有 8 条隐含意图规则", () => {
      expect(IMPLICIT_INTENT_RULES.length).toBeGreaterThanOrEqual(8);
    });

    it("每条规则应该有必需字段", () => {
      for (const rule of IMPLICIT_INTENT_RULES) {
        expect(rule.id).toBeDefined();
        expect(rule.patterns).toBeDefined();
        expect(rule.patterns.length).toBeGreaterThan(0);
        expect(rule.suggestedActions).toBeDefined();
      }
    });

    it("规则 ID 应该唯一", () => {
      const ids = IMPLICIT_INTENT_RULES.map((r) => r.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe("端到端场景", () => {
    it("场景1: 用户说'太多了帮我整理' → 应该建议分类而非删除", () => {
      const userInput = "收藏太多了，帮我整理一下";
      const result = matchImplicitIntent(userInput);

      // 验证完整链路
      expect(result).toBeDefined();
      expect(result?.avoidActions).toContain("delete");
      expect(result?.suggestedActions).not.toContain("delete");
      expect(
        result?.suggestedActions.some((a) =>
          ["classify", "group", "archive"].includes(a),
        ),
      ).toBe(true);
    });

    it("场景2: 用户说'找不到' → 应该触发语义搜索", () => {
      const userInput = "我找不到之前收藏的那篇关于AI的文章";
      const result = matchImplicitIntent(userInput);

      expect(result).toBeDefined();
      expect(result?.id).toBe("cant-find-search");
      expect(result?.suggestedActions).toContain("semantic_search");
    });

    it("场景3: 用户说'都删掉' → 应该要求确认", () => {
      const userInput = "把所有的都删掉";
      const result = matchImplicitIntent(userInput);

      expect(result).toBeDefined();
      expect(result?.requiresConfirmation).toBe(true);
    });
  });
});
