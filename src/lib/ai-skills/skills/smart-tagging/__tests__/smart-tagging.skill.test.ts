/**
 * SmartTaggingSkill 单元测试
 */

import { TagAnalyzer, type BookmarkData } from "../tag-analyzer";
import { SmartTaggingSkill } from "../smart-tagging.skill";
import type { OrchestrationContext } from "../../../orchestration/types";

// Mock Supabase
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            is: jest.fn(() => ({
              limit: jest.fn(() => ({
                in: jest.fn(() =>
                  Promise.resolve({
                    data: [
                      {
                        id: 1,
                        title: "React Hooks 完全指南",
                        url: "https://example.com/react-hooks",
                        ai_summary: "React Hooks 是 React 16.8 引入的新特性",
                        ai_tags: ["React", "Hooks"],
                        platform: "juejin",
                        bookmark_tags: [],
                      },
                    ],
                    error: null,
                  }),
                ),
              })),
            })),
            single: jest.fn(() =>
              Promise.resolve({
                data: null,
                error: null,
              }),
            ),
          })),
        })),
      })),
    }),
  ),
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("TagAnalyzer", () => {
  let analyzer: TagAnalyzer;

  beforeEach(() => {
    analyzer = new TagAnalyzer();
  });

  describe("generateSuggestions", () => {
    it("should generate suggestions from AI tags", () => {
      const bookmark: BookmarkData = {
        id: 1,
        title: "React Hooks 教程",
        url: "https://example.com/1",
        ai_tags: ["React", "Hooks", "前端"],
        platform: "juejin",
      };

      const result = analyzer.generateSuggestions(
        bookmark,
        new Set(),
        5,
        false,
      );

      expect(result.bookmarkId).toBe(1);
      expect(result.suggestedTags.length).toBeGreaterThan(0);
      expect(result.suggestedTags.some((t) => t.tag === "React")).toBe(true);
    });

    it("should generate suggestions from platform", () => {
      const bookmark: BookmarkData = {
        id: 1,
        title: "文章",
        url: "https://example.com/1",
        platform: "zhihu",
      };

      const result = analyzer.generateSuggestions(
        bookmark,
        new Set(),
        5,
        false,
      );

      expect(
        result.suggestedTags.some((t) => t.tag === "知乎" || t.tag === "问答"),
      ).toBe(true);
    });

    it("should extract keywords from title", () => {
      const bookmark: BookmarkData = {
        id: 1,
        title: "TypeScript 高级技巧与最佳实践",
        url: "https://example.com/1",
      };

      const result = analyzer.generateSuggestions(
        bookmark,
        new Set(),
        5,
        false,
      );

      expect(
        result.suggestedTags.some((t) =>
          t.tag.toLowerCase().includes("typescript"),
        ),
      ).toBe(true);
    });

    it("should not duplicate current tags", () => {
      const bookmark: BookmarkData = {
        id: 1,
        title: "React 教程",
        url: "https://example.com/1",
        ai_tags: ["React"],
        tags: [{ name: "React" }],
      };

      const result = analyzer.generateSuggestions(
        bookmark,
        new Set(),
        5,
        false,
      );

      expect(result.currentTags).toContain("React");
      // 建议中不应包含已有标签
      expect(result.suggestedTags.some((t) => t.tag === "React")).toBe(false);
    });

    it("should prefer existing vocabulary when enabled", () => {
      const bookmark: BookmarkData = {
        id: 1,
        title: "关于 JavaScript 的文章",
        url: "https://example.com/1",
      };

      const existingVocab = new Set(["javascript", "前端开发"]);

      const result = analyzer.generateSuggestions(
        bookmark,
        existingVocab,
        5,
        true,
      );

      // 应该优先匹配现有词汇
      const hasExisting = result.suggestedTags.some(
        (t) =>
          t.source === "existing" || existingVocab.has(t.tag.toLowerCase()),
      );
      expect(hasExisting).toBe(true);
    });

    it("should limit suggestions to maxTags", () => {
      const bookmark: BookmarkData = {
        id: 1,
        title: "React Vue Angular JavaScript TypeScript 前端开发",
        url: "https://example.com/1",
        ai_tags: ["React", "Vue", "Angular", "JavaScript", "TypeScript"],
        platform: "juejin",
      };

      const result = analyzer.generateSuggestions(
        bookmark,
        new Set(),
        3,
        false,
      );

      expect(result.suggestedTags.length).toBeLessThanOrEqual(3);
    });
  });

  describe("extractKeywords", () => {
    it("should extract English keywords", () => {
      const keywords = analyzer.extractKeywords(
        "React Hooks are the best way to manage state",
      );

      expect(keywords.some((k) => k.toLowerCase() === "react")).toBe(true);
      expect(keywords.some((k) => k.toLowerCase() === "hooks")).toBe(true);
    });

    it("should extract Chinese keywords", () => {
      const keywords = analyzer.extractKeywords("前端开发性能优化指南");

      expect(keywords.some((k) => k.includes("前端"))).toBe(true);
      expect(
        keywords.some((k) => k.includes("性能优化") || k.includes("性能")),
      ).toBe(true);
    });

    it("should filter stop words", () => {
      const keywords = analyzer.extractKeywords("the best way to learn React");

      expect(keywords.some((k) => k.toLowerCase() === "the")).toBe(false);
      expect(keywords.some((k) => k.toLowerCase() === "to")).toBe(false);
    });

    it("should normalize case for known terms", () => {
      const keywords = analyzer.extractKeywords(
        "learn JAVASCRIPT and TYPESCRIPT",
      );

      // 应该规范化为正确的大小写
      expect(keywords.some((k) => k === "JavaScript")).toBe(true);
      expect(keywords.some((k) => k === "TypeScript")).toBe(true);
    });
  });

  describe("normalizeTagLibrary", () => {
    it("should merge similar tags", () => {
      const tags = [
        {
          tag: "React",
          count: 10,
          bookmarkIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        },
        { tag: "react", count: 3, bookmarkIds: [11, 12, 13] },
        { tag: "REACT", count: 2, bookmarkIds: [14, 15] },
      ];

      const result = analyzer.normalizeTagLibrary(tags, {
        mergeSimilar: true,
        removeRare: false,
      });

      expect(result.merged.length).toBeGreaterThan(0);
      expect(result.merged[0].normalized).toBe("React");
      expect(result.merged[0].original).toContain("react");
    });

    it("should identify rare tags for removal", () => {
      const tags = [
        {
          tag: "React",
          count: 10,
          bookmarkIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        },
        { tag: "RareTag", count: 1, bookmarkIds: [100] },
      ];

      const result = analyzer.normalizeTagLibrary(tags, {
        mergeSimilar: false,
        removeRare: true,
      });

      expect(result.removed.length).toBe(1);
      expect(result.removed[0].tag).toBe("RareTag");
    });
  });

  describe("generateStatistics", () => {
    it("should generate correct statistics", () => {
      const tags = [
        { tag: "React", count: 10 },
        { tag: "Vue", count: 8 },
        { tag: "Angular", count: 5 },
      ];

      const newSuggestions = ["TypeScript", "Node.js"];

      const stats = analyzer.generateStatistics(tags, newSuggestions);

      expect(stats.totalUniqueTags).toBe(3);
      expect(stats.topTags[0].tag).toBe("React");
      expect(stats.suggestedNewTags).toContain("TypeScript");
    });
  });
});

