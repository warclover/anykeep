/**
 * GlobalInsightService 单元测试
 *
 * @since 2025-12-30
 */

import { GlobalInsightService } from "../global-insight-service";
import type { GlobalInsight, BookmarkForAnalysis } from "../types";
import {
  DEFAULT_CONFIG,
  TIME_CONSTANTS,
  TOPIC_RELATIONS,
  MIN_BOOKMARKS_FOR_INSIGHT,
  INSIGHT_VERSION,
} from "../constants";

// =============================================================================
// Mock Setup
// =============================================================================

const mockRpc = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockGte = jest.fn();
const mockOrder = jest.fn();

jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: jest.fn(() => ({
      select: mockSelect,
    })),
    rpc: mockRpc,
  }),
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Mock database bookmark format (uses user_tags instead of tags)
 */
interface MockDbBookmark {
  id: number;
  title: string;
  user_tags: string[] | null;
  platform: string;
  created_at: string;
  ai_summary: string | null;
}

function createMockDbBookmark(
  overrides: Partial<MockDbBookmark> = {},
): MockDbBookmark {
  return {
    id: Math.floor(Math.random() * 1000),
    title: "Test Bookmark",
    user_tags: ["React", "TypeScript"],
    platform: "web",
    created_at: new Date().toISOString(),
    ai_summary: null,
    ...overrides,
  };
}

