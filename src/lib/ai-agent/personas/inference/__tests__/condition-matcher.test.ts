/**
 * 条件匹配器单元测试
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import { ConditionMatcher } from "../condition-matcher";
import type {
  UserBehaviorData,
  TagMatchCondition,
  PlatformMatchCondition,
  DomainMatchCondition,
  FrequencyCheckCondition,
  TimePatternCondition,
  CompositeCondition,
} from "../types";

describe("ConditionMatcher", () => {
  let matcher: ConditionMatcher;
  let baseBehaviorData: UserBehaviorData;

  beforeEach(() => {
    matcher = new ConditionMatcher();
    baseBehaviorData = {
      tags: ["竞品分析", "PRD", "用户反馈", "产品规划"],
      tagCounts: { 竞品分析: 5, PRD: 3, 用户反馈: 2, 产品规划: 1 },
      platforms: ["即刻", "人人都是产品经理", "知乎"],
      platformCounts: { 即刻: 10, 人人都是产品经理: 8, 知乎: 5 },
      contentTypes: ["文章", "研报", "案例"],
      contentTypeCounts: { 文章: 15, 研报: 5, 案例: 3 },
      folders: ["竞品", "需求", "产品"],
      folderCounts: { 竞品: 10, 需求: 8, 产品: 5 },
      domains: ["woshipm.com", "36kr.com", "jike.info"],
      domainCounts: { "woshipm.com": 10, "36kr.com": 5, "jike.info": 3 },
      timePatterns: {
        hourDistribution: Array(24)
          .fill(0)
          .map((_, i) => (i >= 9 && i <= 18 ? 5 : 1)),
        weekdayDistribution: [10, 12, 11, 10, 9, 3, 2],
      },
      activityMetrics: {
        totalBookmarks: 100,
        recentWeekCount: 15,
        recentMonthCount: 45,
        avgDailyCount: 2.5,
      },
    };
  });

  describe("matchTagCondition", () => {
    it("should match when any tag matches pattern", () => {
      const condition: TagMatchCondition = {
        type: "tag_match",
        patterns: [/竞品|竞对/],
        operator: "any",
        minMatchCount: 1,
      };

      const result = matcher.match(condition, baseBehaviorData);

      expect(result.matched).toBe(true);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.matchedItems).toContain("竞品分析");
    });

    it("should not match when no tags match", () => {
      const condition: TagMatchCondition = {
        type: "tag_match",
        patterns: [/财报|研报/],
        operator: "any",
        minMatchCount: 1,
      };

      const result = matcher.match(condition, baseBehaviorData);

      expect(result.matched).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it("should require all patterns to match with 'all' operator", () => {
      const condition: TagMatchCondition = {
        type: "tag_match",
        patterns: [/竞品/, /PRD/],
        operator: "all",
      };

      const result = matcher.match(condition, baseBehaviorData);

      expect(result.matched).toBe(true);
      expect(result.matchedItems?.length).toBeGreaterThanOrEqual(2);
    });

    it("should apply weight to confidence", () => {
      const condition: TagMatchCondition = {
        type: "tag_match",
        patterns: [/竞品/],
        operator: "any",
        weight: 0.5,
      };

      const result = matcher.match(condition, baseBehaviorData);

      expect(result.matched).toBe(true);
      expect(result.confidence).toBeLessThanOrEqual(0.5);
    });
  });

  describe("matchPlatformCondition", () => {
    it("should match when any platform matches", () => {
      const condition: PlatformMatchCondition = {
        type: "platform_match",
        platforms: ["即刻", "ProductHunt"],
        operator: "any",
      };

      const result = matcher.match(condition, baseBehaviorData);

      expect(result.matched).toBe(true);
      expect(result.matchedItems).toContain("即刻");
    });

    it("should check primary platform ratio", () => {
      const condition: PlatformMatchCondition = {
        type: "platform_match",
        platforms: ["即刻"],
        operator: "primary",
        minRatio: 0.3,
      };

      const result = matcher.match(condition, baseBehaviorData);

      // 即刻 10/(10+8+5) = 10/23 ≈ 0.43 > 0.3
      expect(result.matched).toBe(true);
    });
  });

  describe("matchDomainCondition", () => {
    it("should match domains with regex patterns", () => {
      const condition: DomainMatchCondition = {
        type: "domain_match",
        patterns: [/woshipm\.com/, /36kr\.com/],
        operator: "any",
        minMatchCount: 1,
      };

      const result = matcher.match(condition, baseBehaviorData);

      expect(result.matched).toBe(true);
      expect(result.matchedItems?.length).toBeGreaterThanOrEqual(1);
    });

    it("should require minimum match count", () => {
      const condition: DomainMatchCondition = {
        type: "domain_match",
        patterns: [/woshipm\.com/, /36kr\.com/, /huxiu\.com/],
        operator: "any",
        minMatchCount: 3,
      };

      const result = matcher.match(condition, baseBehaviorData);

      // 只匹配了 2 个，需要 3 个
      expect(result.matched).toBe(false);
    });
  });

  describe("matchFrequencyCondition", () => {
    it("should check daily frequency", () => {
      const condition: FrequencyCheckCondition = {
        type: "frequency_check",
        metric: "daily",
        operator: "greater_than",
        value: 2,
      };

      const result = matcher.match(condition, baseBehaviorData);

      // avgDailyCount = 2.5 > 2
      expect(result.matched).toBe(true);
    });

    it("should check total bookmarks", () => {
      const condition: FrequencyCheckCondition = {
        type: "frequency_check",
        metric: "total",
        operator: "greater_than",
        value: 50,
      };

      const result = matcher.match(condition, baseBehaviorData);

      // totalBookmarks = 100 > 50
      expect(result.matched).toBe(true);
    });

    it("should handle between operator", () => {
      const condition: FrequencyCheckCondition = {
        type: "frequency_check",
        metric: "weekly",
        operator: "between",
        value: 10,
        compareValue: 20,
      };

      const result = matcher.match(condition, baseBehaviorData);

      // recentWeekCount = 15, 10 <= 15 <= 20
      expect(result.matched).toBe(true);
    });
  });

  describe("matchTimePatternCondition", () => {
    it("should detect weekday activity pattern", () => {
      const condition: TimePatternCondition = {
        type: "time_pattern",
        pattern: "weekday",
        minRatio: 0.7,
      };

      const result = matcher.match(condition, baseBehaviorData);

      // weekday = 10+12+11+10+9 = 52, total = 52+3+2 = 57, ratio ≈ 0.91
      expect(result.matched).toBe(true);
    });

    it("should detect afternoon activity", () => {
      const condition: TimePatternCondition = {
        type: "time_pattern",
        pattern: "afternoon",
        minRatio: 0.2,
      };

      const result = matcher.match(condition, baseBehaviorData);

      // 12-18 时段有较高活动
      expect(result.matched).toBe(true);
    });
  });

  describe("matchCompositeCondition", () => {
    it("should handle AND logic", () => {
      const condition: CompositeCondition = {
        type: "composite",
        logic: "and",
        conditions: [
          {
            type: "tag_match",
            patterns: [/竞品/],
            operator: "any",
          },
          {
            type: "platform_match",
            platforms: ["即刻"],
            operator: "any",
          },
        ],
      };

      const result = matcher.match(condition, baseBehaviorData);

      expect(result.matched).toBe(true);
    });

    it("should handle OR logic", () => {
      const condition: CompositeCondition = {
        type: "composite",
        logic: "or",
        conditions: [
          {
            type: "tag_match",
            patterns: [/不存在的标签/],
            operator: "any",
          },
          {
            type: "platform_match",
            platforms: ["即刻"],
            operator: "any",
          },
        ],
      };

      const result = matcher.match(condition, baseBehaviorData);

      // 只要一个匹配即可
      expect(result.matched).toBe(true);
    });

    it("should handle NOT logic", () => {
      const condition: CompositeCondition = {
        type: "composite",
        logic: "not",
        conditions: [
          {
            type: "tag_match",
            patterns: [/不存在的标签/],
            operator: "any",
          },
        ],
      };

      const result = matcher.match(condition, baseBehaviorData);

      // 没有匹配 = NOT 成立
      expect(result.matched).toBe(true);
    });
  });
});