describe("SmartTaggingSkill", () => {
  let skill: SmartTaggingSkill;

  beforeEach(() => {
    skill = new SmartTaggingSkill();
  });

  describe("metadata", () => {
    it("should have correct id", () => {
      expect(skill.metadata.id).toBe("smart_tagging");
    });

    it("should have correct category", () => {
      expect(skill.metadata.category).toBe("organizing");
    });

    it("should not require confirmation", () => {
      expect(skill.metadata.requiresConfirmation).toBe(false);
    });

    it("should have defined steps", () => {
      expect(skill.metadata.steps).toHaveLength(5);
      expect(skill.metadata.steps?.map((s) => s.id)).toEqual([
        "analyze",
        "extract",
        "match",
        "generate",
        "report",
      ]);
    });
  });

  describe("parseInput", () => {
    const mockContext: OrchestrationContext = {
      userId: "test-user",
      conversationId: "test-conv",
      params: {},
    };

    it("should parse default input", async () => {
      const result = await skill.parseInput("推荐标签", mockContext);
      expect(result.scope).toBe("untagged");
      expect(result.mode).toBe("suggest");
      expect(result.useExistingTags).toBe(true);
    });

    it("should detect untagged scope", async () => {
      const result = await skill.parseInput(
        "给无标签的书签添加标签",
        mockContext,
      );
      expect(result.scope).toBe("untagged");
    });

    it("should detect all scope", async () => {
      const result = await skill.parseInput("分析所有书签的标签", mockContext);
      expect(result.scope).toBe("all");
    });

    it("should detect auto-apply mode", async () => {
      const result = await skill.parseInput("自动添加标签", mockContext);
      expect(result.mode).toBe("auto-apply");
    });

    it("should detect normalize mode", async () => {
      const result = await skill.parseInput("整理标签库", mockContext);
      expect(result.mode).toBe("normalize");
      expect(result.normalizeOptions).toBeDefined();
      expect(result.normalizeOptions?.mergeSimilar).toBe(true);
    });

    it("should detect no existing tags preference", async () => {
      const result = await skill.parseInput("用新标签分类", mockContext);
      expect(result.useExistingTags).toBe(false);
    });
  });

  describe("inputSchema", () => {
    it("should validate correct input", () => {
      const input = {
        scope: "untagged",
        mode: "suggest",
        maxTagsPerBookmark: 5,
        useExistingTags: true,
      };
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should reject invalid scope", () => {
      const input = {
        scope: "invalid",
        mode: "suggest",
      };
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject invalid mode", () => {
      const input = {
        scope: "all",
        mode: "invalid",
      };
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should enforce maxTagsPerBookmark range", () => {
      const inputTooLow = {
        scope: "all",
        mode: "suggest",
        maxTagsPerBookmark: 1, // Below minimum
      };
      const inputTooHigh = {
        scope: "all",
        mode: "suggest",
        maxTagsPerBookmark: 20, // Above maximum
      };

      expect(skill.inputSchema.safeParse(inputTooLow).success).toBe(false);
      expect(skill.inputSchema.safeParse(inputTooHigh).success).toBe(false);
    });

    it("should accept normalize options", () => {
      const input = {
        scope: "all",
        mode: "normalize",
        maxTagsPerBookmark: 5,
        useExistingTags: true,
        normalizeOptions: {
          mergeSimilar: true,
          removeRare: true,
        },
      };
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });
});
