/**
 * ProactiveBriefingService 单元测试
 *
 * @since 2025-12-30
 */

import { ProactiveBriefingService } from "../proactive-briefing-service";
import { TIME_CONSTANTS } from "../constants";

// =============================================================================
// Mocks
// =============================================================================

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Feature flags mock variable
let mockProactiveBriefingEnabled = true;

jest.mock("@/lib/ai-agent/config/feature-flags", () => ({
  get FeatureFlags() {
    return {
      ENABLE_PROACTIVE_BRIEFING: mockProactiveBriefingEnabled,
    };
  },
}));

// Supabase mock implementation
const createMockChainableQuery = () => {
  const chain: Record<string, jest.Mock> = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.gte = jest.fn().mockReturnValue(chain);
  chain.or = jest.fn().mockReturnValue(chain);
  chain.order = jest.fn().mockReturnValue(chain);
  chain.range = jest.fn().mockReturnValue(chain);
  chain.in = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn().mockResolvedValue({ data: null, error: null });
  chain.update = jest.fn().mockReturnValue(chain);
  chain.upsert = jest.fn().mockResolvedValue({ data: null, error: null });
  return chain;
};

const mockFromFn = jest.fn();
const mockRpcFn = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn().mockResolvedValue({
    from: (...args: unknown[]) => mockFromFn(...args),
    rpc: (...args: unknown[]) => mockRpcFn(...args),
  }),
}));

// =============================================================================
// Test Helpers
// =============================================================================

const TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440000";

function createMockBookmarks(count: number, tags: string[][] = []) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    title: `Bookmark ${i + 1}`,
    platform: i % 2 === 0 ? "WECHAT" : "BILIBILI",
    user_tags: tags[i] || ["React"],
    created_at: new Date().toISOString(),
  }));
}

interface MockQuerySetupOptions {
  lastVisitAt?: string | null;
  newBookmarks?: Array<{
    id: number;
    title: string;
    platform: string;
    user_tags: string[];
    created_at: string;
  }>;
  untaggedCount?: number;
  totalCount?: number;
  insightsData?: Array<Record<string, unknown>>;
}

function setupMockQueries(options: MockQuerySetupOptions = {}) {
  const {
    lastVisitAt = new Date(
      Date.now() - TIME_CONSTANTS.ONE_DAY_MS * 3,
    ).toISOString(),
    newBookmarks = createMockBookmarks(5),
    untaggedCount = 15,
    totalCount = 100,
    insightsData = [],
  } = options;

  mockFromFn.mockReset();
  mockRpcFn.mockReset();

  let bookmarksCallCount = 0;

  mockFromFn.mockImplementation((table: string) => {
    const chain = createMockChainableQuery();

    if (table === "profiles") {
      chain.single = jest.fn().mockResolvedValue({
        data: lastVisitAt ? { last_visit_at: lastVisitAt } : null,
        error: lastVisitAt === null ? null : null,
      });
      return chain;
    }

    if (table === "bookmarks") {
      bookmarksCallCount++;
      if (bookmarksCallCount === 1) {
        // New bookmarks query
        chain.order = jest.fn().mockResolvedValue({
          data: newBookmarks,
          error: null,
        });
      } else if (bookmarksCallCount === 2) {
        // Untagged count query
        chain.or = jest.fn().mockResolvedValue({
          data: null,
          count: untaggedCount,
          error: null,
        });
      } else {
        // Total count query
        chain.eq = jest.fn().mockResolvedValue({
          data: null,
          count: totalCount,
          error: null,
        });
      }
      return chain;
    }

    if (table === "proactive_insights") {
      chain.range = jest.fn().mockResolvedValue({
        data: insightsData,
        count: insightsData.length,
        error: null,
      });
      chain.eq = jest.fn().mockResolvedValue({ data: null, error: null });
      return chain;
    }

    return chain;
  });

  mockRpcFn.mockResolvedValue({ data: null, error: null });
}

// =============================================================================
// Tests
// =============================================================================

