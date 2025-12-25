/**
 * SearchSkill 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import { SearchSkill, searchSkill } from "../search.skill";
import type { SkillContext } from "../../../core/types";

// Mock 搜索结果数据
const mockSearchResults = [
  {
    id: 1,
    title: "React 入门教程",
    url: "https://example.com/react",
    description: "React 基础教程",
    cover_url: null,
    platform: "juejin",
    ai_summary: "React 是一个用于构建用户界面的 JavaScript 库",
    ai_tags: ["React", "前端"],
    user_tags: ["学习"],
    folder_id: 1,
    folders: [{ name: "技术文章" }],
    author: "张三",
    publish_time: "2025-12-01",
    created_at: "2025-12-20T10:00:00Z",
    similarity: 0.85,
  },
  {
    id: 2,
    title: "TypeScript 高级特性",
    url: "https://example.com/typescript",
    description: "TypeScript 进阶",
    cover_url: null,
    platform: "zhihu",
    ai_summary: "TypeScript 提供了强大的类型系统",
    ai_tags: ["TypeScript", "编程"],
    user_tags: ["编程"],
    folder_id: 1,
    folders: [{ name: "技术文章" }],
    author: "李四",
    publish_time: "2025-12-05",
    created_at: "2025-12-21T10:00:00Z",
    similarity: 0.75,
  },
];

// Mock Supabase client
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => Promise.resolve({})),
}));

// Mock semantic search
jest.mock("@/lib/utils/semantic-search", () => ({
  searchBookmarksHybrid: jest.fn(() =>
    Promise.resolve({
      data: mockSearchResults,
      searchType: "hybrid",
      error: null,
    }),
  ),
}));

// Mock fulltext search
jest.mock("@/lib/utils/fulltext-search", () => ({
  searchBookmarksFulltext: jest.fn(() =>
    Promise.resolve({
      data: mockSearchResults,
      error: null,
    }),
  ),
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

describe("SearchSkill", () => {
  let skill: SearchSkill;

  beforeEach(() => {
    skill = new SearchSkill();
    jest.clearAllMocks();
  });

  describe("metadata", () => {
    it("should have correct id and name", () => {
      expect(skill.metadata.id).toBe("search");
      expect(skill.metadata.name).toBe("搜索书签");
      expect(skill.metadata.category).toBe("utility");
    });

    it("should have correct version", () => {
      expect(skill.metadata.version).toBe("1.0.0");
    });

    it("should have capabilities", () => {
      expect(skill.metadata.capabilities).toBeDefined();
      expect(skill.metadata.capabilities).toContain("keyword-search");
      expect(skill.metadata.capabilities).toContain("semantic-search");
      expect(skill.metadata.capabilities).toContain("hybrid-search");
      expect(skill.metadata.capabilities).toContain("filter-by-platform");
      expect(skill.metadata.capabilities).toContain("filter-by-folder");
      expect(skill.metadata.capabilities).toContain("filter-by-tags");
    });

    it("should not require confirmation", () => {
      expect(skill.metadata.requiresConfirmation).toBe(false);
    });

    it("should have duration estimates", () => {
      expect(skill.metadata.estimatedDurationMs).toBeDefined();
      expect(skill.metadata.maxExecutionTimeMs).toBeDefined();
      expect(skill.metadata.maxExecutionTimeMs).toBeGreaterThan(
        skill.metadata.estimatedDurationMs!,
      );
    });
  });

  describe("schemas", () => {
    it("should have valid input schema", () => {
      expect(skill.inputSchema).toBeDefined();
    });

    it("should have valid output schema", () => {
      expect(skill.outputSchema).toBeDefined();
    });

    it("should validate query input", () => {
      const validInput = { query: "React" };
      const result = skill.inputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should reject empty query", () => {
      const invalidInput = { query: "" };
      const result = skill.inputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should validate search mode options", () => {
      const keywordMode = { query: "test", mode: "keyword" };
      const semanticMode = { query: "test", mode: "semantic" };
      const hybridMode = { query: "test", mode: "hybrid" };
      const invalidMode = { query: "test", mode: "invalid" };

      expect(skill.inputSchema.safeParse(keywordMode).success).toBe(true);
      expect(skill.inputSchema.safeParse(semanticMode).success).toBe(true);
      expect(skill.inputSchema.safeParse(hybridMode).success).toBe(true);
      expect(skill.inputSchema.safeParse(invalidMode).success).toBe(false);
    });

    it("should validate limit range", () => {
      const validLimit = { query: "test", limit: 20 };
      const tooLow = { query: "test", limit: 0 };
      const tooHigh = { query: "test", limit: 100 };

      expect(skill.inputSchema.safeParse(validLimit).success).toBe(true);
      expect(skill.inputSchema.safeParse(tooLow).success).toBe(false);
      expect(skill.inputSchema.safeParse(tooHigh).success).toBe(false);
    });

    it("should validate threshold range", () => {
      const validThreshold = { query: "test", threshold: 0.5 };
      const tooLow = { query: "test", threshold: -0.1 };
      const tooHigh = { query: "test", threshold: 1.5 };

      expect(skill.inputSchema.safeParse(validThreshold).success).toBe(true);
      expect(skill.inputSchema.safeParse(tooLow).success).toBe(false);
      expect(skill.inputSchema.safeParse(tooHigh).success).toBe(false);
    });
  });

  describe("execute", () => {
    const mockContext: SkillContext = {
      userId: "test-user-id",
      traceId: "test-trace-id",
    };

    it("should execute hybrid search by default", async () => {
      const input = { query: "React" };
      const result = await skill.execute(input, mockContext);

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.query).toBe("React");
      expect(result.data.results).toBeDefined();
      expect(result.data.results.length).toBeGreaterThan(0);
    });

    it("should return formatted search results", async () => {
      const input = { query: "React" };
      const result = await skill.execute(input, mockContext);

      expect(result.success).toBe(true);
      if (!result.success) return;
      // 验证结果格式
      const firstResult = result.data.results[0];
      expect(firstResult?.id).toBeDefined();
      expect(firstResult?.title).toBeDefined();
      expect(firstResult?.url).toBeDefined();
      expect(firstResult?.platform).toBeDefined();
    });

    it("should include totalCount and hasMore", async () => {
      const input = { query: "React", limit: 10 };
      const result = await skill.execute(input, mockContext);

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.totalCount).toBeDefined();
      expect(result.data.hasMore).toBeDefined();
    });

    it("should include searchMode in result", async () => {
      const input = { query: "React", mode: "hybrid" as const };
      const result = await skill.execute(input, mockContext);

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.searchMode).toBeDefined();
    });

    it("should include execution metrics", async () => {
      const input = { query: "React" };
      const result = await skill.execute(input, mockContext);

      expect(result.metrics).toBeDefined();
      expect(result.metrics?.executionTimeMs).toBeDefined();
    });
  });

  describe("singleton instance", () => {
    it("should export a singleton instance", () => {
      expect(searchSkill).toBeInstanceOf(SearchSkill);
      expect(searchSkill.metadata.id).toBe("search");
    });
  });
});
