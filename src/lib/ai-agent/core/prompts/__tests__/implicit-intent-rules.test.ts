/**
 * 隐含意图规则模块测试
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import {
  IMPLICIT_INTENT_RULES,
  IMPLICIT_INTENT_RULES_PROMPT,
  matchImplicitIntent,
  matchAllImplicitIntents,
} from "../implicit-intent-rules";

describe("implicit-intent-rules", () => {
  describe("IMPLICIT_INTENT_RULES", () => {
    it("should have 8 rules", () => {
      expect(IMPLICIT_INTENT_RULES).toHaveLength(8);
    });

    it("should have required properties for each rule", () => {
      for (const rule of IMPLICIT_INTENT_RULES) {
        expect(rule).toHaveProperty("id");
        expect(rule).toHaveProperty("pattern");
        expect(rule).toHaveProperty("implicitGoal");
        expect(rule).toHaveProperty("defaultBehavior");
        expect(rule).toHaveProperty("priority");
        expect(rule.pattern).toBeInstanceOf(RegExp);
        expect(typeof rule.priority).toBe("number");
      }
    });

    it("should have unique IDs", () => {
      const ids = IMPLICIT_INTENT_RULES.map((r) => r.id);
      const uniqueIds = [...new Set(ids)];
      expect(ids).toHaveLength(uniqueIds.length);
    });
  });

  describe("IMPLICIT_INTENT_RULES_PROMPT", () => {
    it("should be a non-empty string", () => {
      expect(typeof IMPLICIT_INTENT_RULES_PROMPT).toBe("string");
      expect(IMPLICIT_INTENT_RULES_PROMPT.length).toBeGreaterThan(100);
    });

    it("should contain markdown table", () => {
      expect(IMPLICIT_INTENT_RULES_PROMPT).toContain("|");
      expect(IMPLICIT_INTENT_RULES_PROMPT).toContain("用户表达");
      expect(IMPLICIT_INTENT_RULES_PROMPT).toContain("隐含意图");
    });
  });

  describe("matchImplicitIntent", () => {
    it('should match "organize" intent for 整理', () => {
      const rule = matchImplicitIntent("帮我整理一下收藏");
      expect(rule).not.toBeNull();
      expect(rule?.id).toBe("organize-not-delete");
      expect(rule?.implicitGoal).toContain("有序");
    });

    it('should match "too-many" intent for 太多', () => {
      const rule = matchImplicitIntent("收藏太多了");
      expect(rule).not.toBeNull();
      expect(rule?.id).toBe("too-many-not-delete");
    });

    it('should match "cant-find" intent for 找不到', () => {
      const rule = matchImplicitIntent("找不到之前收藏的那篇文章");
      expect(rule).not.toBeNull();
      expect(rule?.id).toBe("cant-find-search");
    });

    it('should match "recent" intent for 最近', () => {
      const rule = matchImplicitIntent("最近收藏了什么");
      expect(rule).not.toBeNull();
      expect(rule?.id).toBe("recent-7days");
    });

    it('should match "look-at" intent for 看看', () => {
      const rule = matchImplicitIntent("帮我看看收藏情况");
      expect(rule).not.toBeNull();
      expect(rule?.id).toBe("look-at-overview");
    });

    it('should match "that-one" intent for 那个', () => {
      const rule = matchImplicitIntent("那个帮我删掉");
      expect(rule).not.toBeNull();
      expect(rule?.id).toBe("that-one-context");
    });

    it('should match "these" intent for 这些', () => {
      const rule = matchImplicitIntent("这些都移到工作文件夹");
      expect(rule).not.toBeNull();
      expect(rule?.id).toBe("these-selected");
    });

    it('should match "all" intent for 都', () => {
      const rule = matchImplicitIntent("都删掉");
      expect(rule).not.toBeNull();
      expect(rule?.id).toBe("all-batch-confirm");
    });

    it("should return null for non-matching message", () => {
      const rule = matchImplicitIntent("你好");
      expect(rule).toBeNull();
    });

    it("should return highest priority match when multiple rules apply", () => {
      // "那个" (priority 95) vs "整理" (priority 90)
      const rule = matchImplicitIntent("那个帮我整理下");
      expect(rule).not.toBeNull();
      expect(rule?.id).toBe("that-one-context"); // Higher priority
    });
  });

  describe("matchAllImplicitIntents", () => {
    it("should return all matching rules", () => {
      // "那个" + "整理" should match two rules
      const rules = matchAllImplicitIntents("那个帮我整理下");
      expect(rules.length).toBeGreaterThanOrEqual(2);
      expect(rules.some((r) => r.id === "that-one-context")).toBe(true);
      expect(rules.some((r) => r.id === "organize-not-delete")).toBe(true);
    });

    it("should sort by priority descending", () => {
      const rules = matchAllImplicitIntents("那个帮我整理下这些");
      for (let i = 1; i < rules.length; i++) {
        expect(rules[i - 1].priority).toBeGreaterThanOrEqual(rules[i].priority);
      }
    });

    it("should return empty array for non-matching message", () => {
      const rules = matchAllImplicitIntents("你好");
      expect(rules).toHaveLength(0);
    });
  });
});
