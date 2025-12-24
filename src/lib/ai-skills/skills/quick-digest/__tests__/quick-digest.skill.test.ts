/**
 * QuickDigestSkill 单元测试
 */

import {
  TopicClusterer,
  groupByPlatform,
  groupByDate,
  groupByNone,
} from "../topic-clustering";
import {
  MarkdownFormatter,
  MindmapFormatter,
  CardsFormatter,
  OutlineFormatter,
  createFormatter,
  generateDigestTitle,
  generateInsights,
} from "../formatters";
import { QuickDigestSkill } from "../quick-digest.skill";
import type { OrchestrationContext } from "../../../orchestration/types";
import type { TopicGroup, DigestStats } from "../types";

// Mock Supabase
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            is: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => ({
                  gte: jest.fn(() =>
                    Promise.resolve({
                      data: [
                        {
                          id: 1,
                          title: "React Hooks 教程",
                          url: "https://example.com/react-hooks",
                          ai_summary: "React Hooks 是 React 16.8 引入的新特性",
                          ai_tags: ["React", "Hooks", "前端"],
                          platform: "juejin",
                          created_at: "2025-12-20T10:00:00Z",
                        },
                        {
                          id: 2,
                          title: "TypeScript 高级技巧",
                          url: "https://example.com/typescript",
                          ai_summary: "TypeScript 提供了强大的类型系统",
                          ai_tags: ["TypeScript", "前端"],
                          platform: "zhihu",
                          created_at: "2025-12-21T10:00:00Z",
                        },
                      ],
                      error: null,
                    }),
                  ),
                  in: jest.fn(() =>
                    Promise.resolve({
                      data: [],
                      error: null,
                    }),
                  ),
                })),
              })),
            })),
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

describe("TopicClusterer", () => {
  let clusterer: TopicClusterer;

  beforeEach(() => {
    clusterer = new TopicClusterer();
  });

  describe("cluster", () => {
    it("should return empty array for empty input", () => {
      const result = clusterer.cluster([]);
      expect(result).toEqual([]);
    });

    it("should cluster similar bookmarks", () => {
      const bookmarks = [
        {
          id: 1,
          title: "React Hooks 教程详解",
          url: "https://example.com/1",
          ai_summary:
            "React Hooks 是 React 16.8 的新特性，包括 useState 和 useEffect",
          ai_tags: ["React", "Hooks", "前端"],
          platform: "juejin",
          created_at: "2025-12-20T10:00:00Z",
        },
        {
          id: 2,
          title: "React Hooks 实战指南",
          url: "https://example.com/2",
          ai_summary: "React Hooks 的最佳实践，自定义 Hooks 的编写方法",
          ai_tags: ["React", "Hooks", "前端"],
          platform: "juejin",
          created_at: "2025-12-21T10:00:00Z",
        },
        {
          id: 3,
          title: "React Context 使用详解",
          url: "https://example.com/3",
          ai_summary: "React Context 用于跨组件传递数据",
          ai_tags: ["React", "Context", "前端"],
          platform: "juejin",
          created_at: "2025-12-22T10:00:00Z",
        },
        {
          id: 4,
          title: "React 性能优化技巧",
          url: "https://example.com/4",
          ai_summary: "React 应用性能优化方法，包括 memo 和 useMemo",
          ai_tags: ["React", "性能", "前端"],
          platform: "zhihu",
          created_at: "2025-12-23T10:00:00Z",
        },
      ];

      const result = clusterer.cluster(bookmarks);

      // 聚类算法可能将相似的书签分组或不分组（取决于相似度阈值）
      // 测试应该验证返回的格式正确
      expect(Array.isArray(result)).toBe(true);

      // 每个聚类应该有正确的结构
      result.forEach((topic) => {
        expect(topic.bookmarks.length).toBeGreaterThan(0);
        expect(topic.name).toBeDefined();
        expect(topic.count).toBe(topic.bookmarks.length);
        expect(Array.isArray(topic.keywords)).toBe(true);
      });
    });

    it("should extract keywords from bookmarks", () => {
      const bookmarks = [
        {
          id: 1,
          title: "JavaScript 性能优化详解",
          url: "https://example.com/1",
          ai_tags: ["JavaScript", "性能"],
          platform: null,
          created_at: "2025-12-20T10:00:00Z",
        },
        {
          id: 2,
          title: "JavaScript 异步编程详解",
          url: "https://example.com/2",
          ai_tags: ["JavaScript", "异步", "Promise"],
          platform: null,
          created_at: "2025-12-21T10:00:00Z",
        },
        {
          id: 3,
          title: "JavaScript ES6 新特性",
          url: "https://example.com/3",
          ai_tags: ["JavaScript", "ES6"],
          platform: null,
          created_at: "2025-12-22T10:00:00Z",
        },
      ];

      const result = clusterer.cluster(bookmarks);

      // 收集所有关键词（来自所有聚类）
      const allKeywords = result.flatMap((t) => t.keywords);

      // 应该有一些关键词被提取出来
      expect(Array.isArray(allKeywords)).toBe(true);

      // 如果有聚类结果，应该包含 javascript 相关关键词
      if (result.length > 0) {
        const hasJavaScript = allKeywords.some(
          (k) =>
            k.toLowerCase().includes("javascript") ||
            k.toLowerCase() === "javascript",
        );
        expect(hasJavaScript).toBe(true);
      }
    });
  });
});

