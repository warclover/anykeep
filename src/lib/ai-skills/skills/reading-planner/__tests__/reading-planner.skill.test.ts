/**
 * ReadingPlannerSkill 单元测试
 */

import { ReadingPlanGenerator } from "../plan-generator";
import { ReadingPlannerSkill } from "../reading-planner.skill";
import type { OrchestrationContext } from "../../../orchestration/types";
import type { BookmarkForPlan, ReadingPlannerInput } from "../types";

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
                          bookmark_tags: [],
                        },
                        {
                          id: 2,
                          title: "TypeScript 入门教程",
                          url: "https://example.com/typescript",
                          platform: "zhihu",
                          ai_tags: ["TypeScript", "前端"],
                          created_at: "2024-01-02T00:00:00Z",
                          bookmark_tags: [],
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
                    data: [
                      {
                        id: 1,
                        title: "React Hooks 完全指南",
                        url: "https://example.com/react-hooks",
                        platform: "juejin",
                        ai_tags: ["React", "Hooks", "前端"],
                        created_at: "2024-01-01T00:00:00Z",
                        bookmark_tags: [],
                      },
                    ],
                    error: null,
                  }),
                ),
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

// Mock uuid
jest.mock("uuid", () => ({
  v4: jest.fn(() => "test-uuid-1234"),
}));

