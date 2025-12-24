/**
 * RelatedDiscoverySkill 单元测试
 */

import { SimilarityFinder } from "../similarity-finder";
import { RelatedDiscoverySkill } from "../related-discovery.skill";
import type { OrchestrationContext } from "../../../orchestration/types";
import type { BookmarkForDiscovery, RelatedItem } from "../types";

// Mock Supabase
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            is: jest.fn(() => ({
              or: jest.fn(() => ({
                order: jest.fn(() => ({
                  limit: jest.fn(() =>
                    Promise.resolve({
                      data: [
                        {
                          id: 1,
                          title: "React Hooks 完全指南",
                          url: "https://example.com/react-hooks",
                          platform: "juejin",
                          ai_tags: ["React", "Hooks", "前端"],
                          ai_summary: "React Hooks 是 React 16.8 引入的新特性",
                          created_at: "2024-01-01T00:00:00Z",
                        },
                        {
                          id: 2,
                          title: "Vue 3 Composition API",
                          url: "https://example.com/vue-composition",
                          platform: "zhihu",
                          ai_tags: ["Vue", "前端", "Composition API"],
                          created_at: "2024-01-02T00:00:00Z",
                        },
                      ],
                      error: null,
                    }),
                  ),
                })),
              })),
              order: jest.fn(() => ({
                limit: jest.fn(() =>
                  Promise.resolve({
                    data: [],
                    error: null,
                  }),
                ),
              })),
            })),
            single: jest.fn(() =>
              Promise.resolve({
                data: {
                  id: 1,
                  title: "React Hooks 完全指南",
                  url: "https://example.com/react-hooks",
                  platform: "juejin",
                  ai_tags: ["React", "Hooks", "前端"],
                },
                error: null,
              }),
            ),
          })),
        })),
      })),
      rpc: jest.fn(() =>
        Promise.resolve({
          data: [],
          error: { message: "Function not found" },
        }),
      ),
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

