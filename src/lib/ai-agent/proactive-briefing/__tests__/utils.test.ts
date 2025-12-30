/**
 * 主动简报工具函数单元测试
 *
 * @since 2025-12-30
 */

import {
  calculateDaysSinceLastVisit,
  calculateOfflineDuration,
  formatOfflineDuration,
  generateInsightId,
  generateActionId,
  calculateTopicDistribution,
  getEmergingTopics,
  isValidUserId,
  generateSimpleSummary,
} from "../utils";
import { TIME_CONSTANTS } from "../constants";

// =============================================================================
// 时间工具函数测试
// =============================================================================

describe("calculateDaysSinceLastVisit", () => {
  it("should return 0 for visits within the same day", () => {
    const now = new Date();
    const halfDayAgo = new Date(
      now.getTime() - TIME_CONSTANTS.ONE_DAY_MS * 0.5,
    );
    expect(calculateDaysSinceLastVisit(halfDayAgo)).toBe(0);
  });

  it("should return correct days for multi-day absence", () => {
    const now = new Date();
    const threeDaysAgo = new Date(
      now.getTime() - TIME_CONSTANTS.ONE_DAY_MS * 3.5,
    );
    expect(calculateDaysSinceLastVisit(threeDaysAgo)).toBe(3);
  });

  it("should return exact days for whole day absence", () => {
    const now = new Date();
    const sevenDaysAgo = new Date(
      now.getTime() - TIME_CONSTANTS.ONE_DAY_MS * 7,
    );
    expect(calculateDaysSinceLastVisit(sevenDaysAgo)).toBe(7);
  });

  it("should handle edge case with very recent visit", () => {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    expect(calculateDaysSinceLastVisit(fiveMinutesAgo)).toBe(0);
  });
});

describe("calculateOfflineDuration", () => {
  it("should return positive duration for past visit", () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - TIME_CONSTANTS.ONE_HOUR_MS);
    const duration = calculateOfflineDuration(oneHourAgo);
    // Allow 100ms tolerance for test execution time
    expect(duration).toBeGreaterThanOrEqual(TIME_CONSTANTS.ONE_HOUR_MS - 100);
    expect(duration).toBeLessThanOrEqual(TIME_CONSTANTS.ONE_HOUR_MS + 100);
  });

  it("should return correct duration in milliseconds", () => {
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - TIME_CONSTANTS.ONE_DAY_MS * 2);
    const duration = calculateOfflineDuration(twoDaysAgo);
    const expectedMs = TIME_CONSTANTS.ONE_DAY_MS * 2;
    expect(duration).toBeGreaterThanOrEqual(expectedMs - 100);
    expect(duration).toBeLessThanOrEqual(expectedMs + 100);
  });
});

describe("formatOfflineDuration", () => {
  it('should format days correctly with "天"', () => {
    const threeDays = TIME_CONSTANTS.ONE_DAY_MS * 3;
    expect(formatOfflineDuration(threeDays)).toBe("3 天");
  });

  it('should format hours correctly with "小时"', () => {
    const fiveHours = TIME_CONSTANTS.ONE_HOUR_MS * 5;
    expect(formatOfflineDuration(fiveHours)).toBe("5 小时");
  });

  it('should format minutes correctly with "分钟"', () => {
    const thirtyMinutes = 30 * 60 * 1000;
    expect(formatOfflineDuration(thirtyMinutes)).toBe("30 分钟");
  });

  it("should prioritize days over hours", () => {
    const oneDayFiveHours =
      TIME_CONSTANTS.ONE_DAY_MS + TIME_CONSTANTS.ONE_HOUR_MS * 5;
    expect(formatOfflineDuration(oneDayFiveHours)).toBe("1 天");
  });

  it("should prioritize hours over minutes", () => {
    const twoHoursThirtyMinutes = TIME_CONSTANTS.ONE_HOUR_MS * 2.5;
    expect(formatOfflineDuration(twoHoursThirtyMinutes)).toBe("2 小时");
  });

  it("should handle zero duration", () => {
    expect(formatOfflineDuration(0)).toBe("0 分钟");
  });
});

// =============================================================================
// ID 生成工具测试
// =============================================================================

describe("generateInsightId", () => {
  it("should generate unique IDs", () => {
    const id1 = generateInsightId("topic_emergence");
    const id2 = generateInsightId("topic_emergence");
    expect(id1).not.toBe(id2);
  });

  it("should include type in the ID", () => {
    const id = generateInsightId("pattern_detected");
    expect(id).toContain("insight_pattern_detected_");
  });

  it("should have proper format with timestamp", () => {
    const id = generateInsightId("recommendation");
    const parts = id.split("_");
    expect(parts.length).toBeGreaterThanOrEqual(3);
    expect(parts[0]).toBe("insight");
    expect(parts[1]).toBe("recommendation");
  });
});

describe("generateActionId", () => {
  it("should generate unique IDs", () => {
    const id1 = generateActionId("organize_topic");
    const id2 = generateActionId("organize_topic");
    expect(id1).not.toBe(id2);
  });

  it("should include type in the ID", () => {
    const id = generateActionId("tag_untagged");
    expect(id).toContain("action_tag_untagged_");
  });

  it("should have proper format with timestamp", () => {
    const id = generateActionId("review_unread");
    const parts = id.split("_");
    expect(parts.length).toBeGreaterThanOrEqual(3);
    expect(parts[0]).toBe("action");
  });
});

