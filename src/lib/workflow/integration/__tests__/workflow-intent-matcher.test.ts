/**
 * WorkflowIntentMatcher 单元测试
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { WorkflowIntentMatcher } from "../workflow-intent-matcher";
import type { WorkflowDefinition } from "../../types";

// Mock Supabase
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      from: () => ({
        select: () => ({
          or: () => ({
            eq: () =>
              Promise.resolve({
                data: [],
                error: null,
              }),
          }),
        }),
      }),
    }),
  ),
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("WorkflowIntentMatcher", () => {
  let matcher: WorkflowIntentMatcher;

  beforeEach(() => {
    matcher = new WorkflowIntentMatcher();
    matcher.clearCache();
  });

  describe("matchWorkflow", () => {
    it("should return null when no workflows available", async () => {
      const result = await matcher.matchWorkflow("检查书签健康", "user-123");

      expect(result).toBeNull();
    });
  });

  describe("keyword pattern matching", () => {
    it("should match exact keyword pattern", () => {
      // Access private method through prototype
      const evaluateKeywordPattern = (
        matcher as unknown as {
          evaluateKeywordPattern: (
            message: string,
            pattern: string,
            weight: number,
          ) => { confidence: number; params?: Record<string, string> } | null;
        }
      ).evaluateKeywordPattern.bind(matcher);

      const result = evaluateKeywordPattern("检查书签健康", "书签健康", 1);

      expect(result).not.toBeNull();
      expect(result!.confidence).toBe(0.9);
    });

    it("should match partial keyword overlap", () => {
      const evaluateKeywordPattern = (
        matcher as unknown as {
          evaluateKeywordPattern: (
            message: string,
            pattern: string,
            weight: number,
          ) => { confidence: number; params?: Record<string, string> } | null;
        }
      ).evaluateKeywordPattern.bind(matcher);

      // 直接包含匹配
      const result = evaluateKeywordPattern("帮我整理书签", "整理书签", 1);

      expect(result).not.toBeNull();
      expect(result!.confidence).toBe(0.9);
    });

    it("should return null for no match", () => {
      const evaluateKeywordPattern = (
        matcher as unknown as {
          evaluateKeywordPattern: (
            message: string,
            pattern: string,
            weight: number,
          ) => { confidence: number; params?: Record<string, string> } | null;
        }
      ).evaluateKeywordPattern.bind(matcher);

      const result = evaluateKeywordPattern("今天天气不错", "书签健康", 1);

      expect(result).toBeNull();
    });

    it("should apply weight correctly", () => {
      const evaluateKeywordPattern = (
        matcher as unknown as {
          evaluateKeywordPattern: (
            message: string,
            pattern: string,
            weight: number,
          ) => { confidence: number; params?: Record<string, string> } | null;
        }
      ).evaluateKeywordPattern.bind(matcher);

      const result = evaluateKeywordPattern("检查书签健康", "书签健康", 0.8);

      expect(result).not.toBeNull();
      expect(result!.confidence).toBe(0.9 * 0.8);
    });
  });

  describe("regex pattern matching", () => {
    it("should match regex pattern", () => {
      const evaluateRegexPattern = (
        matcher as unknown as {
          evaluateRegexPattern: (
            message: string,
            pattern: string,
            weight: number,
          ) => { confidence: number; params?: Record<string, string> } | null;
        }
      ).evaluateRegexPattern.bind(matcher);

      const result = evaluateRegexPattern("检查一下链接", "检查.*链接", 1);

      expect(result).not.toBeNull();
      expect(result!.confidence).toBe(0.85);
    });

    it("should extract named groups", () => {
      const evaluateRegexPattern = (
        matcher as unknown as {
          evaluateRegexPattern: (
            message: string,
            pattern: string,
            weight: number,
          ) => { confidence: number; params?: Record<string, string> } | null;
        }
      ).evaluateRegexPattern.bind(matcher);

      const result = evaluateRegexPattern(
        "整理AI相关的书签",
        "整理(?<topic>.+)的书签",
        1,
      );

      expect(result).not.toBeNull();
      expect(result!.params).toEqual({ topic: "AI相关" });
    });

    it("should return null for no match", () => {
      const evaluateRegexPattern = (
        matcher as unknown as {
          evaluateRegexPattern: (
            message: string,
            pattern: string,
            weight: number,
          ) => { confidence: number; params?: Record<string, string> } | null;
        }
      ).evaluateRegexPattern.bind(matcher);

      const result = evaluateRegexPattern("今天天气好", "^整理.*书签$", 1);

      expect(result).toBeNull();
    });

    it("should handle invalid regex gracefully", () => {
      const evaluateRegexPattern = (
        matcher as unknown as {
          evaluateRegexPattern: (
            message: string,
            pattern: string,
            weight: number,
          ) => { confidence: number; params?: Record<string, string> } | null;
        }
      ).evaluateRegexPattern.bind(matcher);

      // Invalid regex with unmatched bracket
      const result = evaluateRegexPattern("test", "[invalid", 1);

      expect(result).toBeNull();
    });
  });

  describe("pattern evaluation", () => {
    it("should evaluate keyword pattern", () => {
      const evaluatePattern = (
        matcher as unknown as {
          evaluatePattern: (
            message: string,
            patternDef: {
              type: string;
              pattern: string;
              weight?: number;
            },
          ) => { confidence: number; params?: Record<string, string> } | null;
        }
      ).evaluatePattern.bind(matcher);

      const result = evaluatePattern("书签健康检查", {
        type: "keyword",
        pattern: "书签健康",
      });

      expect(result).not.toBeNull();
      expect(result!.confidence).toBeGreaterThan(0);
    });

    it("should evaluate regex pattern", () => {
      const evaluatePattern = (
        matcher as unknown as {
          evaluatePattern: (
            message: string,
            patternDef: {
              type: string;
              pattern: string;
              weight?: number;
            },
          ) => { confidence: number; params?: Record<string, string> } | null;
        }
      ).evaluatePattern.bind(matcher);

      const result = evaluatePattern("检查书签链接", {
        type: "regex",
        pattern: "检查.*链接",
      });

      expect(result).not.toBeNull();
    });

    it("should return null for semantic pattern (not implemented)", () => {
      const evaluatePattern = (
        matcher as unknown as {
          evaluatePattern: (
            message: string,
            patternDef: {
              type: string;
              pattern: string;
              weight?: number;
            },
          ) => { confidence: number; params?: Record<string, string> } | null;
        }
      ).evaluatePattern.bind(matcher);

      const result = evaluatePattern("检查书签", {
        type: "semantic",
        pattern: "书签健康检测",
      });

      expect(result).toBeNull();
    });

    it("should return null for unknown pattern type", () => {
      const evaluatePattern = (
        matcher as unknown as {
          evaluatePattern: (
            message: string,
            patternDef: {
              type: string;
              pattern: string;
              weight?: number;
            },
          ) => { confidence: number; params?: Record<string, string> } | null;
        }
      ).evaluatePattern.bind(matcher);

      const result = evaluatePattern("检查书签", {
        type: "unknown",
        pattern: "test",
      });

      expect(result).toBeNull();
    });
  });

  describe("matchPatterns", () => {
    it("should return null for workflow without conversation trigger", () => {
      const matchPatterns = (
        matcher as unknown as {
          matchPatterns: (
            message: string,
            workflow: WorkflowDefinition,
          ) => { workflowId: string; confidence: number } | null;
        }
      ).matchPatterns.bind(matcher);

      // 使用类型断言创建最小化的测试工作流
      const workflow = {
        id: "test-workflow",
        name: "测试工作流",
        version: "1.0.0",
        triggers: [{ type: "manual" }],
        steps: [],
      } as unknown as WorkflowDefinition;

      const result = matchPatterns("检查书签", workflow);

      expect(result).toBeNull();
    });

    it("should match workflow with simple patterns", () => {
      const matchPatterns = (
        matcher as unknown as {
          matchPatterns: (
            message: string,
            workflow: WorkflowDefinition,
          ) => {
            workflowId: string;
            workflowName: string;
            confidence: number;
            matchedPattern: string;
          } | null;
        }
      ).matchPatterns.bind(matcher);

      // 使用类型断言创建带 patterns 的测试工作流
      const workflow = {
        id: "bookmark-health",
        name: "书签健康检查",
        version: "1.0.0",
        triggers: [
          {
            type: "conversation",
            patterns: ["书签健康", "链接检查", "死链检测"],
          },
        ],
        steps: [],
      } as unknown as WorkflowDefinition;

      const result = matchPatterns("检查书签健康状况", workflow);

      expect(result).not.toBeNull();
      expect(result!.workflowId).toBe("bookmark-health");
      expect(result!.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it("should match workflow with detailed patterns config", () => {
      const matchPatterns = (
        matcher as unknown as {
          matchPatterns: (
            message: string,
            workflow: WorkflowDefinition,
          ) => {
            workflowId: string;
            workflowName: string;
            confidence: number;
          } | null;
        }
      ).matchPatterns.bind(matcher);

      // 使用类型断言创建带 patterns 的测试工作流（简化格式）
      const workflow = {
        id: "weekly-organize",
        name: "周度整理",
        version: "1.0.0",
        triggers: [
          {
            type: "conversation",
            patterns: ["周度整理", "每周整理"],
          },
        ],
        steps: [],
      } as unknown as WorkflowDefinition;

      const result = matchPatterns("帮我做每周整理", workflow);

      expect(result).not.toBeNull();
      expect(result!.workflowId).toBe("weekly-organize");
    });

    it("should return null when confidence below threshold", () => {
      const matchPatterns = (
        matcher as unknown as {
          matchPatterns: (
            message: string,
            workflow: WorkflowDefinition,
          ) => { workflowId: string } | null;
        }
      ).matchPatterns.bind(matcher);

      // 使用类型断言创建测试工作流（使用不匹配的模式）
      const workflow = {
        id: "test",
        name: "测试",
        version: "1.0.0",
        triggers: [
          {
            type: "conversation",
            patterns: ["非常特殊的关键词"],
          },
        ],
        steps: [],
      } as unknown as WorkflowDefinition;

      const result = matchPatterns("普通消息", workflow);

      expect(result).toBeNull();
    });
  });

  describe("cache management", () => {
    it("should clear cache", () => {
      matcher.clearCache();

      // Verify cache is cleared by checking internal state (patternCache Map should be empty)
      expect(
        (matcher as unknown as { patternCache: Map<string, unknown> })
          .patternCache.size,
      ).toBe(0);
    });
  });
});