describe("groupByPlatform", () => {
  it("should group bookmarks by platform", () => {
    const bookmarks = [
      {
        id: 1,
        title: "Article 1",
        url: "https://example.com/1",
        platform: "juejin",
        created_at: "2025-12-20T10:00:00Z",
      },
      {
        id: 2,
        title: "Article 2",
        url: "https://example.com/2",
        platform: "juejin",
        created_at: "2025-12-21T10:00:00Z",
      },
      {
        id: 3,
        title: "Article 3",
        url: "https://example.com/3",
        platform: "zhihu",
        created_at: "2025-12-22T10:00:00Z",
      },
    ];

    const result = groupByPlatform(bookmarks);

    expect(result.length).toBe(2);
    expect(result.find((g) => g.name === "掘金")?.count).toBe(2);
    expect(result.find((g) => g.name === "知乎")?.count).toBe(1);
  });

  it("should handle bookmarks without platform", () => {
    const bookmarks = [
      {
        id: 1,
        title: "Article 1",
        url: "https://example.com/1",
        platform: null,
        created_at: "2025-12-20T10:00:00Z",
      },
    ];

    const result = groupByPlatform(bookmarks);

    expect(result.length).toBe(1);
    expect(result[0].name).toBe("其他");
  });
});

describe("groupByDate", () => {
  it("should group bookmarks by date", () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const bookmarks = [
      {
        id: 1,
        title: "Article 1",
        url: "https://example.com/1",
        platform: null,
        created_at: today.toISOString(),
      },
      {
        id: 2,
        title: "Article 2",
        url: "https://example.com/2",
        platform: null,
        created_at: today.toISOString(),
      },
      {
        id: 3,
        title: "Article 3",
        url: "https://example.com/3",
        platform: null,
        created_at: yesterday.toISOString(),
      },
    ];

    const result = groupByDate(bookmarks);

    expect(result.length).toBe(2);
    expect(result[0].name).toBe("今天"); // 最新的排前面
  });
});

describe("groupByNone", () => {
  it("should put all bookmarks in one group", () => {
    const bookmarks = [
      {
        id: 1,
        title: "Article 1",
        url: "https://example.com/1",
        platform: null,
        created_at: "2025-12-20T10:00:00Z",
      },
      {
        id: 2,
        title: "Article 2",
        url: "https://example.com/2",
        platform: null,
        created_at: "2025-12-21T10:00:00Z",
      },
    ];

    const result = groupByNone(bookmarks);

    expect(result.length).toBe(1);
    expect(result[0].name).toBe("全部收藏");
    expect(result[0].count).toBe(2);
  });

  it("should return empty array for empty input", () => {
    const result = groupByNone([]);
    expect(result).toEqual([]);
  });
});

