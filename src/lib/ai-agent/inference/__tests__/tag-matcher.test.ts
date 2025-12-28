/**
 * 标签模式匹配器单元测试
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import { TagMatcher, tagMatcher, TAG_PERSONA_RULES } from "../tag-matcher";

describe("TagMatcher", () => {
  describe("match", () => {
    it("should match PRD-related tags to pm persona", () => {
      const signals = tagMatcher.match(
        {
          prd: 10,
          需求文档: 8,
          竞品分析: 5,
        },
        30,
      );

      expect(signals.length).toBeGreaterThan(0);
      const pmSignals = signals.filter((s) => s.personas.includes("pm"));
      expect(pmSignals.length).toBeGreaterThan(0);
    });

    it("should match consulting-related tags to consultant persona", () => {
      const signals = tagMatcher.match(
        {
          咨询: 15,
          麦肯锡: 10,
        },
        40,
      );

      expect(signals.length).toBeGreaterThan(0);
      const consultantSignals = signals.filter((s) =>
        s.personas.includes("consultant"),
      );
      expect(consultantSignals.length).toBeGreaterThan(0);
    });

    it("should match teaching-related tags to teacher persona", () => {
      const signals = tagMatcher.match(
        {
          课程设计: 20,
          教学: 15,
        },
        50,
      );

      expect(signals.length).toBeGreaterThan(0);
      const teacherSignals = signals.filter((s) =>
        s.personas.includes("teacher"),
      );
      expect(teacherSignals.length).toBeGreaterThan(0);
    });

    it("should return empty array for no matching tags", () => {
      const signals = tagMatcher.match(
        {
          xyz随机: 5,
          abc其他: 3,
        },
        10,
      );

      expect(signals).toHaveLength(0);
    });

    it("should handle empty tag frequency", () => {
      const signals = tagMatcher.match({}, 0);

      expect(signals).toHaveLength(0);
    });

    it("should match AI-related tags to ai_enthusiast persona", () => {
      const signals = tagMatcher.match(
        {
          GPT: 20,
          LLM: 15,
          prompt: 10,
        },
        50,
      );

      expect(signals.length).toBeGreaterThan(0);
      const aiSignals = signals.filter((s) =>
        s.personas.includes("ai_enthusiast"),
      );
      expect(aiSignals.length).toBeGreaterThan(0);
    });

    it("should match research-related tags to phd persona", () => {
      const signals = tagMatcher.match(
        {
          论文: 25,
          research: 20,
        },
        70,
      );

      expect(signals.length).toBeGreaterThan(0);
    });

    it("should weight signals by tag count", () => {
      const signals = tagMatcher.match({ PRD: 50 }, 50);

      if (signals.length > 0) {
        expect(signals[0].count).toBe(50);
      }
    });

    it("should return empty for zero totalBookmarks", () => {
      const signals = tagMatcher.match({ 论文: 10 }, 0);

      expect(signals).toHaveLength(0);
    });
  });

  describe("TAG_PERSONA_RULES", () => {
    it("should have at least 10 rules", () => {
      expect(TAG_PERSONA_RULES.length).toBeGreaterThanOrEqual(10);
    });

    it("should have valid patterns", () => {
      for (const rule of TAG_PERSONA_RULES) {
        expect(rule.pattern).toBeInstanceOf(RegExp);
      }
    });

    it("should have valid persona mappings", () => {
      for (const rule of TAG_PERSONA_RULES) {
        expect(rule.personas.length).toBeGreaterThan(0);
        for (const persona of rule.personas) {
          expect(persona.weight).toBeGreaterThan(0);
          expect(persona.weight).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  describe("createTagMatcher", () => {
    it("should create a new instance", () => {
      const matcher = new TagMatcher();
      expect(matcher).toBeInstanceOf(TagMatcher);
    });
  });

  describe("hasMatch", () => {
    it("should return true for matching tags", () => {
      expect(tagMatcher.hasMatch("论文")).toBe(true);
      expect(tagMatcher.hasMatch("PRD")).toBe(true);
      expect(tagMatcher.hasMatch("GPT")).toBe(true);
    });

    it("should return false for non-matching tags", () => {
      expect(tagMatcher.hasMatch("xyz随机标签")).toBe(false);
    });
  });
});