// =============================================================================
// 数据转换工具测试
// =============================================================================

describe("calculateTopicDistribution", () => {
  it("should count tags correctly", () => {
    const bookmarks = [
      { tags: ["React", "TypeScript"] },
      { tags: ["React", "Next.js"] },
      { tags: ["React"] },
    ];

    const distribution = calculateTopicDistribution(bookmarks);

    expect(distribution.find((t) => t.tag === "React")?.count).toBe(3);
    expect(distribution.find((t) => t.tag === "TypeScript")?.count).toBe(1);
    expect(distribution.find((t) => t.tag === "Next.js")?.count).toBe(1);
  });

  it("should sort by count in descending order", () => {
    const bookmarks = [
      { tags: ["A"] },
      { tags: ["B", "B"] }, // B appears in one bookmark
      { tags: ["C"] },
      { tags: ["A"] },
      { tags: ["A"] },
    ];

    const distribution = calculateTopicDistribution(bookmarks);

    expect(distribution[0].tag).toBe("A");
    expect(distribution[0].count).toBe(3);
  });

  it("should handle null tags gracefully", () => {
    const bookmarks = [
      { tags: null },
      { tags: ["React"] },
      { tags: undefined as unknown as string[] | null },
    ];

    const distribution = calculateTopicDistribution(bookmarks);

    expect(distribution.length).toBe(1);
    expect(distribution[0].tag).toBe("React");
  });

  it("should handle empty bookmarks array", () => {
    const distribution = calculateTopicDistribution([]);
    expect(distribution).toEqual([]);
  });

  it("should handle empty tags arrays", () => {
    const bookmarks = [{ tags: [] }, { tags: [] }];
    const distribution = calculateTopicDistribution(bookmarks);
    expect(distribution).toEqual([]);
  });
});

describe("getEmergingTopics", () => {
  it("should return topics above threshold", () => {
    const distribution = [
      { tag: "React", count: 5 },
      { tag: "Vue", count: 3 },
      { tag: "Angular", count: 2 },
    ];

    const emerging = getEmergingTopics(distribution, 3);

    expect(emerging).toContain("React");
    expect(emerging).toContain("Vue");
    expect(emerging).not.toContain("Angular");
  });

  it("should limit to 5 topics", () => {
    const distribution = [
      { tag: "A", count: 10 },
      { tag: "B", count: 9 },
      { tag: "C", count: 8 },
      { tag: "D", count: 7 },
      { tag: "E", count: 6 },
      { tag: "F", count: 5 },
      { tag: "G", count: 4 },
    ];

    const emerging = getEmergingTopics(distribution, 1);

    expect(emerging.length).toBe(5);
    expect(emerging).not.toContain("F");
    expect(emerging).not.toContain("G");
  });

  it("should use default threshold of 3", () => {
    const distribution = [
      { tag: "High", count: 5 },
      { tag: "Low", count: 2 },
    ];

    const emerging = getEmergingTopics(distribution);

    expect(emerging).toContain("High");
    expect(emerging).not.toContain("Low");
  });

  it("should handle empty distribution", () => {
    const emerging = getEmergingTopics([]);
    expect(emerging).toEqual([]);
  });
});

// =============================================================================
// 验证工具测试
// =============================================================================

describe("isValidUserId", () => {
  it("should accept valid UUID v4", () => {
    expect(isValidUserId("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isValidUserId("6ba7b810-9dad-41d1-80b4-00c04fd430c8")).toBe(true);
  });

  it("should reject invalid UUIDs", () => {
    expect(isValidUserId("not-a-uuid")).toBe(false);
    expect(isValidUserId("550e8400-e29b-31d4-a716-446655440000")).toBe(false); // v3 not v4
    expect(isValidUserId("")).toBe(false);
    expect(isValidUserId("123")).toBe(false);
  });

  it("should be case insensitive", () => {
    expect(isValidUserId("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
    expect(isValidUserId("550e8400-E29B-41d4-A716-446655440000")).toBe(true);
  });
});

// =============================================================================
// 摘要生成工具测试
// =============================================================================

describe("generateSimpleSummary", () => {
  it("should generate summary for zero new items", () => {
    const summary = generateSimpleSummary(0, 3, []);
    expect(summary).toBe("在你离开的 3 天里，没有新增收藏。");
  });

  it("should include count and days", () => {
    const summary = generateSimpleSummary(10, 5, []);
    expect(summary).toContain("10");
    expect(summary).toContain("5 天");
    expect(summary).toContain("新增了");
  });

  it("should include top topics when available", () => {
    const summary = generateSimpleSummary(10, 5, [
      "React",
      "TypeScript",
      "Next.js",
    ]);
    expect(summary).toContain("React");
    expect(summary).toContain("TypeScript");
    expect(summary).toContain("Next.js");
  });

  it("should limit topics to 3", () => {
    const summary = generateSimpleSummary(10, 5, ["A", "B", "C", "D", "E"]);
    expect(summary).toContain("A");
    expect(summary).toContain("B");
    expect(summary).toContain("C");
    expect(summary).not.toContain("D");
    expect(summary).not.toContain("E");
  });

  it("should use Chinese comma for topics", () => {
    const summary = generateSimpleSummary(10, 5, ["React", "Vue"]);
    expect(summary).toContain("React、Vue");
  });
});