describe("SimilarityFinder", () => {
  let finder: SimilarityFinder;

  beforeEach(() => {
    finder = new SimilarityFinder();
  });

  describe("calculateTagSimilarity", () => {
    it("should return 1 for identical tags", () => {
      const tags = ["React", "Hooks", "前端"];
      const similarity = finder.calculateTagSimilarity(tags, tags);
      expect(similarity).toBe(1);
    });

    it("should return 0 for completely different tags", () => {
      const tags1 = ["React", "Hooks"];
      const tags2 = ["Python", "Django"];
      const similarity = finder.calculateTagSimilarity(tags1, tags2);
      expect(similarity).toBe(0);
    });

    it("should return partial similarity for overlapping tags", () => {
      const tags1 = ["React", "Hooks", "前端"];
      const tags2 = ["Vue", "前端", "JavaScript"];
      const similarity = finder.calculateTagSimilarity(tags1, tags2);
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });

    it("should return 0 for empty tags", () => {
      expect(finder.calculateTagSimilarity([], ["React"])).toBe(0);
      expect(finder.calculateTagSimilarity(["React"], [])).toBe(0);
    });

    it("should be case insensitive", () => {
      const tags1 = ["REACT", "hooks"];
      const tags2 = ["react", "HOOKS"];
      const similarity = finder.calculateTagSimilarity(tags1, tags2);
      expect(similarity).toBe(1);
    });
  });

  describe("calculateTitleSimilarity", () => {
    it("should return high similarity for similar titles", () => {
      const title1 = "React Hooks 完全指南";
      const title2 = "React Hooks 教程";
      const similarity = finder.calculateTitleSimilarity(title1, title2);
      expect(similarity).toBeGreaterThan(0.3);
    });

    it("should return 0 for completely different titles", () => {
      const title1 = "Python 数据分析";
      const title2 = "Swift iOS 开发";
      const similarity = finder.calculateTitleSimilarity(title1, title2);
      expect(similarity).toBeLessThan(0.3);
    });
  });

  describe("calculateCombinedSimilarity", () => {
    it("should calculate weighted similarity", () => {
      const source: BookmarkForDiscovery = {
        id: 1,
        title: "React Hooks 教程",
        url: "https://example.com/1",
        ai_tags: ["React", "Hooks"],
        created_at: "2024-01-01T00:00:00Z",
      };

      const target: BookmarkForDiscovery = {
        id: 2,
        title: "React Hooks 实践",
        url: "https://example.com/2",
        ai_tags: ["React", "Hooks", "实践"],
        created_at: "2024-01-01T00:00:00Z",
      };

      const similarity = finder.calculateCombinedSimilarity(source, target);
      expect(similarity).toBeGreaterThan(0.5);
    });
  });

  describe("findByTags", () => {
    it("should find related bookmarks by tags", () => {
      const source: BookmarkForDiscovery = {
        id: 1,
        title: "React Hooks 教程",
        url: "https://example.com/1",
        ai_tags: ["React", "Hooks", "前端"],
        created_at: "2024-01-01T00:00:00Z",
      };

      const candidates: BookmarkForDiscovery[] = [
        {
          id: 2,
          title: "React 组件设计",
          url: "https://example.com/2",
          ai_tags: ["React", "组件", "前端"],
          created_at: "2024-01-01T00:00:00Z",
        },
        {
          id: 3,
          title: "Python 数据分析",
          url: "https://example.com/3",
          ai_tags: ["Python", "数据分析"],
          created_at: "2024-01-01T00:00:00Z",
        },
      ];

      const results = finder.findByTags(source, candidates, {
        limit: 10,
        minSimilarity: 0.3,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].bookmarkId).toBe(2);
    });

    it("should exclude source and specified IDs", () => {
      const source: BookmarkForDiscovery = {
        id: 1,
        title: "Test",
        url: "https://example.com/1",
        ai_tags: ["Tag1"],
        created_at: "2024-01-01T00:00:00Z",
      };

      const candidates: BookmarkForDiscovery[] = [
        { ...source },
        {
          id: 2,
          title: "Test 2",
          url: "https://example.com/2",
          ai_tags: ["Tag1"],
          created_at: "2024-01-01T00:00:00Z",
        },
      ];

      const results = finder.findByTags(source, candidates, {
        limit: 10,
        minSimilarity: 0,
        excludeIds: [1],
      });

      expect(results.every((r) => r.bookmarkId !== 1)).toBe(true);
    });
  });

  describe("findSharedTopics", () => {
    it("should find shared topics", () => {
      const tags1 = ["React", "Hooks", "前端"];
      const tags2 = ["Vue", "前端", "JavaScript"];

      const shared = finder.findSharedTopics(tags1, tags2);
      expect(shared).toContain("前端");
    });

    it("should return empty array for no overlap", () => {
      const tags1 = ["React", "Hooks"];
      const tags2 = ["Python", "Django"];

      const shared = finder.findSharedTopics(tags1, tags2);
      expect(shared).toHaveLength(0);
    });
  });

  describe("clusterItems", () => {
    it("should cluster items by shared topics", () => {
      const items: RelatedItem[] = [
        {
          bookmarkId: 1,
          title: "React 1",
          url: "https://example.com/1",
          platform: "juejin",
          similarity: 0.8,
          sharedTopics: ["React"],
        },
        {
          bookmarkId: 2,
          title: "React 2",
          url: "https://example.com/2",
          platform: "juejin",
          similarity: 0.7,
          sharedTopics: ["React"],
        },
        {
          bookmarkId: 3,
          title: "Vue 1",
          url: "https://example.com/3",
          platform: "zhihu",
          similarity: 0.6,
          sharedTopics: ["Vue"],
        },
      ];

      const clusters = finder.clusterItems(items);

      expect(clusters.length).toBe(2);
      expect(clusters.find((c) => c.name === "React")?.count).toBe(2);
      expect(clusters.find((c) => c.name === "Vue")?.count).toBe(1);
    });

    it("should return empty array for empty input", () => {
      const clusters = finder.clusterItems([]);
      expect(clusters).toHaveLength(0);
    });
  });

  describe("generateKnowledgeGraph", () => {
    it("should generate nodes and edges", () => {
      const source: BookmarkForDiscovery = {
        id: 1,
        title: "Source",
        url: "https://example.com/source",
        created_at: "2024-01-01T00:00:00Z",
      };

      const items: RelatedItem[] = [
        {
          bookmarkId: 2,
          title: "Related 1",
          url: "https://example.com/2",
          platform: "juejin",
          similarity: 0.8,
          sharedTopics: ["React"],
        },
        {
          bookmarkId: 3,
          title: "Related 2",
          url: "https://example.com/3",
          platform: "zhihu",
          similarity: 0.7,
          sharedTopics: ["React"],
        },
      ];

      const graph = finder.generateKnowledgeGraph(source, items);

      expect(graph.nodes.length).toBe(3);
      expect(graph.nodes.find((n) => n.id === 1)?.type).toBe("source");
      expect(graph.edges.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("calculateStats", () => {
    it("should calculate correct statistics", () => {
      const items: RelatedItem[] = [
        {
          bookmarkId: 1,
          title: "Test 1",
          url: "https://example.com/1",
          platform: "juejin",
          similarity: 0.9,
          sharedTopics: ["React"],
          aiTags: ["React", "Hooks"],
        },
        {
          bookmarkId: 2,
          title: "Test 2",
          url: "https://example.com/2",
          platform: "zhihu",
          similarity: 0.7,
          sharedTopics: ["Vue"],
          aiTags: ["Vue"],
        },
      ];

      const stats = finder.calculateStats(items);

      expect(stats.totalFound).toBe(2);
      expect(stats.avgSimilarity).toBe(0.8);
      expect(stats.platformDistribution["juejin"]).toBe(1);
      expect(stats.similarityDistribution.high).toBe(1);
      expect(stats.similarityDistribution.medium).toBe(1);
    });
  });

  describe("generateExplanation", () => {
    it("should generate explanation based on similarity", () => {
      const item: RelatedItem = {
        bookmarkId: 1,
        title: "Related",
        url: "https://example.com/1",
        platform: "juejin",
        similarity: 0.9,
        sharedTopics: ["React", "Hooks"],
      };

      const explanation = finder.generateExplanation("Source", item);

      expect(explanation).toContain("高度相关");
      expect(explanation).toContain("React");
    });
  });

  describe("generateSuggestions", () => {
    it("should generate suggestions based on stats", () => {
      const stats = {
        totalFound: 10,
        avgSimilarity: 0.85,
        topicsDiscovered: ["React", "Vue", "Angular"],
        platformDistribution: { juejin: 5, zhihu: 3, github: 2 },
        similarityDistribution: { high: 6, medium: 3, low: 1 },
      };

      const clusters = [
        {
          name: "React",
          count: 5,
          avgSimilarity: 0.9,
          bookmarkIds: [1, 2, 3, 4, 5],
        },
      ];

      const suggestions = finder.generateSuggestions(stats, clusters);

      expect(suggestions.length).toBeGreaterThan(0);
    });

    it("should suggest lowering threshold when no results", () => {
      const stats = {
        totalFound: 0,
        avgSimilarity: 0,
        topicsDiscovered: [],
        platformDistribution: {},
        similarityDistribution: { high: 0, medium: 0, low: 0 },
      };

      const suggestions = finder.generateSuggestions(stats, []);

      expect(suggestions[0]).toContain("未找到");
    });
  });
});

describe("RelatedDiscoverySkill", () => {
  let skill: RelatedDiscoverySkill;

  beforeEach(() => {
    skill = new RelatedDiscoverySkill();
  });

  describe("metadata", () => {
    it("should have correct id", () => {
      expect(skill.metadata.id).toBe("related_discovery");
    });

    it("should have correct category", () => {
      expect(skill.metadata.category).toBe("understanding");
    });

    it("should not require confirmation", () => {
      expect(skill.metadata.requiresConfirmation).toBe(false);
    });

    it("should have defined steps", () => {
      expect(skill.metadata.steps).toHaveLength(5);
      expect(skill.metadata.steps?.map((s) => s.id)).toEqual([
        "embed",
        "search",
        "cluster",
        "explain",
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

    it("should parse query input by default", async () => {
      const result = await skill.parseInput("找相关内容", mockContext);
      expect(result.source).toBe("query");
      expect(result.query).toBe("找相关内容");
    });

    it("should detect bookmark source with ID", async () => {
      const result = await skill.parseInput(
        "找与书签 ID:123 相关的内容",
        mockContext,
      );
      expect(result.source).toBe("bookmark");
      expect(result.bookmarkId).toBe(123);
    });

    it("should detect topic source", async () => {
      const result = await skill.parseInput(
        "查找 React 相关的书签",
        mockContext,
      );
      expect(result.source).toBe("topic");
      expect(result.topic).toBe("React");
    });

    it("should parse limit from message", async () => {
      const result = await skill.parseInput("找10个相关内容", mockContext);
      expect(result.limit).toBe(10);
    });

    it("should detect explanation option", async () => {
      const result = await skill.parseInput(
        "找相关内容并解释为什么相关",
        mockContext,
      );
      expect(result.includeExplanation).toBe(true);
    });

    it("should detect cluster option", async () => {
      const result = await skill.parseInput(
        "找相关内容并分类显示",
        mockContext,
      );
      expect(result.groupByCluster).toBe(true);
    });

    it("should use bookmarkId from context params", async () => {
      const contextWithParams: OrchestrationContext = {
        userId: "test-user",
        conversationId: "test-conv",
        params: { bookmarkId: 456 },
      };

      const result = await skill.parseInput("找相关", contextWithParams);
      expect(result.source).toBe("bookmark");
      expect(result.bookmarkId).toBe(456);
    });
  });

  describe("inputSchema", () => {
    it("should validate correct input", () => {
      const input = {
        source: "query",
        query: "React Hooks",
        limit: 20,
        minSimilarity: 0.7,
        includeExplanation: false,
        groupByCluster: false,
      };
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should reject invalid source", () => {
      const input = {
        source: "invalid",
        query: "test",
      };
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should enforce limit range", () => {
      const inputTooLow = {
        source: "query",
        query: "test",
        limit: 2,
      };
      expect(skill.inputSchema.safeParse(inputTooLow).success).toBe(false);

      const inputTooHigh = {
        source: "query",
        query: "test",
        limit: 100,
      };
      expect(skill.inputSchema.safeParse(inputTooHigh).success).toBe(false);
    });

    it("should enforce minSimilarity range", () => {
      const inputTooLow = {
        source: "query",
        query: "test",
        minSimilarity: 0.1,
      };
      expect(skill.inputSchema.safeParse(inputTooLow).success).toBe(false);

      const inputTooHigh = {
        source: "query",
        query: "test",
        minSimilarity: 0.99,
      };
      expect(skill.inputSchema.safeParse(inputTooHigh).success).toBe(false);
    });

    it("should accept bookmark source with ID", () => {
      const input = {
        source: "bookmark",
        bookmarkId: 123,
        limit: 20,
        minSimilarity: 0.7,
        includeExplanation: true,
        groupByCluster: true,
      };
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });
});
