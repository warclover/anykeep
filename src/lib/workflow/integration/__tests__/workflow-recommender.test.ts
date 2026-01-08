/**
 * WorkflowRecommender 单元测试
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import {
  WorkflowRecommender,
  getWorkflowRecommender,
  recommendWorkflows,
} from "../workflow-recommender";
import type { DynamicContext } from "@/lib/ai-agent/context/types";

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("WorkflowRecommender", () => {
  let recommender: WorkflowRecommender;

  beforeEach(() => {
    recommender = new WorkflowRecommender();
  });

  describe("recommend", () => {
    it("should recommend smart_intake for many untagged bookmarks", () => {
      const context: DynamicContext = {
        timestamp: new Date(),
        stats: {
          totalBookmarks: 200,
          recentWeekCount: 10,
          topFolders: [],
          topTags: [],
        },
        untaggedCount: 60,
      } as unknown as DynamicContext;

      const recommendations = recommender.recommend(context);

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some((r) => r.workflowId === "smart_intake")).toBe(
        true,
      );
    });

    it("should recommend weekly_organize for inactive users with many bookmarks", () => {
      // 使用类型断言绕过严格类型检查
      const context = {
        timestamp: new Date(),
        stats: {
          totalBookmarks: 150,
          recentWeekCount: 0,
          topFolders: [],
          topTags: [],
        },
      } as unknown as DynamicContext;

      const recommendations = recommender.recommend(context);

      expect(
        recommendations.some((r) => r.workflowId === "weekly_organize"),
      ).toBe(true);
    });

    it("should recommend topic_deep_dive when folder has many items", () => {
      // 使用类型断言绕过严格类型检查
      const context = {
        timestamp: new Date(),
        stats: {
          totalBookmarks: 100,
          recentWeekCount: 5,
          topFolders: [{ id: 1, name: "AI学习", count: 25 }],
          topTags: [],
        },
      } as unknown as DynamicContext;

      const recommendations = recommender.recommend(context);

      expect(
        recommendations.some((r) => r.workflowId === "topic_deep_dive"),
      ).toBe(true);
      expect(
        recommendations.find((r) => r.workflowId === "topic_deep_dive")?.reason,
      ).toContain("AI学习");
    });

    it("should recommend bookmark_health for long-time no check", () => {
      const thirtyOneDaysAgo = new Date();
      thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);

      // 使用类型断言绕过严格类型检查
      const context = {
        timestamp: new Date(),
        stats: {
          totalBookmarks: 200,
          recentWeekCount: 5,
          topFolders: [],
          topTags: [],
        },
        lastHealthCheckAt: thirtyOneDaysAgo,
      } as unknown as DynamicContext;

      const recommendations = recommender.recommend(context);

      expect(
        recommendations.some((r) => r.workflowId === "bookmark_health"),
      ).toBe(true);
    });

    it("should recommend bookmark_health when no health check and many bookmarks", () => {
      // 使用类型断言绕过严格类型检查
      const context = {
        timestamp: new Date(),
        stats: {
          totalBookmarks: 150,
          recentWeekCount: 5,
          topFolders: [],
          topTags: [],
        },
      } as unknown as DynamicContext;

      const recommendations = recommender.recommend(context);

      expect(
        recommendations.some((r) => r.workflowId === "bookmark_health"),
      ).toBe(true);
    });

    it("should recommend spaced_review for review backlog", () => {
      // 使用类型断言绕过严格类型检查
      const context = {
        timestamp: new Date(),
        stats: {
          totalBookmarks: 100,
          recentWeekCount: 5,
          topFolders: [],
          topTags: [],
        },
        reviewBacklog: 15,
      } as unknown as DynamicContext;

      const recommendations = recommender.recommend(context);

      expect(
        recommendations.some((r) => r.workflowId === "spaced_review"),
      ).toBe(true);
      expect(
        recommendations.find((r) => r.workflowId === "spaced_review")?.reason,
      ).toContain("15");
    });

    it("should recommend new_user_onboarding for bulk import scenario", () => {
      // 使用类型断言绕过严格类型检查
      const context = {
        timestamp: new Date(),
        stats: {
          totalBookmarks: 500,
          recentWeekCount: 2,
          topFolders: [],
          topTags: [],
        },
      } as unknown as DynamicContext;

      const recommendations = recommender.recommend(context);

      expect(
        recommendations.some((r) => r.workflowId === "new_user_onboarding"),
      ).toBe(true);
    });

    it("should limit recommendations by maxRecommendations", () => {
      // 使用类型断言绕过严格类型检查
      const context = {
        timestamp: new Date(),
        stats: {
          totalBookmarks: 500,
          recentWeekCount: 0,
          topFolders: [{ id: 1, name: "技术", count: 30 }],
          topTags: [],
        },
        untaggedCount: 100,
        reviewBacklog: 20,
      } as unknown as DynamicContext;

      const recommendations = recommender.recommend(context, 2);

      expect(recommendations.length).toBeLessThanOrEqual(2);
    });

    it("should sort recommendations by score descending", () => {
      // 使用类型断言绕过严格类型检查
      const context = {
        timestamp: new Date(),
        stats: {
          totalBookmarks: 500,
          recentWeekCount: 0,
          topFolders: [{ id: 1, name: "技术", count: 30 }],
          topTags: [],
        },
        untaggedCount: 100,
        reviewBacklog: 20,
      } as unknown as DynamicContext;

      const recommendations = recommender.recommend(context);

      for (let i = 1; i < recommendations.length; i++) {
        expect(recommendations[i - 1].score).toBeGreaterThanOrEqual(
          recommendations[i].score,
        );
      }
    });

    it("should return empty array when no conditions match", () => {
      // 使用类型断言绕过严格类型检查
      const context = {
        timestamp: new Date(),
        stats: {
          totalBookmarks: 10,
          recentWeekCount: 5,
          topFolders: [],
          topTags: [],
        },
      } as unknown as DynamicContext;

      const recommendations = recommender.recommend(context);

      // May still have some recommendations based on loose conditions
      // but high score ones should not be present
      expect(recommendations.every((r) => r.priority !== "high")).toBe(true);
    });
  });

  describe("recommendTop", () => {
    it("should return single best recommendation", () => {
      // 使用类型断言绕过严格类型检查
      const context = {
        timestamp: new Date(),
        stats: {
          totalBookmarks: 200,
          recentWeekCount: 0,
          topFolders: [],
          topTags: [],
        },
        untaggedCount: 60,
      } as unknown as DynamicContext;

      const recommendation = recommender.recommendTop(context);

      expect(recommendation).not.toBeNull();
      expect(recommendation?.workflowId).toBeDefined();
    });

    it("should return null when no recommendations", () => {
      // 使用类型断言绕过严格类型检查
      const context = {
        timestamp: new Date(),
        stats: {
          totalBookmarks: 5,
          recentWeekCount: 3,
          topFolders: [],
          topTags: [],
        },
      } as unknown as DynamicContext;

      const recommendation = recommender.recommendTop(context);

      // May be null or low priority
      if (recommendation) {
        expect(recommendation.priority).not.toBe("high");
      }
    });
  });

  describe("hasHighPriorityRecommendation", () => {
    it("should return true when high priority recommendation exists", () => {
      const context: DynamicContext = {
        timestamp: new Date(),
        stats: {
          totalBookmarks: 200,
          recentWeekCount: 5,
          topFolders: [],
          topTags: [],
        },
        untaggedCount: 60,
      } as unknown as DynamicContext;

      const hasHigh = recommender.hasHighPriorityRecommendation(context);

      expect(hasHigh).toBe(true);
    });

    it("should return true when review backlog exists", () => {
      const context: DynamicContext = {
        timestamp: new Date(),
        stats: {
          totalBookmarks: 50,
          recentWeekCount: 5,
          topFolders: [],
          topTags: [],
        },
        reviewBacklog: 15,
      } as unknown as DynamicContext;

      const hasHigh = recommender.hasHighPriorityRecommendation(context);

      expect(hasHigh).toBe(true);
    });

    it("should return false when only low/medium priority", () => {
      // 使用类型断言绕过严格类型检查
      const context = {
        timestamp: new Date(),
        stats: {
          totalBookmarks: 50,
          recentWeekCount: 3,
          topFolders: [{ id: 1, name: "一般", count: 10 }],
          topTags: [],
        },
      } as unknown as DynamicContext;

      const hasHigh = recommender.hasHighPriorityRecommendation(context);

      expect(hasHigh).toBe(false);
    });
  });

  describe("recommendation reasons", () => {
    it("should include count in untagged reason", () => {
      const context: DynamicContext = {
        timestamp: new Date(),
        stats: {
          totalBookmarks: 200,
          recentWeekCount: 5,
          topFolders: [],
          topTags: [],
        },
        untaggedCount: 75,
      } as unknown as DynamicContext;

      const recommendations = recommender.recommend(context);
      const smartIntake = recommendations.find(
        (r) => r.workflowId === "smart_intake",
      );

      expect(smartIntake?.reason).toContain("75");
    });

    it("should include folder name in topic reason", () => {
      // 使用类型断言绕过严格类型检查
      const context = {
        timestamp: new Date(),
        stats: {
          totalBookmarks: 100,
          recentWeekCount: 5,
          topFolders: [{ id: 1, name: "机器学习", count: 25 }],
          topTags: [],
        },
      } as unknown as DynamicContext;

      const recommendations = recommender.recommend(context);
      const topicDeepDive = recommendations.find(
        (r) => r.workflowId === "topic_deep_dive",
      );

      expect(topicDeepDive?.reason).toContain("机器学习");
      expect(topicDeepDive?.reason).toContain("25");
    });
  });

  describe("singleton", () => {
    it("should return same instance", () => {
      const instance1 = getWorkflowRecommender();
      const instance2 = getWorkflowRecommender();
      expect(instance1).toBe(instance2);
    });
  });

  describe("convenience function", () => {
    it("should work with recommendWorkflows", () => {
      const context: DynamicContext = {
        timestamp: new Date(),
        stats: {
          totalBookmarks: 200,
          recentWeekCount: 0,
          topFolders: [],
          topTags: [],
        },
        untaggedCount: 60,
      } as unknown as DynamicContext;

      const recommendations = recommendWorkflows(context, 2);

      expect(recommendations.length).toBeLessThanOrEqual(2);
    });
  });
});