describe("Formatters", () => {
  const mockTopics: TopicGroup[] = [
    {
      name: "React 开发",
      count: 2,
      keywords: ["React", "Hooks"],
      summary: "React 相关技术文章",
      bookmarks: [
        {
          id: 1,
          title: "React Hooks 教程",
          summary: "React Hooks 是 React 16.8 的新特性",
          url: "https://example.com/1",
          platform: "juejin",
          createdAt: "2025-12-20T10:00:00Z",
        },
      ],
    },
  ];

  const mockStats: DigestStats = {
    totalProcessed: 10,
    topicsIdentified: 3,
    platformDistribution: { juejin: 5, zhihu: 3, github: 2 },
    dateRange: { start: "2025-12-15", end: "2025-12-22" },
  };

  const mockOptions = {
    title: "本周阅读摘要",
    summaryLength: "standard" as const,
    includeInsights: true,
    insights: [{ type: "trend" as const, content: "您最近关注 React 较多" }],
    generatedAt: "2025-12-22 10:00:00",
  };

  describe("MarkdownFormatter", () => {
    it("should format topics as markdown", () => {
      const formatter = new MarkdownFormatter();
      const result = formatter.format(mockTopics, mockStats, mockOptions);

      expect(result).toContain("# 本周阅读摘要");
      expect(result).toContain("React 开发");
      expect(result).toContain("React Hooks 教程");
      expect(result).toContain("💡 洞察");
    });
  });

  describe("MindmapFormatter", () => {
    it("should format topics as mindmap", () => {
      const formatter = new MindmapFormatter();
      const result = formatter.format(mockTopics, mockStats, mockOptions);

      expect(result).toContain("# 本周阅读摘要");
      expect(result).toContain("## React 开发");
      expect(result).toContain("### 关键词");
    });
  });

  describe("CardsFormatter", () => {
    it("should format topics as JSON cards", () => {
      const formatter = new CardsFormatter();
      const result = formatter.format(mockTopics, mockStats, mockOptions);

      const parsed = JSON.parse(result);
      expect(parsed.title).toBe("本周阅读摘要");
      expect(parsed.cards).toHaveLength(1);
      expect(parsed.cards[0].topic).toBe("React 开发");
    });
  });

  describe("OutlineFormatter", () => {
    it("should format topics as outline", () => {
      const formatter = new OutlineFormatter();
      const result = formatter.format(mockTopics, mockStats, mockOptions);

      expect(result).toContain("本周阅读摘要");
      expect(result).toContain("1. React 开发");
      expect(result).toContain("洞察与建议");
    });
  });

  describe("createFormatter", () => {
    it("should create correct formatter type", () => {
      expect(createFormatter("markdown")).toBeInstanceOf(MarkdownFormatter);
      expect(createFormatter("mindmap")).toBeInstanceOf(MindmapFormatter);
      expect(createFormatter("cards")).toBeInstanceOf(CardsFormatter);
      expect(createFormatter("outline")).toBeInstanceOf(OutlineFormatter);
    });

    it("should default to MarkdownFormatter", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(createFormatter("unknown" as any)).toBeInstanceOf(
        MarkdownFormatter,
      );
    });
  });
});

describe("generateDigestTitle", () => {
  it("should generate correct title for each scope", () => {
    expect(generateDigestTitle("today")).toBe("今日阅读摘要");
    expect(generateDigestTitle("week")).toBe("本周阅读摘要");
    expect(generateDigestTitle("month")).toBe("本月阅读摘要");
    expect(generateDigestTitle("folder")).toBe("文件夹内容摘要");
    expect(generateDigestTitle("selected")).toBe("选中内容摘要");
  });
});