describe("ProactiveBriefingService", () => {
  let service: ProactiveBriefingService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockProactiveBriefingEnabled = true;
    service = new ProactiveBriefingService();
  });

  // ===========================================================================
  // Constructor Tests
  // ===========================================================================

  describe("constructor", () => {
    it("should use default config when no options provided", () => {
      const defaultService = new ProactiveBriefingService();
      expect(defaultService).toBeDefined();
    });

    it("should merge custom config with defaults", () => {
      const customService = new ProactiveBriefingService({
        maxInsights: 10,
        maxSuggestions: 5,
      });
      expect(customService).toBeDefined();
    });
  });

  // ===========================================================================
  // generateBriefing Tests
  // ===========================================================================

  describe("generateBriefing", () => {
    it("should return null when feature flag is disabled", async () => {
      mockProactiveBriefingEnabled = false;

      const result = await service.generateBriefing(TEST_USER_ID);

      expect(result).toBeNull();
    });

    it("should return null for new users without last visit", async () => {
      setupMockQueries({ lastVisitAt: null });

      const result = await service.generateBriefing(TEST_USER_ID);

      expect(result).toBeNull();
    });

    it("should return null when offline duration is too short", async () => {
      // Last visit was 1 hour ago (less than 4 hours threshold)
      const recentVisit = new Date(
        Date.now() - TIME_CONSTANTS.ONE_HOUR_MS,
      ).toISOString();
      setupMockQueries({ lastVisitAt: recentVisit });

      const result = await service.generateBriefing(TEST_USER_ID);

      expect(result).toBeNull();
    });

    it("should generate briefing when offline duration exceeds threshold", async () => {
      const threeDaysAgo = new Date(
        Date.now() - TIME_CONSTANTS.ONE_DAY_MS * 3,
      ).toISOString();
      setupMockQueries({
        lastVisitAt: threeDaysAgo,
        newBookmarks: createMockBookmarks(5, [
          ["React", "前端"],
          ["React"],
          ["React"],
          ["Vue"],
          ["Next.js"],
        ]),
        untaggedCount: 15,
      });

      const result = await service.generateBriefing(TEST_USER_ID);

      expect(result).not.toBeNull();
      expect(result?.enabled).toBe(true);
      expect(result?.daysSinceLastVisit).toBe(3);
      expect(result?.newCollectionsCount).toBe(5);
    });

    it("should include topic change summary when new bookmarks exist", async () => {
      const fiveDaysAgo = new Date(
        Date.now() - TIME_CONSTANTS.ONE_DAY_MS * 5,
      ).toISOString();
      setupMockQueries({
        lastVisitAt: fiveDaysAgo,
        newBookmarks: createMockBookmarks(10, [
          ["React"],
          ["React"],
          ["React"],
          ["Vue"],
          ["Vue"],
          ["TypeScript"],
          ["TypeScript"],
          ["Next.js"],
          ["Next.js"],
          ["Node.js"],
        ]),
      });

      const result = await service.generateBriefing(TEST_USER_ID);

      expect(result?.topicChangeSummary).toBeDefined();
      expect(result?.topicChangeSummary).toContain("5 天");
    });

    it("should generate insights based on topic emergence", async () => {
      const sevenDaysAgo = new Date(
        Date.now() - TIME_CONSTANTS.ONE_DAY_MS * 7,
      ).toISOString();
      // 4 bookmarks with same tag triggers topic emergence
      setupMockQueries({
        lastVisitAt: sevenDaysAgo,
        newBookmarks: createMockBookmarks(5, [
          ["AI"],
          ["AI"],
          ["AI"],
          ["AI"],
          ["React"],
        ]),
        untaggedCount: 5,
      });

      const result = await service.generateBriefing(TEST_USER_ID);

      expect(result?.pendingInsights.length).toBeGreaterThan(0);
      const topicInsight = result?.pendingInsights.find(
        (i) => i.type === "topic_emergence",
      );
      expect(topicInsight).toBeDefined();
      expect(topicInsight?.title).toContain("AI");
    });

    it("should generate untagged recommendation when threshold exceeded", async () => {
      const threeDaysAgo = new Date(
        Date.now() - TIME_CONSTANTS.ONE_DAY_MS * 3,
      ).toISOString();
      setupMockQueries({
        lastVisitAt: threeDaysAgo,
        newBookmarks: createMockBookmarks(3),
        untaggedCount: 20, // Above threshold of 10
      });

      const result = await service.generateBriefing(TEST_USER_ID);

      const recommendInsight = result?.pendingInsights.find(
        (i) => i.type === "recommendation",
      );
      expect(recommendInsight).toBeDefined();
      expect(recommendInsight?.summary).toContain("20");
    });

    it("should generate platform pattern detection", async () => {
      const threeDaysAgo = new Date(
        Date.now() - TIME_CONSTANTS.ONE_DAY_MS * 3,
      ).toISOString();
      // All bookmarks from same platform
      const singlePlatformBookmarks = Array.from({ length: 5 }, (_, i) => ({
        id: i + 1,
        title: `Bookmark ${i + 1}`,
        platform: "BILIBILI",
        user_tags: ["视频"],
        created_at: new Date().toISOString(),
      }));

      setupMockQueries({
        lastVisitAt: threeDaysAgo,
        newBookmarks: singlePlatformBookmarks,
      });

      const result = await service.generateBriefing(TEST_USER_ID);

      const patternInsight = result?.pendingInsights.find(
        (i) => i.type === "pattern_detected",
      );
      expect(patternInsight).toBeDefined();
      expect(patternInsight?.title).toContain("BILIBILI");
    });

    it("should limit insights to maxInsights config", async () => {
      const customService = new ProactiveBriefingService({ maxInsights: 2 });
      const sevenDaysAgo = new Date(
        Date.now() - TIME_CONSTANTS.ONE_DAY_MS * 7,
      ).toISOString();

      setupMockQueries({
        lastVisitAt: sevenDaysAgo,
        newBookmarks: createMockBookmarks(10, [
          ["AI"],
          ["AI"],
          ["AI"],
          ["AI"],
          ["React"],
          ["React"],
          ["React"],
          ["Vue"],
          ["Vue"],
          ["Vue"],
        ]),
        untaggedCount: 30,
      });

      const result = await customService.generateBriefing(TEST_USER_ID);

      expect(result?.pendingInsights.length).toBeLessThanOrEqual(2);
    });

    it("should handle database errors gracefully", async () => {
      mockFromFn.mockImplementation(() => {
        const chain = createMockChainableQuery();
        chain.single = jest.fn().mockRejectedValue(new Error("Database error"));
        return chain;
      });

      const result = await service.generateBriefing(TEST_USER_ID);

      expect(result).toBeNull();
    });
  });

  // ===========================================================================
  // Suggested Actions Tests
  // ===========================================================================

  describe("suggested actions", () => {
    it("should suggest tag_untagged when many untagged bookmarks exist", async () => {
      const threeDaysAgo = new Date(
        Date.now() - TIME_CONSTANTS.ONE_DAY_MS * 3,
      ).toISOString();
      setupMockQueries({
        lastVisitAt: threeDaysAgo,
        untaggedCount: 25,
      });

      const result = await service.generateBriefing(TEST_USER_ID);

      const tagAction = result?.suggestedActions.find(
        (a) => a.type === "tag_untagged",
      );
      expect(tagAction).toBeDefined();
      expect(tagAction?.affectedCount).toBe(25);
    });

    it("should suggest review_unread when pending reviews exceed threshold", async () => {
      const threeDaysAgo = new Date(
        Date.now() - TIME_CONSTANTS.ONE_DAY_MS * 3,
      ).toISOString();
      setupMockQueries({
        lastVisitAt: threeDaysAgo,
        totalCount: 100, // 10% = 10 pending reviews
      });

      const result = await service.generateBriefing(TEST_USER_ID);

      const reviewAction = result?.suggestedActions.find(
        (a) => a.type === "review_unread",
      );
      expect(reviewAction).toBeDefined();
    });

    it("should suggest organize_topic when topic emergence detected", async () => {
      const sevenDaysAgo = new Date(
        Date.now() - TIME_CONSTANTS.ONE_DAY_MS * 7,
      ).toISOString();
      setupMockQueries({
        lastVisitAt: sevenDaysAgo,
        newBookmarks: createMockBookmarks(5, [
          ["新主题"],
          ["新主题"],
          ["新主题"],
          ["新主题"],
          ["其他"],
        ]),
      });

      const result = await service.generateBriefing(TEST_USER_ID);

      const organizeAction = result?.suggestedActions.find(
        (a) => a.type === "organize_topic",
      );
      expect(organizeAction).toBeDefined();
      expect(organizeAction?.executeParams?.skillId).toBe("batch_organize");
    });

    it("should limit suggestions to maxSuggestions config", async () => {
      const customService = new ProactiveBriefingService({ maxSuggestions: 1 });
      const sevenDaysAgo = new Date(
        Date.now() - TIME_CONSTANTS.ONE_DAY_MS * 7,
      ).toISOString();

      setupMockQueries({
        lastVisitAt: sevenDaysAgo,
        newBookmarks: createMockBookmarks(10, [
          ["新主题"],
          ["新主题"],
          ["新主题"],
          ["新主题"],
          ["其他"],
          ["其他"],
          ["其他"],
          ["其他"],
          ["React"],
          ["React"],
        ]),
        untaggedCount: 30,
        totalCount: 200,
      });

      const result = await customService.generateBriefing(TEST_USER_ID);

      expect(result?.suggestedActions.length).toBeLessThanOrEqual(1);
    });
  });

  // ===========================================================================
  // getUnreadInsightCount Tests
  // ===========================================================================

  describe("getUnreadInsightCount", () => {
    it("should return correct unread count", async () => {
      mockFromFn.mockImplementation(() => {
        const chain = createMockChainableQuery();
        // Count on the third eq call (user_id, is_read, is_dismissed)
        let eqCallCount = 0;
        chain.eq = jest.fn().mockImplementation(() => {
          eqCallCount++;
          if (eqCallCount >= 3) {
            return Promise.resolve({
              data: null,
              count: 5,
              error: null,
            });
          }
          return chain;
        });
        return chain;
      });

      const count = await service.getUnreadInsightCount(TEST_USER_ID);

      expect(count).toBe(5);
    });

    it("should return 0 on error", async () => {
      mockFromFn.mockImplementation(() => {
        const chain = createMockChainableQuery();
        // Chain the eq calls properly, reject on last one
        let eqCallCount = 0;
        chain.eq = jest.fn().mockImplementation(() => {
          eqCallCount++;
          if (eqCallCount >= 3) {
            // Third eq call - reject
            return Promise.reject(new Error("DB error"));
          }
          return chain;
        });
        return chain;
      });

      const count = await service.getUnreadInsightCount(TEST_USER_ID);

      expect(count).toBe(0);
    });
  });

  // ===========================================================================
  // markInsightAsRead Tests
  // ===========================================================================

  describe("markInsightAsRead", () => {
    it("should call update with correct parameters", async () => {
      const updateMock = jest.fn().mockReturnThis();
      const eqMock = jest.fn().mockResolvedValue({ data: null, error: null });

      mockFromFn.mockImplementation(() => ({
        update: updateMock,
        eq: eqMock,
      }));

      const insightId = "insight-123";
      await service.markInsightAsRead(TEST_USER_ID, insightId);

      expect(mockFromFn).toHaveBeenCalledWith("proactive_insights");
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({ is_read: true }),
      );
    });

    it("should handle errors gracefully", async () => {
      mockFromFn.mockImplementation(() => {
        const updateMock = jest.fn().mockReturnThis();
        // First eq is ok, second eq rejects
        let eqCallCount = 0;
        const eqMock = jest.fn().mockImplementation(() => {
          eqCallCount++;
          if (eqCallCount >= 2) {
            return Promise.reject(new Error("Update failed"));
          }
          return { eq: eqMock };
        });
        return {
          update: updateMock,
          eq: eqMock,
        };
      });

      // Should not throw
      await expect(
        service.markInsightAsRead(TEST_USER_ID, "insight-123"),
      ).resolves.toBeUndefined();
    });
  });

  // ===========================================================================
  // dismissInsight Tests
  // ===========================================================================

  describe("dismissInsight", () => {
    it("should call update with is_dismissed=true", async () => {
      const updateMock = jest.fn().mockReturnThis();
      const eqMock = jest.fn().mockResolvedValue({ data: null, error: null });

      mockFromFn.mockImplementation(() => ({
        update: updateMock,
        eq: eqMock,
      }));

      await service.dismissInsight(TEST_USER_ID, "insight-456");

      expect(updateMock).toHaveBeenCalledWith({ is_dismissed: true });
    });
  });

  // ===========================================================================
  // getInsights Tests
  // ===========================================================================

  describe("getInsights", () => {
    it("should return empty array when no insights exist", async () => {
      mockFromFn.mockImplementation(() => {
        const chain = createMockChainableQuery();
        chain.range = jest.fn().mockResolvedValue({
          data: [],
          count: 0,
          error: null,
        });
        return chain;
      });

      const { insights, total } = await service.getInsights(TEST_USER_ID);

      expect(insights).toEqual([]);
      expect(total).toBe(0);
    });

    it("should filter by unreadOnly when specified", async () => {
      const eqCalls: Array<[string, unknown]> = [];

      mockFromFn.mockImplementation(() => {
        // Create a thenable chain object that tracks all eq calls
        const chain: Record<string, jest.Mock> & { then: jest.Mock } = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockImplementation((...args) => {
            eqCalls.push(args as [string, unknown]);
            return chain;
          }),
          order: jest.fn().mockReturnThis(),
          range: jest.fn().mockReturnThis(),
          // Make the chain thenable - this is how Supabase query builder works
          then: jest.fn().mockImplementation((resolve) => {
            resolve({ data: [], count: 0, error: null });
          }),
        };
        return chain;
      });

      await service.getInsights(TEST_USER_ID, { unreadOnly: true });

      // Should call eq with is_read = false (after user_id and is_dismissed)
      const isReadCall = eqCalls.find(([col]) => col === "is_read");
      expect(isReadCall).toBeDefined();
      expect(isReadCall).toEqual(["is_read", false]);
    });

    it("should filter by types when specified", async () => {
      const inMock = jest.fn().mockResolvedValue({
        data: [],
        count: 0,
        error: null,
      });

      mockFromFn.mockImplementation(() => {
        const chain = createMockChainableQuery();
        chain.in = inMock;
        return chain;
      });

      await service.getInsights(TEST_USER_ID, {
        types: ["topic_emergence", "recommendation"],
      });

      expect(inMock).toHaveBeenCalledWith("type", [
        "topic_emergence",
        "recommendation",
      ]);
    });

    it("should apply pagination correctly", async () => {
      const rangeMock = jest.fn().mockResolvedValue({
        data: [],
        count: 0,
        error: null,
      });

      mockFromFn.mockImplementation(() => {
        const chain = createMockChainableQuery();
        chain.range = rangeMock;
        return chain;
      });

      await service.getInsights(TEST_USER_ID, { limit: 20, offset: 10 });

      expect(rangeMock).toHaveBeenCalledWith(10, 29); // offset to offset + limit - 1
    });

    it("should transform database rows to ProactiveInsight type", async () => {
      const mockDbRow = {
        id: "insight-123",
        type: "topic_emergence",
        title: "发现新主题",
        summary: "测试摘要",
        related_bookmark_ids: [1, 2, 3],
        priority: 8,
        created_at: "2025-12-30T00:00:00Z",
        is_read: false,
        metadata: { test: true },
      };

      mockFromFn.mockImplementation(() => {
        const chain = createMockChainableQuery();
        chain.range = jest.fn().mockResolvedValue({
          data: [mockDbRow],
          count: 1,
          error: null,
        });
        return chain;
      });

      const { insights, total } = await service.getInsights(TEST_USER_ID);

      expect(total).toBe(1);
      expect(insights[0]).toEqual({
        id: "insight-123",
        type: "topic_emergence",
        title: "发现新主题",
        summary: "测试摘要",
        relatedBookmarkIds: [1, 2, 3],
        priority: 8,
        createdAt: "2025-12-30T00:00:00Z",
        isRead: false,
        metadata: { test: true },
      });
    });
  });
});