describe("ReadingPlanGenerator", () => {
  let generator: ReadingPlanGenerator;

  beforeEach(() => {
    generator = new ReadingPlanGenerator();
  });

  describe("estimateReadTime", () => {
    it("should estimate based on platform", () => {
      const bookmark: BookmarkForPlan = {
        id: 1,
        title: "Test",
        url: "https://example.com",
        platform: "wechat",
        created_at: "2024-01-01T00:00:00Z",
      };

      const estimate = generator.estimateReadTime(bookmark);
      expect(estimate).toBe(8); // wechat default
    });

    it("should adjust based on content length", () => {
      const bookmark: BookmarkForPlan = {
        id: 1,
        title: "Test",
        url: "https://example.com",
        platform: "wechat",
        content_length: 2000, // 2000 words = 10 minutes at 200 wpm
        created_at: "2024-01-01T00:00:00Z",
      };

      const estimate = generator.estimateReadTime(bookmark);
      // 0.3 * 8 + 0.7 * 10 = 2.4 + 7 = 9.4 ≈ 9
      expect(estimate).toBeGreaterThanOrEqual(8);
      expect(estimate).toBeLessThanOrEqual(12);
    });

    it("should use default for unknown platform", () => {
      const bookmark: BookmarkForPlan = {
        id: 1,
        title: "Test",
        url: "https://example.com",
        created_at: "2024-01-01T00:00:00Z",
      };

      const estimate = generator.estimateReadTime(bookmark);
      expect(estimate).toBe(10); // default
    });

    it("should clamp to min/max range", () => {
      const longContent: BookmarkForPlan = {
        id: 1,
        title: "Test",
        url: "https://example.com",
        content_length: 100000, // Very long
        created_at: "2024-01-01T00:00:00Z",
      };

      const estimate = generator.estimateReadTime(longContent);
      expect(estimate).toBeLessThanOrEqual(60);
      expect(estimate).toBeGreaterThanOrEqual(2);
    });
  });

  describe("calculatePriority", () => {
    it("should prioritize old bookmarks by date", () => {
      const oldBookmark: BookmarkForPlan = {
        id: 1,
        title: "Test",
        url: "https://example.com",
        created_at: new Date(
          Date.now() - 60 * 24 * 60 * 60 * 1000,
        ).toISOString(), // 60 days ago
      };

      const result = generator.calculatePriority(oldBookmark, "date");
      expect(result.priority).toBe("high");
    });

    it("should prioritize by importance based on tags", () => {
      const important: BookmarkForPlan = {
        id: 1,
        title: "Test",
        url: "https://example.com",
        ai_tags: ["重要", "必读"],
        created_at: "2024-01-01T00:00:00Z",
      };

      const result = generator.calculatePriority(important, "importance");
      expect(result.priority).toBe("high");
    });

    it("should prioritize short content by reading_time", () => {
      const short: BookmarkForPlan = {
        id: 1,
        title: "Test",
        url: "https://example.com",
        platform: "twitter", // 2 minutes
        created_at: "2024-01-01T00:00:00Z",
      };

      const result = generator.calculatePriority(short, "reading_time");
      expect(result.priority).toBe("high");
    });

    it("should calculate topic relevance", () => {
      const relevant: BookmarkForPlan = {
        id: 1,
        title: "React Hooks 完全指南",
        url: "https://example.com",
        ai_tags: ["React", "Hooks"],
        ai_summary: "React Hooks 是前端开发的重要技术",
        created_at: "2024-01-01T00:00:00Z",
      };

      const result = generator.calculatePriority(relevant, "topic", "React");
      expect(result.priority).toBe("high");
      expect(result.topicRelevance).toBeGreaterThan(0.5);
    });
  });

  describe("calculateTopicRelevance", () => {
    it("should calculate relevance from title", () => {
      const bookmark: BookmarkForPlan = {
        id: 1,
        title: "React Hooks 教程",
        url: "https://example.com",
        created_at: "2024-01-01T00:00:00Z",
      };

      const relevance = generator.calculateTopicRelevance(bookmark, "React");
      expect(relevance).toBeGreaterThan(0);
    });

    it("should return 0 for unrelated content", () => {
      const bookmark: BookmarkForPlan = {
        id: 1,
        title: "Python 数据分析",
        url: "https://example.com",
        ai_tags: ["Python", "数据分析"],
        created_at: "2024-01-01T00:00:00Z",
      };

      const relevance = generator.calculateTopicRelevance(bookmark, "React");
      expect(relevance).toBeLessThan(0.3);
    });
  });

  describe("generateSchedule", () => {
    it("should generate schedule based on daily time", () => {
      const bookmarks = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        title: `Article ${i + 1}`,
        url: `https://example.com/${i}`,
        estimatedReadTime: 10,
        priority: "medium" as const,
        isReview: false,
        created_at: "2024-01-01T00:00:00Z",
      }));

      const input: ReadingPlannerInput = {
        goal: "daily_routine",
        timeAvailable: {
          dailyMinutes: 30,
          daysPerWeek: 5,
        },
        preferences: {
          prioritizeBy: "date",
          includeReview: false,
          groupByTopic: false,
        },
      };

      const schedule = generator.generateSchedule(bookmarks, input);

      expect(schedule.length).toBeGreaterThan(0);
      // 30 min/day, 10 min each = ~3 items per day
      expect(schedule[0].items.length).toBeLessThanOrEqual(4);
    });

    it("should respect days per week", () => {
      const bookmarks = Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        title: `Article ${i + 1}`,
        url: `https://example.com/${i}`,
        estimatedReadTime: 15,
        priority: "medium" as const,
        isReview: false,
        created_at: "2024-01-01T00:00:00Z",
      }));

      const input: ReadingPlannerInput = {
        goal: "daily_routine",
        timeAvailable: {
          dailyMinutes: 30,
          daysPerWeek: 3,
          totalWeeks: 2,
        },
        preferences: {
          prioritizeBy: "date",
          includeReview: false,
          groupByTopic: false,
        },
      };

      const schedule = generator.generateSchedule(bookmarks, input);

      // 2 weeks * 3 days = 6 days max
      expect(schedule.length).toBeLessThanOrEqual(6);
    });
  });

  describe("generateMilestones", () => {
    it("should generate milestones at 25%, 50%, 75%, 100%", () => {
      const schedule = [
        {
          day: 1,
          date: "2024-01-01",
          estimatedMinutes: 30,
          items: [{} as never, {} as never],
        },
        {
          day: 2,
          date: "2024-01-02",
          estimatedMinutes: 30,
          items: [{} as never, {} as never],
        },
        {
          day: 3,
          date: "2024-01-03",
          estimatedMinutes: 30,
          items: [{} as never, {} as never],
        },
        {
          day: 4,
          date: "2024-01-04",
          estimatedMinutes: 30,
          items: [{} as never, {} as never],
        },
      ];

      const milestones = generator.generateMilestones(schedule);

      expect(milestones.length).toBeGreaterThanOrEqual(1);
      expect(milestones.some((m) => m.description.includes("25%"))).toBe(true);
    });
  });

  describe("calculateStats", () => {
    it("should calculate correct statistics", () => {
      const bookmarks = [
        {
          id: 1,
          title: "Test 1",
          url: "https://example.com/1",
          platform: "juejin",
          ai_tags: ["React"],
          estimatedReadTime: 10,
          priority: "high" as const,
          isReview: false,
          created_at: "2024-01-01T00:00:00Z",
        },
        {
          id: 2,
          title: "Test 2",
          url: "https://example.com/2",
          platform: "zhihu",
          ai_tags: ["Vue"],
          estimatedReadTime: 15,
          priority: "medium" as const,
          isReview: false,
          created_at: "2024-01-01T00:00:00Z",
        },
      ];

      const schedule = [
        {
          day: 1,
          date: "2024-01-01",
          estimatedMinutes: 25,
          items: bookmarks.map((b) => ({
            bookmarkId: b.id,
            title: b.title,
            estimatedReadTime: b.estimatedReadTime,
            priority: b.priority,
            isReview: false,
          })),
        },
      ];

      const stats = generator.calculateStats(bookmarks, schedule);

      expect(stats.totalItems).toBe(2);
      expect(stats.totalReadingTime).toBe(25);
      expect(stats.topicCoverage["React"]).toBe(1);
      expect(stats.platformDistribution["juejin"]).toBe(1);
    });
  });

  describe("generatePlan", () => {
    it("should generate complete plan", () => {
      const bookmarks: BookmarkForPlan[] = [
        {
          id: 1,
          title: "React Hooks 教程",
          url: "https://example.com/1",
          platform: "juejin",
          ai_tags: ["React"],
          created_at: "2024-01-01T00:00:00Z",
        },
        {
          id: 2,
          title: "Vue 3 入门",
          url: "https://example.com/2",
          platform: "zhihu",
          ai_tags: ["Vue"],
          created_at: "2024-01-02T00:00:00Z",
        },
      ];

      const input: ReadingPlannerInput = {
        goal: "clear_backlog",
        timeAvailable: {
          dailyMinutes: 30,
          daysPerWeek: 5,
        },
        preferences: {
          prioritizeBy: "date",
          includeReview: false,
          groupByTopic: false,
        },
      };

      const plan = generator.generatePlan(bookmarks, input);

      expect(plan.plan.id).toBe("test-uuid-1234");
      expect(plan.plan.goal).toBe("clear_backlog");
      expect(plan.schedule.length).toBeGreaterThan(0);
      expect(plan.stats.totalItems).toBeGreaterThan(0);
      expect(plan.summary).toContain("📚");
    });
  });
});