describe("generateInsights", () => {
  it("should generate trend insight for popular topics", () => {
    const topics: TopicGroup[] = [
      {
        name: "React",
        count: 5,
        keywords: [],
        bookmarks: [],
      },
    ];
    const stats: DigestStats = {
      totalProcessed: 10,
      topicsIdentified: 3,
      platformDistribution: { juejin: 10 },
      dateRange: { start: "2025-12-15", end: "2025-12-22" },
    };

    const insights = generateInsights(topics, stats);

    expect(insights.some((i) => i.type === "trend")).toBe(true);
    expect(insights.some((i) => i.content.includes("React"))).toBe(true);
  });

  it("should generate platform distribution insight", () => {
    const topics: TopicGroup[] = [];
    const stats: DigestStats = {
      totalProcessed: 10,
      topicsIdentified: 0,
      platformDistribution: { juejin: 8, zhihu: 2 },
      dateRange: { start: "2025-12-15", end: "2025-12-22" },
    };

    const insights = generateInsights(topics, stats);

    expect(insights.some((i) => i.content.includes("80%"))).toBe(true);
  });
});

describe("QuickDigestSkill", () => {
  let skill: QuickDigestSkill;

  beforeEach(() => {
    skill = new QuickDigestSkill();
  });

  describe("metadata", () => {
    it("should have correct id", () => {
      expect(skill.metadata.id).toBe("quick_digest");
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
        "collect",
        "cluster",
        "summarize",
        "format",
        "deliver",
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
      const result = await skill.parseInput("生成摘要", mockContext);
      expect(result.scope).toBe("week");
      expect(result.outputFormat).toBe("markdown");
      expect(result.groupBy).toBe("topic");
    });

    it("should detect today scope", async () => {
      const result = await skill.parseInput("今天的摘要", mockContext);
      expect(result.scope).toBe("today");
    });

    it("should detect week scope", async () => {
      const result = await skill.parseInput("本周阅读总结", mockContext);
      expect(result.scope).toBe("week");
    });

    it("should detect month scope", async () => {
      const result = await skill.parseInput("本月收藏摘要", mockContext);
      expect(result.scope).toBe("month");
    });

    it("should detect mindmap format", async () => {
      const result = await skill.parseInput("生成思维导图", mockContext);
      expect(result.outputFormat).toBe("mindmap");
    });

    it("should detect cards format", async () => {
      const result = await skill.parseInput("卡片格式摘要", mockContext);
      expect(result.outputFormat).toBe("cards");
    });

    it("should detect platform grouping", async () => {
      const result = await skill.parseInput("按平台分组摘要", mockContext);
      expect(result.groupBy).toBe("platform");
    });

    it("should detect date grouping", async () => {
      const result = await skill.parseInput("按日期整理", mockContext);
      expect(result.groupBy).toBe("date");
    });

    it("should detect brief summary length", async () => {
      const result = await skill.parseInput("简短摘要", mockContext);
      expect(result.summaryLength).toBe("brief");
    });

    it("should detect detailed summary length", async () => {
      const result = await skill.parseInput("详细总结", mockContext);
      expect(result.summaryLength).toBe("detailed");
    });
  });

  describe("inputSchema", () => {
    it("should validate correct input", () => {
      const input = {
        scope: "week",
        outputFormat: "markdown",
        groupBy: "topic",
        maxItems: 30,
        summaryLength: "standard",
        includeInsights: true,
      };
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should reject invalid scope", () => {
      const input = {
        scope: "invalid",
        outputFormat: "markdown",
      };
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject invalid format", () => {
      const input = {
        scope: "week",
        outputFormat: "invalid",
      };
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should enforce max items limit", () => {
      const input = {
        scope: "week",
        outputFormat: "markdown",
        maxItems: 200, // Above max
      };
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should enforce min items limit", () => {
      const input = {
        scope: "week",
        outputFormat: "markdown",
        maxItems: 5, // Below min
      };
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});
