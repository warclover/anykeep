/**
 * SearchOptimizeSkill 单元测试
 *
 * @version 1.0.0
 * @since 2025-01-08
 */

import {
  SearchOptimizeSkill,
  searchOptimizeSkill,
} from "../search-optimize.skill";
import type { SkillContext } from "../../../core/types";

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

describe("SearchOptimizeSkill", () => {
  let skill: SearchOptimizeSkill;

  beforeEach(() => {
    skill = new SearchOptimizeSkill();
    jest.clearAllMocks();
  });

  describe("metadata", () => {
    it("should have correct id", () => {
      expect(skill.metadata.id).toBe("search_optimize");
    });

    it("should have correct name", () => {
      expect(skill.metadata.name).toBe("搜索优化助手");
    });

    it("should have correct category", () => {
      expect(skill.metadata.category).toBe("utility");
    });

    it("should have correct version", () => {
      expect(skill.metadata.version).toBe("1.0.0");
    });

    it("should have capabilities", () => {
      expect(skill.metadata.capabilities).toContain("analyze");
      expect(skill.metadata.capabilities).toContain("suggest");
    });
  });

  describe("inputSchema", () => {
    it("should validate correct input with originalQuery", () => {
      const input = { originalQuery: "react hooks" };
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should validate correct input with feedback", () => {
      const input = { originalQuery: "test", feedback: "太多结果" };
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should accept empty input", () => {
      const input = {};
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should accept undefined fields", () => {
      const input = { originalQuery: undefined, feedback: undefined };
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe("outputSchema", () => {
    it("should validate correct output", () => {
      const output = {
        analysis: {
          originalQuery: "react",
          issues: [{ type: "too_broad", suggestion: "添加更多关键词" }],
        },
        suggestions: [
          {
            optimizedQuery: "react hooks 入门",
            explanation: "添加具体概念",
            expectedImprovement: "更精准的结果",
          },
        ],
        tips: ["使用引号进行精确匹配"],
      };
      const result = skill.outputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });

    it("should accept null analysis", () => {
      const output = {
        analysis: null,
        suggestions: [],
        tips: [],
      };
      const result = skill.outputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });
  });

  describe("execute", () => {
    const mockContext: SkillContext = {
      userId: "test-user-id",
      traceId: "test-trace-id",
    };

    it("should execute successfully with query", async () => {
      const input = { originalQuery: "react hooks" };
      const result = await skill.execute(input, mockContext);

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.suggestions).toBeDefined();
      expect(result.data.tips).toBeDefined();
      expect(Array.isArray(result.data.suggestions)).toBe(true);
      expect(Array.isArray(result.data.tips)).toBe(true);
    });

    it("should provide suggestions without query", async () => {
      const input = {};
      const result = await skill.execute(input, mockContext);

      expect(result.success).toBe(true);
      if (!result.success) return;

      // 无查询时应返回通用搜索技巧
      expect(result.data.tips.length).toBeGreaterThan(0);
    });

    it("should handle feedback input", async () => {
      const input = { originalQuery: "react", feedback: "结果太多" };
      const result = await skill.execute(input, mockContext);

      expect(result.success).toBe(true);
      if (!result.success) return;

      // 应该基于反馈提供优化建议
      expect(result.data.suggestions.length).toBeGreaterThan(0);
    });

    it("should analyze query issues", async () => {
      const input = { originalQuery: "a" }; // 太短的查询
      const result = await skill.execute(input, mockContext);

      expect(result.success).toBe(true);
      if (!result.success) return;

      // 应该识别出查询太短的问题
      if (result.data.analysis) {
        expect(result.data.analysis.issues.length).toBeGreaterThan(0);
      }
    });
  });

  describe("singleton instance", () => {
    it("should export a singleton instance", () => {
      expect(searchOptimizeSkill).toBeInstanceOf(SearchOptimizeSkill);
      expect(searchOptimizeSkill.metadata.id).toBe("search_optimize");
    });
  });
});