describe("ReadingPlannerSkill", () => {
  let skill: ReadingPlannerSkill;

  beforeEach(() => {
    skill = new ReadingPlannerSkill();
  });

  describe("metadata", () => {
    it("should have correct id", () => {
      expect(skill.metadata.id).toBe("reading_planner");
    });

    it("should have correct category", () => {
      expect(skill.metadata.category).toBe("learning");
    });

    it("should not require confirmation", () => {
      expect(skill.metadata.requiresConfirmation).toBe(false);
    });

    it("should have defined steps", () => {
      expect(skill.metadata.steps).toHaveLength(5);
      expect(skill.metadata.steps?.map((s) => s.id)).toEqual([
        "assess",
        "estimate",
        "prioritize",
        "schedule",
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
      const result = await skill.parseInput("帮我制定阅读计划", mockContext);
      expect(result.goal).toBe("daily_routine");
      expect(result.timeAvailable.dailyMinutes).toBe(30);
    });

    it("should detect clear_backlog goal", async () => {
      const result = await skill.parseInput("清理我的阅读积压", mockContext);
      expect(result.goal).toBe("clear_backlog");
    });

    it("should detect learn_topic goal with topic", async () => {
      const result = await skill.parseInput("学习 React 相关内容", mockContext);
      expect(result.goal).toBe("learn_topic");
      expect(result.topic).toBe("React");
    });

    it("should parse daily minutes", async () => {
      const result = await skill.parseInput(
        "我每天有45分钟阅读时间",
        mockContext,
      );
      expect(result.timeAvailable.dailyMinutes).toBe(45);
    });

    it("should parse days per week", async () => {
      const result = await skill.parseInput("每天都要阅读", mockContext);
      expect(result.timeAvailable.daysPerWeek).toBe(7);
    });

    it("should detect importance prioritization", async () => {
      const result = await skill.parseInput("按重要程度安排阅读", mockContext);
      expect(result.preferences.prioritizeBy).toBe("importance");
    });

    it("should detect review option", async () => {
      const result = await skill.parseInput("包含复习内容", mockContext);
      expect(result.preferences.includeReview).toBe(true);
    });
  });

  describe("inputSchema", () => {
    it("should validate correct input", () => {
      const input = {
        goal: "clear_backlog",
        timeAvailable: {
          dailyMinutes: 30,
          daysPerWeek: 5,
        },
        preferences: {
          prioritizeBy: "date",
          includeReview: false,
          groupByTopic: false,
        },
      };
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should reject invalid goal", () => {
      const input = {
        goal: "invalid",
        timeAvailable: {
          dailyMinutes: 30,
          daysPerWeek: 5,
        },
        preferences: {
          prioritizeBy: "date",
          includeReview: false,
          groupByTopic: false,
        },
      };
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should enforce dailyMinutes range", () => {
      const inputTooLow = {
        goal: "clear_backlog",
        timeAvailable: {
          dailyMinutes: 5, // Below minimum
          daysPerWeek: 5,
        },
        preferences: {
          prioritizeBy: "date",
          includeReview: false,
          groupByTopic: false,
        },
      };
      expect(skill.inputSchema.safeParse(inputTooLow).success).toBe(false);

      const inputTooHigh = {
        goal: "clear_backlog",
        timeAvailable: {
          dailyMinutes: 200, // Above maximum
          daysPerWeek: 5,
        },
        preferences: {
          prioritizeBy: "date",
          includeReview: false,
          groupByTopic: false,
        },
      };
      expect(skill.inputSchema.safeParse(inputTooHigh).success).toBe(false);
    });

    it("should accept scope options", () => {
      const input = {
        goal: "learn_topic",
        topic: "React",
        timeAvailable: {
          dailyMinutes: 30,
          daysPerWeek: 5,
          totalWeeks: 4,
        },
        preferences: {
          prioritizeBy: "topic",
          includeReview: true,
          groupByTopic: true,
        },
        scope: {
          folderId: 1,
          tags: ["React", "前端"],
          unreadOnly: true,
        },
      };
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });
});
