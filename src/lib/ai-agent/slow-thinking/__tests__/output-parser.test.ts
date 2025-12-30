/**
 * 输出解析器测试
 *
 * @module ai-agent/slow-thinking/__tests__
 */

import {
  extractTag,
  parseReasoningSteps,
  parseStrategy,
  parseMonologue,
  validateMonologue,
  createDefaultMonologue,
} from "../output-parser";
import type { InternalMonologue } from "../types";

describe("output-parser", () => {
  describe("extractTag", () => {
    it("should extract tag content", () => {
      const text = "<thinking>some thought</thinking>";
      expect(extractTag(text, "thinking")).toBe("some thought");
    });

    it("should handle multiline content", () => {
      const text = `<thinking>
        line 1
        line 2
      </thinking>`;
      const result = extractTag(text, "thinking");
      expect(result).toContain("line 1");
      expect(result).toContain("line 2");
    });

    it("should return undefined for missing tag", () => {
      const text = "<other>content</other>";
      expect(extractTag(text, "thinking")).toBeUndefined();
    });

    it("should be case insensitive", () => {
      const text = "<THINKING>content</THINKING>";
      expect(extractTag(text, "thinking")).toBe("content");
    });

    it("should handle nested content", () => {
      const text = "<thinking><nested>inner</nested></thinking>";
      expect(extractTag(text, "thinking")).toBe("<nested>inner</nested>");
    });
  });

  describe("parseReasoningSteps", () => {
    it("should parse numbered steps", () => {
      const thinking = `
        1. First thought
        2. Second thought
        3. Third thought
      `;
      const steps = parseReasoningSteps(thinking);
      expect(steps).toHaveLength(3);
      expect(steps[0]).toEqual({ step: 1, thought: "First thought" });
      expect(steps[1]).toEqual({ step: 2, thought: "Second thought" });
      expect(steps[2]).toEqual({ step: 3, thought: "Third thought" });
    });

    it("should handle Chinese punctuation", () => {
      const thinking = `
        1、第一点
        2、第二点
      `;
      const steps = parseReasoningSteps(thinking);
      expect(steps).toHaveLength(2);
      expect(steps[0].thought).toBe("第一点");
    });

    it("should handle parentheses format", () => {
      const thinking = `
        1) First point
        2) Second point
      `;
      const steps = parseReasoningSteps(thinking);
      expect(steps).toHaveLength(2);
    });

    it("should return empty array for no numbered items", () => {
      const thinking = "Just some text without numbers";
      const steps = parseReasoningSteps(thinking);
      expect(steps).toHaveLength(0);
    });

    it("should handle mixed formats", () => {
      const thinking = `
        - bullet point (ignored)
        1. numbered point
        * another bullet (ignored)
        2. another numbered
      `;
      const steps = parseReasoningSteps(thinking);
      expect(steps).toHaveLength(2);
    });
  });

  describe("parseStrategy", () => {
    it("should parse complete strategy", () => {
      const strategyStr = `
        type: customized
        description: Use semantic search first
        pre_processing: expand query, check cache
        post_processing: format results, add citations
      `;
      const strategy = parseStrategy(strategyStr);
      expect(strategy.type).toBe("customized");
      expect(strategy.description).toBe("Use semantic search first");
      expect(strategy.preProcessing).toEqual(["expand query", "check cache"]);
      expect(strategy.postProcessing).toEqual([
        "format results",
        "add citations",
      ]);
    });

    it("should default to 'default' type for invalid type", () => {
      const strategyStr = "type: invalid_type";
      const strategy = parseStrategy(strategyStr);
      expect(strategy.type).toBe("default");
    });

    it("should handle missing fields", () => {
      const strategyStr = "type: multi_step";
      const strategy = parseStrategy(strategyStr);
      expect(strategy.type).toBe("multi_step");
      expect(strategy.description).toBe("");
      expect(strategy.preProcessing).toBeUndefined();
      expect(strategy.postProcessing).toBeUndefined();
    });

    it("should handle empty string", () => {
      const strategy = parseStrategy("");
      expect(strategy.type).toBe("default");
      expect(strategy.description).toBe("");
    });
  });

  describe("parseMonologue", () => {
    const validLLMOutput = `
      <thinking>
      1. User wants to search
      2. Need to understand context
      3. Default strategy is appropriate
      </thinking>

      <inferred_intent>用户想搜索关于 AI 的收藏</inferred_intent>

      <inferred_goal>找到相关学习资料</inferred_goal>

      <strategy>
      type: default
      description: Use standard search flow
      </strategy>

      <suggest_route_change>false</suggest_route_change>

      <confidence>85</confidence>

      <conclusion>直接执行搜索即可</conclusion>
    `;

    it("should parse valid LLM output", () => {
      const monologue = parseMonologue(validLLMOutput, "搜索 AI 相关内容");

      expect(monologue.originalInput).toBe("搜索 AI 相关内容");
      expect(monologue.inferredIntent).toBe("用户想搜索关于 AI 的收藏");
      expect(monologue.inferredGoal).toBe("找到相关学习资料");
      expect(monologue.suggestedStrategy.type).toBe("default");
      expect(monologue.suggestRouteChange).toBe(false);
      expect(monologue.confidence).toBe(85);
      expect(monologue.conclusion).toBe("直接执行搜索即可");
      expect(monologue.reasoningSteps).toHaveLength(3);
    });

    it("should handle suggest_route_change: true", () => {
      const output = `
        <inferred_intent>test</inferred_intent>
        <suggest_route_change>true</suggest_route_change>
        <confidence>80</confidence>
        <strategy>type: default</strategy>
      `;
      const monologue = parseMonologue(output, "test");
      expect(monologue.suggestRouteChange).toBe(true);
    });

    it("should handle Chinese boolean", () => {
      const output = `
        <inferred_intent>test</inferred_intent>
        <suggest_route_change>是</suggest_route_change>
        <confidence>80</confidence>
        <strategy>type: default</strategy>
      `;
      const monologue = parseMonologue(output, "test");
      expect(monologue.suggestRouteChange).toBe(true);
    });

    it("should default confidence to 70 for invalid values", () => {
      const output = `
        <inferred_intent>test</inferred_intent>
        <confidence>invalid</confidence>
        <strategy>type: default</strategy>
      `;
      const monologue = parseMonologue(output, "test");
      expect(monologue.confidence).toBe(70);
    });

    it("should use original input as inferred_intent if missing", () => {
      const output = `
        <confidence>80</confidence>
        <strategy>type: default</strategy>
      `;
      const monologue = parseMonologue(output, "original message");
      expect(monologue.inferredIntent).toBe("original message");
    });

    it("should handle missing optional fields", () => {
      const output = `
        <inferred_intent>test intent</inferred_intent>
        <confidence>80</confidence>
        <strategy>type: default</strategy>
      `;
      const monologue = parseMonologue(output, "test");
      expect(monologue.inferredGoal).toBeUndefined();
      expect(monologue.conclusion).toBeUndefined();
    });
  });

  describe("validateMonologue", () => {
    const validMonologue: InternalMonologue = {
      originalInput: "test input",
      thinking: "some thinking",
      reasoningSteps: [],
      inferredIntent: "test intent",
      suggestedStrategy: { type: "default", description: "" },
      suggestRouteChange: false,
      thinkingDurationMs: 100,
      confidence: 80,
    };

    it("should return true for valid monologue", () => {
      expect(validateMonologue(validMonologue)).toBe(true);
    });

    it("should return false for empty originalInput", () => {
      expect(validateMonologue({ ...validMonologue, originalInput: "" })).toBe(
        false,
      );
    });

    it("should return false for empty inferredIntent", () => {
      expect(validateMonologue({ ...validMonologue, inferredIntent: "" })).toBe(
        false,
      );
    });

    it("should return false for too short inferredIntent", () => {
      expect(
        validateMonologue({ ...validMonologue, inferredIntent: "a" }),
      ).toBe(false);
    });

    it("should return false for negative confidence", () => {
      expect(validateMonologue({ ...validMonologue, confidence: -1 })).toBe(
        false,
      );
    });

    it("should return false for confidence > 100", () => {
      expect(validateMonologue({ ...validMonologue, confidence: 101 })).toBe(
        false,
      );
    });

    it("should return false for invalid strategy type", () => {
      expect(
        validateMonologue({
          ...validMonologue,
          suggestedStrategy: {
            type: "invalid" as "default",
            description: "",
          },
        }),
      ).toBe(false);
    });
  });

  describe("createDefaultMonologue", () => {
    it("should create default monologue with original input", () => {
      const monologue = createDefaultMonologue("my question");
      expect(monologue.originalInput).toBe("my question");
      expect(monologue.inferredIntent).toBe("my question");
      expect(monologue.suggestedStrategy.type).toBe("default");
      expect(monologue.suggestRouteChange).toBe(false);
      expect(monologue.confidence).toBe(50);
    });

    it("should have empty reasoning steps", () => {
      const monologue = createDefaultMonologue("test");
      expect(monologue.reasoningSteps).toHaveLength(0);
    });
  });
});
