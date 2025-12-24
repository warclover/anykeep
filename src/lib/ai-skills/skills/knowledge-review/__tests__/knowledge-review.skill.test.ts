/**
 * KnowledgeReviewSkill 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import {
  KnowledgeReviewSkill,
  knowledgeReviewSkill,
} from "../knowledge-review.skill";
import type { OrchestrationContext } from "../../../orchestration/types";
import { EBBINGHAUS_INTERVALS } from "../types";
import type { ReviewGroup } from "../types";

// Mock Supabase client
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          is: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => ({
                  gte: jest.fn(() =>
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
    })),
  })),
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

describe("KnowledgeReviewSkill", () => {
  let skill: KnowledgeReviewSkill;

  beforeEach(() => {
    skill = new KnowledgeReviewSkill();
  });

  describe("metadata", () => {
    it("should have correct metadata", () => {
      expect(skill.metadata.id).toBe("knowledge_review");
      expect(skill.metadata.name).toBe("知识复习助手");
      expect(skill.metadata.category).toBe("understanding");
      expect(skill.metadata.deliverableTypes).toContain("report");
      expect(skill.metadata.deliverableTypes).toContain("list");
    });

    it("should have valid steps definition", () => {
      expect(skill.metadata.steps).toBeDefined();
      expect(skill.metadata.steps!.length).toBe(5);
      expect(skill.metadata.steps![0].id).toBe("analyze");
      expect(skill.metadata.steps![4].id).toBe("deliver");
    });

    it("should have required capabilities", () => {
      expect(skill.metadata.capabilities).toContain("ebbinghaus-analysis");
      expect(skill.metadata.capabilities).toContain("priority-ranking");
      expect(skill.metadata.capabilities).toContain("grouped-review");
    });
  });

  describe("parseInput", () => {
    const mockContext: OrchestrationContext = {
      userId: "test-user",
      params: null,
    };

    it("should parse time range from message", async () => {
      const weekResult = await skill.parseInput(
        "复习最近一周的内容",
        mockContext,
      );
      expect(weekResult.timeRange).toBe("week");

      const quarterResult = await skill.parseInput(
        "复习最近三个月",
        mockContext,
      );
      expect(quarterResult.timeRange).toBe("quarter");

      const allResult = await skill.parseInput("复习全部收藏", mockContext);
      expect(allResult.timeRange).toBe("all");

      const defaultResult = await skill.parseInput("复习一下", mockContext);
      expect(defaultResult.timeRange).toBe("month"); // default
    });

    it("should parse review mode from message", async () => {
      const sequentialResult = await skill.parseInput(
        "按时间顺序复习",
        mockContext,
      );
      expect(sequentialResult.mode).toBe("sequential");

      const randomResult = await skill.parseInput("随机复习一些", mockContext);
      expect(randomResult.mode).toBe("random");

      const defaultResult = await skill.parseInput("复习一下", mockContext);
      expect(defaultResult.mode).toBe("spaced"); // default
    });

    it("should parse limit from message", async () => {
      const result1 = await skill.parseInput("复习20条内容", mockContext);
      expect(result1.limit).toBe(20);

      const result2 = await skill.parseInput("复习10个书签", mockContext);
      expect(result2.limit).toBe(10);

      const defaultResult = await skill.parseInput("复习一下", mockContext);
      expect(defaultResult.limit).toBe(30); // default
    });

    it("should clamp limit to valid range", async () => {
      const result1 = await skill.parseInput("复习3条", mockContext);
      expect(result1.limit).toBe(5); // min is 5

      const result2 = await skill.parseInput("复习200条", mockContext);
      expect(result2.limit).toBe(100); // max is 100
    });

    it("should set includeReviewed to false by default", async () => {
      const result = await skill.parseInput("复习一下", mockContext);
      expect(result.includeReviewed).toBe(false);
    });
  });

  describe("singleton instance", () => {
    it("should export a singleton instance", () => {
      expect(knowledgeReviewSkill).toBeInstanceOf(KnowledgeReviewSkill);
      expect(knowledgeReviewSkill.metadata.id).toBe("knowledge_review");
    });
  });
});

describe("EBBINGHAUS_INTERVALS", () => {
  it("should have correct intervals", () => {
    expect(EBBINGHAUS_INTERVALS).toEqual([1, 3, 7, 14, 30, 60]);
  });

  it("should be in ascending order", () => {
    const sorted = [...EBBINGHAUS_INTERVALS].sort((a, b) => a - b);
    expect(EBBINGHAUS_INTERVALS).toEqual(sorted);
  });
});

describe("KnowledgeReviewSkill - Private Methods (via internal testing)", () => {
  /**
   * 测试内部逻辑通过创建测试子类暴露私有方法
   */
  class TestableKnowledgeReviewSkill extends KnowledgeReviewSkill {
    // 暴露私有方法用于测试
    public testCalculatePriority(
      daysSinceCreated: number,
      nextInterval: number,
    ) {
      return this["calculatePriority"](daysSinceCreated, nextInterval);
    }

    public testGenerateReviewReason(
      daysSinceCreated: number,
      nextInterval: number,
      priority: "high" | "medium" | "low",
    ) {
      return this["generateReviewReason"](
        daysSinceCreated,
        nextInterval,
        priority,
      );
    }

    public testGetPriorityEmoji(priority: "high" | "medium" | "low") {
      return this["getPriorityEmoji"](priority);
    }

    public testGroupByPriority(
      items: Array<{
        id: number;
        title: string;
        url: string;
        aiSummary: string | null;
        tags: string[];
        platform: string;
        folderName: string | null;
        createdAt: string;
        daysSinceCreated: number;
        priority: "high" | "medium" | "low";
        reviewReason: string;
        nextInterval: number;
      }>,
      mode: "spaced" | "sequential" | "random",
    ) {
      return this["groupByPriority"](items, mode);
    }

    public testCalculateStats(
      allBookmarks: Array<{
        id: number;
        title: string;
        url: string;
        ai_summary: string | null;
        ai_tags: string[] | null;
        user_tags: string[] | null;
        platform: string;
        folder_id: number | null;
        created_at: string;
      }>,
      reviewItems: Array<{
        id: number;
        title: string;
        url: string;
        aiSummary: string | null;
        tags: string[];
        platform: string;
        folderName: string | null;
        createdAt: string;
        daysSinceCreated: number;
        priority: "high" | "medium" | "low";
        reviewReason: string;
        nextInterval: number;
      }>,
    ) {
      return this["calculateStats"](allBookmarks, reviewItems);
    }

    public testGenerateSuggestions(
      stats: {
        totalBookmarks: number;
        needsReviewCount: number;
        todayCount: number;
        weekCount: number;
        byPriority: { high: number; medium: number; low: number };
        byPlatform: Record<string, number>;
        avgReviewInterval: number;
      },
      groups: ReviewGroup[],
    ) {
      return this["generateSuggestions"](stats, groups);
    }
  }

  let skill: TestableKnowledgeReviewSkill;

  beforeEach(() => {
    skill = new TestableKnowledgeReviewSkill();
  });

  describe("calculatePriority", () => {
    it("should return high priority when urgency >= 0.9", () => {
      // daysSinceCreated = 9, nextInterval = 10 → urgency = 0.9
      expect(skill.testCalculatePriority(9, 10)).toBe("high");
      // daysSinceCreated = 10, nextInterval = 10 → urgency = 1.0
      expect(skill.testCalculatePriority(10, 10)).toBe("high");
      // daysSinceCreated = 15, nextInterval = 10 → urgency = 1.5
      expect(skill.testCalculatePriority(15, 10)).toBe("high");
    });

    it("should return medium priority when 0.6 <= urgency < 0.9", () => {
      // daysSinceCreated = 6, nextInterval = 10 → urgency = 0.6
      expect(skill.testCalculatePriority(6, 10)).toBe("medium");
      // daysSinceCreated = 8, nextInterval = 10 → urgency = 0.8
      expect(skill.testCalculatePriority(8, 10)).toBe("medium");
    });

    it("should return low priority when urgency < 0.6", () => {
      // daysSinceCreated = 5, nextInterval = 10 → urgency = 0.5
      expect(skill.testCalculatePriority(5, 10)).toBe("low");
      // daysSinceCreated = 1, nextInterval = 7 → urgency ≈ 0.14
      expect(skill.testCalculatePriority(1, 7)).toBe("low");
    });
  });

  describe("generateReviewReason", () => {
    it("should generate reason for high priority (overdue)", () => {
      const reason = skill.testGenerateReviewReason(15, 14, "high");
      expect(reason).toContain("超过");
      expect(reason).toContain("14");
      expect(reason).toContain("建议立即复习");
    });

    it("should generate reason for high priority (near deadline)", () => {
      const reason = skill.testGenerateReviewReason(12, 14, "high");
      expect(reason).toContain("复习点");
      expect(reason).toContain("2");
    });

    it("should generate reason for medium priority", () => {
      const reason = skill.testGenerateReviewReason(10, 14, "medium");
      expect(reason).toContain("10");
      expect(reason).toContain("即将进入");
    });

    it("should generate reason for low priority", () => {
      const reason = skill.testGenerateReviewReason(2, 7, "low");
      expect(reason).toContain("2");
      expect(reason).toContain("适当巩固");
    });
  });

  describe("getPriorityEmoji", () => {
    it("should return correct emoji for each priority", () => {
      expect(skill.testGetPriorityEmoji("high")).toBe("🔴");
      expect(skill.testGetPriorityEmoji("medium")).toBe("🟡");
      expect(skill.testGetPriorityEmoji("low")).toBe("🟢");
    });
  });

  describe("groupByPriority", () => {
    const createMockItem = (
      id: number,
      priority: "high" | "medium" | "low",
      daysAgo: number,
    ) => ({
      id,
      title: `Bookmark ${id}`,
      url: `https://example.com/${id}`,
      aiSummary: null,
      tags: [],
      platform: "web",
      folderName: null,
      createdAt: new Date(
        Date.now() - daysAgo * 24 * 60 * 60 * 1000,
      ).toISOString(),
      daysSinceCreated: daysAgo,
      priority,
      reviewReason: "test",
      nextInterval: 7,
    });

    it("should group items by priority", () => {
      const items = [
        createMockItem(1, "high", 10),
        createMockItem(2, "medium", 5),
        createMockItem(3, "low", 2),
        createMockItem(4, "high", 8),
      ];

      const groups = skill.testGroupByPriority(items, "spaced");

      expect(groups.length).toBe(3);
      expect(groups[0].priority).toBe("high");
      expect(groups[0].items.length).toBe(2);
      expect(groups[1].priority).toBe("medium");
      expect(groups[1].items.length).toBe(1);
      expect(groups[2].priority).toBe("low");
      expect(groups[2].items.length).toBe(1);
    });

    it("should omit empty groups", () => {
      const items = [
        createMockItem(1, "high", 10),
        createMockItem(2, "high", 8),
      ];

      const groups = skill.testGroupByPriority(items, "spaced");

      expect(groups.length).toBe(1);
      expect(groups[0].priority).toBe("high");
    });

    it("should have correct group names and descriptions", () => {
      const items = [
        createMockItem(1, "high", 10),
        createMockItem(2, "medium", 5),
        createMockItem(3, "low", 2),
      ];

      const groups = skill.testGroupByPriority(items, "spaced");

      expect(groups[0].name).toContain("紧急");
      expect(groups[0].suggestedTime).toBe("今天");

      expect(groups[1].name).toContain("本周");
      expect(groups[1].suggestedTime).toBe("本周内");

      expect(groups[2].name).toContain("巩固");
      expect(groups[2].suggestedTime).toBe("有空时");
    });
  });

  describe("calculateStats", () => {
    it("should calculate stats correctly", () => {
      const allBookmarks = [
        {
          id: 1,
          title: "Bookmark 1",
          url: "https://example.com/1",
          ai_summary: null,
          ai_tags: ["tag1"],
          user_tags: [],
          platform: "web",
          folder_id: null,
          created_at: new Date().toISOString(),
        },
        {
          id: 2,
          title: "Bookmark 2",
          url: "https://example.com/2",
          ai_summary: null,
          ai_tags: [],
          user_tags: ["tag2"],
          platform: "wechat",
          folder_id: null,
          created_at: new Date().toISOString(),
        },
      ];

      const reviewItems = [
        {
          id: 1,
          title: "Bookmark 1",
          url: "https://example.com/1",
          aiSummary: null,
          tags: ["tag1"],
          platform: "web",
          folderName: null,
          createdAt: new Date().toISOString(),
          daysSinceCreated: 10,
          priority: "high" as const,
          reviewReason: "test",
          nextInterval: 14,
        },
        {
          id: 2,
          title: "Bookmark 2",
          url: "https://example.com/2",
          aiSummary: null,
          tags: ["tag2"],
          platform: "wechat",
          folderName: null,
          createdAt: new Date().toISOString(),
          daysSinceCreated: 5,
          priority: "medium" as const,
          reviewReason: "test",
          nextInterval: 7,
        },
      ];

      const stats = skill.testCalculateStats(allBookmarks, reviewItems);

      expect(stats.totalBookmarks).toBe(2);
      expect(stats.needsReviewCount).toBe(2);
      expect(stats.todayCount).toBe(1); // high priority
      expect(stats.weekCount).toBe(2); // high + medium
      expect(stats.byPriority.high).toBe(1);
      expect(stats.byPriority.medium).toBe(1);
      expect(stats.byPriority.low).toBe(0);
      expect(stats.byPlatform["web"]).toBe(1);
      expect(stats.byPlatform["wechat"]).toBe(1);
      expect(stats.avgReviewInterval).toBe(11); // (14 + 7) / 2 = 10.5 → 11
    });

    it("should handle empty review items", () => {
      const stats = skill.testCalculateStats([], []);

      expect(stats.totalBookmarks).toBe(0);
      expect(stats.needsReviewCount).toBe(0);
      expect(stats.avgReviewInterval).toBe(0);
    });
  });

  describe("generateSuggestions", () => {
    it("should suggest today review for high priority items", () => {
      const stats = {
        totalBookmarks: 10,
        needsReviewCount: 5,
        todayCount: 3,
        weekCount: 5,
        byPriority: { high: 3, medium: 2, low: 0 },
        byPlatform: { web: 5 },
        avgReviewInterval: 10,
      };

      const suggestions = skill.testGenerateSuggestions(stats, []);

      expect(
        suggestions.some((s) => s.includes("今天") && s.includes("3")),
      ).toBe(true);
    });

    it("should suggest batch review when too many items", () => {
      const stats = {
        totalBookmarks: 100,
        needsReviewCount: 50,
        todayCount: 15,
        weekCount: 30,
        byPriority: { high: 15, medium: 15, low: 20 },
        byPlatform: { web: 50 },
        avgReviewInterval: 10,
      };

      const suggestions = skill.testGenerateSuggestions(stats, []);

      expect(
        suggestions.some((s) => s.includes("分批") || s.includes("每次")),
      ).toBe(true);
    });

    it("should suggest platform-based review for multi-platform", () => {
      const stats = {
        totalBookmarks: 10,
        needsReviewCount: 5,
        todayCount: 0,
        weekCount: 5,
        byPriority: { high: 0, medium: 5, low: 0 },
        byPlatform: { web: 2, wechat: 2, bilibili: 1 },
        avgReviewInterval: 10,
      };

      const suggestions = skill.testGenerateSuggestions(stats, []);

      expect(suggestions.some((s) => s.includes("平台"))).toBe(true);
    });

    it("should always include recall tip", () => {
      const stats = {
        totalBookmarks: 1,
        needsReviewCount: 1,
        todayCount: 0,
        weekCount: 1,
        byPriority: { high: 0, medium: 1, low: 0 },
        byPlatform: { web: 1 },
        avgReviewInterval: 10,
      };

      const suggestions = skill.testGenerateSuggestions(stats, []);

      expect(
        suggestions.some((s) => s.includes("回忆") || s.includes("要点")),
      ).toBe(true);
    });

    it("should suggest more frequent collection for high avg interval", () => {
      const stats = {
        totalBookmarks: 10,
        needsReviewCount: 5,
        todayCount: 0,
        weekCount: 5,
        byPriority: { high: 0, medium: 5, low: 0 },
        byPlatform: { web: 5 },
        avgReviewInterval: 20, // > 14
      };

      const suggestions = skill.testGenerateSuggestions(stats, []);

      expect(
        suggestions.some((s) => s.includes("频繁") || s.includes("新鲜")),
      ).toBe(true);
    });
  });
});