function createMockBookmark(
  overrides: Partial<BookmarkForAnalysis> = {},
): BookmarkForAnalysis {
  return {
    id: Math.floor(Math.random() * 1000),
    title: "Test Bookmark",
    tags: ["React", "TypeScript"],
    platform: "web",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function createMockDbBookmarks(
  count: number,
  tagDistribution?: Record<string, number>,
): MockDbBookmark[] {
  const bookmarks: MockDbBookmark[] = [];

  if (tagDistribution) {
    for (const [tag, tagCount] of Object.entries(tagDistribution)) {
      for (let i = 0; i < tagCount; i++) {
        bookmarks.push(
          createMockDbBookmark({
            id: bookmarks.length + 1,
            user_tags: [tag],
            created_at: new Date(
              Date.now() - Math.random() * 30 * TIME_CONSTANTS.ONE_DAY_MS,
            ).toISOString(),
          }),
        );
      }
    }
  } else {
    for (let i = 0; i < count; i++) {
      bookmarks.push(
        createMockDbBookmark({
          id: i + 1,
          created_at: new Date(
            Date.now() - Math.random() * 30 * TIME_CONSTANTS.ONE_DAY_MS,
          ).toISOString(),
        }),
      );
    }
  }

  return bookmarks;
}

function createMockBookmarks(
  count: number,
  tagDistribution?: Record<string, number>,
): BookmarkForAnalysis[] {
  const dbBookmarks = createMockDbBookmarks(count, tagDistribution);
  return dbBookmarks.map((b) => ({
    id: b.id,
    title: b.title,
    tags: b.user_tags,
    platform: b.platform,
    created_at: b.created_at,
    summary: b.ai_summary || undefined,
  }));
}

/**
 * Convert BookmarkForAnalysis to MockDbBookmark for database mock
 */
function toDbFormat(bookmark: BookmarkForAnalysis): MockDbBookmark {
  return {
    id: bookmark.id,
    title: bookmark.title,
    user_tags: bookmark.tags,
    platform: bookmark.platform,
    created_at: bookmark.created_at,
    ai_summary: bookmark.summary || null,
  };
}

function setupMockChain(data: MockDbBookmark[] | BookmarkForAnalysis[]) {
  // Convert BookmarkForAnalysis to MockDbBookmark if needed
  const dbData =
    data.length > 0 && "tags" in data[0]
      ? (data as BookmarkForAnalysis[]).map(toDbFormat)
      : (data as MockDbBookmark[]);
  mockOrder.mockResolvedValue({ data: dbData, error: null });
  mockGte.mockReturnValue({ order: mockOrder });
  mockEq.mockReturnValue({ gte: mockGte });
  mockSelect.mockReturnValue({ eq: mockEq });
}

function resetMocks() {
  jest.clearAllMocks();
  mockRpc.mockReset();
  mockSelect.mockReset();
  mockEq.mockReset();
  mockGte.mockReset();
  mockOrder.mockReset();
}

// =============================================================================
// Tests
// =============================================================================

describe("GlobalInsightService", () => {
  let service: GlobalInsightService;

  beforeEach(() => {
    resetMocks();
    service = new GlobalInsightService();
  });

  // ===========================================================================
  // Constructor Tests
  // ===========================================================================

  describe("constructor", () => {
    it("should use default config when no config provided", () => {
      const service = new GlobalInsightService();
      expect(service).toBeDefined();
    });

    it("should merge custom config with defaults", () => {
      const service = new GlobalInsightService({
        analysisPeriodDays: 180,
        maxTopics: 30,
      });
      expect(service).toBeDefined();
    });
  });

  // ===========================================================================
  // getInsight Tests
  // ===========================================================================

  describe("getInsight", () => {
    it("should return null when not enough bookmarks", async () => {
      const bookmarks = createMockBookmarks(MIN_BOOKMARKS_FOR_INSIGHT - 1);
      setupMockChain(bookmarks);
      mockRpc.mockResolvedValue({ data: null, error: null });

      const result = await service.getInsight("user-123");

      expect(result).toBeNull();
    });

    it("should generate insight when enough bookmarks exist", async () => {
      const bookmarks = createMockBookmarks(10, {
        React: 5,
        TypeScript: 3,
        "Next.js": 2,
      });
      setupMockChain(bookmarks);
      mockRpc.mockResolvedValue({ data: null, error: null });

      const result = await service.getInsight("user-123");

      expect(result).not.toBeNull();
      expect(result?.version).toBe(INSIGHT_VERSION);
      expect(result?.topicDistribution.length).toBeGreaterThan(0);
    });

    it("should return cached insight when fresh", async () => {
      const cachedInsight: GlobalInsight = {
        version: INSIGHT_VERSION,
        topicDistribution: [
          {
            topic: "React",
            weight: 0.5,
            bookmarkCount: 10,
            recentActivity: 0.8,
            trend: "stable",
          },
        ],
        interestTrend: [],
        knowledgeGaps: [],
        coreKnowledge: ["React"],
        peripheralInterests: [],
        platformPreference: [],
        activeTimeSlots: [],
        lastAnalyzedAt: new Date().toISOString(), // Fresh
        analyzedBookmarkCount: 10,
      };

      mockRpc.mockResolvedValue({ data: cachedInsight, error: null });

      const result = await service.getInsight("user-123");

      expect(result).toEqual(cachedInsight);
      // Should not have fetched bookmarks
      expect(mockSelect).not.toHaveBeenCalled();
    });

    it("should regenerate insight when forceRefresh is true", async () => {
      const cachedInsight: GlobalInsight = {
        version: INSIGHT_VERSION,
        topicDistribution: [],
        interestTrend: [],
        knowledgeGaps: [],
        coreKnowledge: [],
        peripheralInterests: [],
        platformPreference: [],
        activeTimeSlots: [],
        lastAnalyzedAt: new Date().toISOString(),
        analyzedBookmarkCount: 10,
      };

      mockRpc.mockResolvedValue({ data: cachedInsight, error: null });

      const bookmarks = createMockBookmarks(10, { React: 10 });
      setupMockChain(bookmarks);

      const result = await service.getInsight("user-123", true);

      expect(result).not.toBeNull();
      expect(mockSelect).toHaveBeenCalled();
    });

    it("should regenerate insight when cache is stale", async () => {
      const staleTime = new Date(
        Date.now() -
          DEFAULT_CONFIG.updateIntervalHours * TIME_CONSTANTS.ONE_HOUR_MS -
          1000,
      ).toISOString();

      const cachedInsight: GlobalInsight = {
        version: INSIGHT_VERSION,
        topicDistribution: [],
        interestTrend: [],
        knowledgeGaps: [],
        coreKnowledge: [],
        peripheralInterests: [],
        platformPreference: [],
        activeTimeSlots: [],
        lastAnalyzedAt: staleTime, // Stale
        analyzedBookmarkCount: 10,
      };

      mockRpc
        .mockResolvedValueOnce({ data: cachedInsight, error: null }) // getCachedInsight
        .mockResolvedValueOnce({ data: null, error: null }); // cacheInsight

      const bookmarks = createMockBookmarks(10, { React: 10 });
      setupMockChain(bookmarks);

      const result = await service.getInsight("user-123");

      expect(result).not.toBeNull();
      expect(mockSelect).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Topic Distribution Tests
  // ===========================================================================

  describe("topic distribution analysis", () => {
    it("should correctly count tag frequencies", async () => {
      const bookmarks = createMockBookmarks(0, {
        React: 5,
        TypeScript: 3,
        "Node.js": 2,
      });
      setupMockChain(bookmarks);
      mockRpc.mockResolvedValue({ data: null, error: null });

      const result = await service.getInsight("user-123", true);

      expect(result).not.toBeNull();
      const reactTopic = result!.topicDistribution.find(
        (t) => t.topic === "React",
      );
      expect(reactTopic?.bookmarkCount).toBe(5);
    });

    it("should sort topics by weight descending", async () => {
      const bookmarks = createMockBookmarks(0, {
        A: 1,
        B: 5,
        C: 3,
      });
      setupMockChain(bookmarks);
      mockRpc.mockResolvedValue({ data: null, error: null });

      const result = await service.getInsight("user-123", true);

      expect(result).not.toBeNull();
      expect(result!.topicDistribution[0].topic).toBe("B");
      expect(result!.topicDistribution[1].topic).toBe("C");
      expect(result!.topicDistribution[2].topic).toBe("A");
    });

    it("should limit topics to maxTopics config", async () => {
      const tagDistribution: Record<string, number> = {};
      for (let i = 0; i < 30; i++) {
        tagDistribution[`Topic${i}`] = 1;
      }

      const bookmarks = createMockBookmarks(0, tagDistribution);
      setupMockChain(bookmarks);
      mockRpc.mockResolvedValue({ data: null, error: null });

      const result = await service.getInsight("user-123", true);

      expect(result).not.toBeNull();
      expect(result!.topicDistribution.length).toBeLessThanOrEqual(
        DEFAULT_CONFIG.maxTopics,
      );
    });

    it("should handle bookmarks without tags", async () => {
      const bookmarks = [
        createMockBookmark({ tags: null }),
        createMockBookmark({ tags: [] }),
        createMockBookmark({ tags: ["React"] }),
        createMockBookmark({ tags: ["React"] }),
        createMockBookmark({ tags: ["TypeScript"] }),
      ];
      setupMockChain(bookmarks);
      mockRpc.mockResolvedValue({ data: null, error: null });

      const result = await service.getInsight("user-123", true);

      expect(result).not.toBeNull();
      expect(result!.topicDistribution.length).toBe(2);
    });
  });

  // ===========================================================================
  // Trend Calculation Tests
  // ===========================================================================

  describe("trend calculation", () => {
    it("should detect rising trend when recent activity increases", async () => {
      const now = Date.now();

      // Create more recent bookmarks than older ones
      const bookmarks: BookmarkForAnalysis[] = [];

      // 8 recent bookmarks (last 15 days)
      for (let i = 0; i < 8; i++) {
        bookmarks.push(
          createMockBookmark({
            id: i + 1,
            tags: ["React"],
            created_at: new Date(
              now - i * TIME_CONSTANTS.ONE_DAY_MS,
            ).toISOString(),
          }),
        );
      }

      // 2 older bookmarks (35-50 days ago)
      for (let i = 0; i < 2; i++) {
        bookmarks.push(
          createMockBookmark({
            id: i + 9,
            tags: ["React"],
            created_at: new Date(
              now - (35 + i * 5) * TIME_CONSTANTS.ONE_DAY_MS,
            ).toISOString(),
          }),
        );
      }

      setupMockChain(bookmarks);
      mockRpc.mockResolvedValue({ data: null, error: null });

      const result = await service.getInsight("user-123", true);

      expect(result).not.toBeNull();
      const reactTopic = result!.topicDistribution.find(
        (t) => t.topic === "React",
      );
      expect(reactTopic?.trend).toBe("rising");
    });

    it("should detect declining trend when recent activity decreases", async () => {
      const now = Date.now();
      const bookmarks: BookmarkForAnalysis[] = [];

      // 1 recent bookmark (last 15 days)
      bookmarks.push(
        createMockBookmark({
          id: 1,
          tags: ["React"],
          created_at: new Date(
            now - 5 * TIME_CONSTANTS.ONE_DAY_MS,
          ).toISOString(),
        }),
      );

      // 10 older bookmarks (35-50 days ago)
      for (let i = 0; i < 10; i++) {
        bookmarks.push(
          createMockBookmark({
            id: i + 2,
            tags: ["React"],
            created_at: new Date(
              now - (35 + i * 2) * TIME_CONSTANTS.ONE_DAY_MS,
            ).toISOString(),
          }),
        );
      }

      setupMockChain(bookmarks);
      mockRpc.mockResolvedValue({ data: null, error: null });

      const result = await service.getInsight("user-123", true);

      expect(result).not.toBeNull();
      const reactTopic = result!.topicDistribution.find(
        (t) => t.topic === "React",
      );
      expect(reactTopic?.trend).toBe("declining");
    });
  });

  // ===========================================================================
  // Knowledge Gaps Tests
  // ===========================================================================

  describe("knowledge gaps identification", () => {
    it("should suggest related topics user does not have", async () => {
      const bookmarks = createMockBookmarks(0, { React: 10 });
      setupMockChain(bookmarks);
      mockRpc.mockResolvedValue({ data: null, error: null });

      const result = await service.getInsight("user-123", true);

      expect(result).not.toBeNull();
      expect(result!.knowledgeGaps.length).toBeGreaterThan(0);

      // Should suggest TypeScript since it's related to React
      const relatedToReact = TOPIC_RELATIONS["React"] || [];
      const hasRelatedSuggestion = result!.knowledgeGaps.some((gap) =>
        relatedToReact.includes(gap),
      );
      expect(hasRelatedSuggestion).toBe(true);
    });

    it("should not suggest topics user already has", async () => {
      const bookmarks = createMockBookmarks(0, {
        React: 5,
        TypeScript: 5,
      });
      setupMockChain(bookmarks);
      mockRpc.mockResolvedValue({ data: null, error: null });

      const result = await service.getInsight("user-123", true);

      expect(result).not.toBeNull();
      expect(result!.knowledgeGaps).not.toContain("React");
      expect(result!.knowledgeGaps).not.toContain("TypeScript");
    });
  });

  // ===========================================================================
  // Core/Peripheral Classification Tests
  // ===========================================================================

  describe("knowledge classification", () => {
    it("should classify high-weight topics as core knowledge", async () => {
      const bookmarks = createMockBookmarks(0, {
        React: 60,
        TypeScript: 20,
        Python: 10,
        Go: 5,
        Rust: 5,
      });
      setupMockChain(bookmarks);
      mockRpc.mockResolvedValue({ data: null, error: null });

      const result = await service.getInsight("user-123", true);

      expect(result).not.toBeNull();
      expect(result!.coreKnowledge).toContain("React");
      expect(result!.coreKnowledge).toContain("TypeScript");
    });

    it("should classify low-weight topics as peripheral interests", async () => {
      const bookmarks = createMockBookmarks(0, {
        React: 80,
        TypeScript: 10,
        Rust: 5,
        Go: 5,
      });
      setupMockChain(bookmarks);
      mockRpc.mockResolvedValue({ data: null, error: null });

      const result = await service.getInsight("user-123", true);

      expect(result).not.toBeNull();
      // Low weight topics should be peripheral
      expect(result!.peripheralInterests.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // Platform Preference Tests
  // ===========================================================================

  describe("platform preference analysis", () => {
    it("should correctly analyze platform distribution", async () => {
      const bookmarks = [
        createMockBookmark({ platform: "wechat" }),
        createMockBookmark({ platform: "wechat" }),
        createMockBookmark({ platform: "wechat" }),
        createMockBookmark({ platform: "bilibili" }),
        createMockBookmark({ platform: "bilibili" }),
        createMockBookmark({ platform: "zhihu" }),
      ];
      setupMockChain(bookmarks);
      mockRpc.mockResolvedValue({ data: null, error: null });

      const result = await service.getInsight("user-123", true);

      expect(result).not.toBeNull();
      expect(result!.platformPreference.length).toBe(3);
      expect(result!.platformPreference[0].platform).toBe("wechat");
      expect(result!.platformPreference[0].bookmarkCount).toBe(3);
    });

    it("should handle bookmarks without platform", async () => {
      const bookmarks = createMockBookmarks(10);
      // Override with undefined platform
      bookmarks.forEach((b, i) => {
        if (i < 5) {
          (b as { platform: string | undefined }).platform = undefined;
        }
      });
      setupMockChain(bookmarks);
      mockRpc.mockResolvedValue({ data: null, error: null });

      const result = await service.getInsight("user-123", true);

      expect(result).not.toBeNull();
      // Should have 'unknown' platform
      const unknownPlatform = result!.platformPreference.find(
        (p) => p.platform === "unknown",
      );
      expect(unknownPlatform).toBeDefined();
    });
  });

  // ===========================================================================
  // Active Time Slots Tests
  // ===========================================================================

  describe("active time slots analysis", () => {
    it("should analyze activity patterns by day and hour", async () => {
      const bookmarks = createMockBookmarks(10);
      setupMockChain(bookmarks);
      mockRpc.mockResolvedValue({ data: null, error: null });

      const result = await service.getInsight("user-123", true);

      expect(result).not.toBeNull();
      expect(result!.activeTimeSlots.length).toBeGreaterThan(0);

      // Each slot should have valid dayOfWeek (0-6) and hour (0-23)
      for (const slot of result!.activeTimeSlots) {
        expect(slot.dayOfWeek).toBeGreaterThanOrEqual(0);
        expect(slot.dayOfWeek).toBeLessThanOrEqual(6);
        expect(slot.hour).toBeGreaterThanOrEqual(0);
        expect(slot.hour).toBeLessThanOrEqual(23);
        expect(slot.activity).toBeGreaterThan(0);
        expect(slot.activity).toBeLessThanOrEqual(1);
      }
    });

    it("should sort time slots by activity descending", async () => {
      const bookmarks = createMockBookmarks(20);
      setupMockChain(bookmarks);
      mockRpc.mockResolvedValue({ data: null, error: null });

      const result = await service.getInsight("user-123", true);

      expect(result).not.toBeNull();
      if (result!.activeTimeSlots.length > 1) {
        for (let i = 1; i < result!.activeTimeSlots.length; i++) {
          expect(result!.activeTimeSlots[i].activity).toBeLessThanOrEqual(
            result!.activeTimeSlots[i - 1].activity,
          );
        }
      }
    });
  });

  // ===========================================================================
  // getCoreTopics Tests
  // ===========================================================================

  describe("getCoreTopics", () => {
    it("should return top core topics", async () => {
      const bookmarks = createMockBookmarks(0, {
        React: 50,
        TypeScript: 30,
        "Next.js": 15,
        Python: 5,
      });
      setupMockChain(bookmarks);
      mockRpc.mockResolvedValue({ data: null, error: null });

      const topics = await service.getCoreTopics("user-123", 3);

      expect(topics.length).toBeLessThanOrEqual(3);
      expect(topics[0].topic).toBe("React");
    });

    it("should return empty array when no insight available", async () => {
      const bookmarks = createMockBookmarks(MIN_BOOKMARKS_FOR_INSIGHT - 1);
      setupMockChain(bookmarks);
      mockRpc.mockResolvedValue({ data: null, error: null });

      const topics = await service.getCoreTopics("user-123");

      expect(topics).toEqual([]);
    });
  });

  // ===========================================================================
  // getKnowledgeGaps Tests
  // ===========================================================================

  describe("getKnowledgeGaps", () => {
    it("should return knowledge gaps from insight", async () => {
      const bookmarks = createMockBookmarks(0, { React: 10 });
      setupMockChain(bookmarks);
      mockRpc.mockResolvedValue({ data: null, error: null });

      const gaps = await service.getKnowledgeGaps("user-123");

      expect(gaps.length).toBeGreaterThan(0);
    });

    it("should return empty array when no insight available", async () => {
      const bookmarks = createMockBookmarks(MIN_BOOKMARKS_FOR_INSIGHT - 1);
      setupMockChain(bookmarks);
      mockRpc.mockResolvedValue({ data: null, error: null });

      const gaps = await service.getKnowledgeGaps("user-123");

      expect(gaps).toEqual([]);
    });
  });

  // ===========================================================================
  // Error Handling Tests
  // ===========================================================================

  describe("error handling", () => {
    it("should return null when database query fails", async () => {
      mockSelect.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: null,
              error: { message: "Database error" },
            }),
          }),
        }),
      });
      mockRpc.mockResolvedValue({ data: null, error: null });

      const result = await service.getInsight("user-123");

      expect(result).toBeNull();
    });

    it("should handle RPC errors gracefully", async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: "RPC error" },
      });

      const bookmarks = createMockBookmarks(10);
      setupMockChain(bookmarks);

      // Should still generate insight despite cache error
      const result = await service.getInsight("user-123");

      expect(result).not.toBeNull();
    });
  });

  // ===========================================================================
  // refreshInsight Tests
  // ===========================================================================

  describe("refreshInsight", () => {
    it("should force regenerate insight", async () => {
      const cachedInsight: GlobalInsight = {
        version: INSIGHT_VERSION,
        topicDistribution: [
          {
            topic: "Old",
            weight: 1,
            bookmarkCount: 1,
            recentActivity: 1,
            trend: "stable",
          },
        ],
        interestTrend: [],
        knowledgeGaps: [],
        coreKnowledge: ["Old"],
        peripheralInterests: [],
        platformPreference: [],
        activeTimeSlots: [],
        lastAnalyzedAt: new Date().toISOString(),
        analyzedBookmarkCount: 1,
      };

      mockRpc.mockResolvedValue({ data: cachedInsight, error: null });

      const newBookmarks = createMockBookmarks(0, { New: 10 });
      setupMockChain(newBookmarks);

      const result = await service.refreshInsight("user-123");

      expect(result).not.toBeNull();
      // Should have regenerated with new data
      expect(result!.topicDistribution[0].topic).toBe("New");
    });
  });
});
