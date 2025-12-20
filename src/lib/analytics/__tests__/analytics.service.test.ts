/**
 * AnalyticsService 单元测试
 * @module lib/analytics/__tests__/analytics.service.test
 */

// Mock React cache function (not available in test environment)
jest.mock("react", () => ({
  ...jest.requireActual("react"),
  cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}));

// Mock lucide-react before any imports that might use it
jest.mock("lucide-react", () => ({
  MessageSquare: () => null,
  Play: () => null,
  BookOpen: () => null,
  Globe: () => null,
  Chrome: () => null,
  Compass: () => null,
}));

// Mock platform-utils to avoid lucide-react dependency
jest.mock("@/lib/platform-utils", () => ({
  getPlatformConfig: jest.fn().mockReturnValue({
    name: "Test Platform",
    fullName: "Test Platform Full",
    bgColor: "bg-gray-500",
    brandColor: "#666666",
    brandBgColor: "#f0f0f0",
    brandColorDark: "#888888",
    brandBgColorDark: "#333333",
    icon: null,
  }),
}));

import { AnalyticsService } from "../analytics.service";
import {
  isBrowserPlatform,
  BROWSER_PLATFORMS,
  DEFAULT_ANALYTICS_CONFIG,
} from "../types";
import type { Bookmark, Platform } from "@/types/supabase";

// ============================================================================
// Mock Data
// ============================================================================

const mockUserId = "test-user-id";

/**
 * 创建模拟书签数据
 */
function createMockBookmark(overrides: Partial<Bookmark> = {}): Bookmark {
  const now = new Date();
  return {
    id: Math.floor(Math.random() * 10000),
    user_id: mockUserId,
    url: "https://example.com/test",
    title: "Test Bookmark",
    platform: "WECHAT" as Platform,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    deleted_at: null,
    folder_id: null,
    ai_tags: [],
    ai_summary: null,
    content_type: null,
    embedding: null,
    favicon_url: null,
    cover_image: null,
    author: null,
    description: null,
    raw_content: null,
    reading_progress: 0,
    is_favorite: false,
    is_in_trash: false, // 默认不在垃圾箱
    ...overrides,
  } as Bookmark;
}

/**
 * 创建指定日期的书签
 */
function createBookmarkWithDate(
  daysAgo: number,
  platform: string = "WECHAT_OFFICIAL_ACCOUNT",
): Bookmark {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return createMockBookmark({
    platform,
    created_at: date.toISOString(),
  });
}

// Mock Supabase Client
const createMockSupabase = (
  bookmarks: Bookmark[] = [],
  folders: { id: number; name: string }[] = [],
) => {
  // Create chainable query builder for folders
  const createFoldersQueryBuilder = () => {
    const builder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockImplementation(() => {
        // Return self for chaining, but also resolve to data
        return {
          ...builder,
          then: (
            resolve: (value: { data: typeof folders; error: null }) => void,
          ) => {
            resolve({ data: folders, error: null });
          },
        };
      }),
    };
    return builder;
  };

  // Create chainable query builder for classification_suggestions
  const createSuggestionsQueryBuilder = () => {
    const builder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockImplementation(() => ({
        ...builder,
        then: (resolve: (value: { data: never[]; error: null }) => void) => {
          resolve({ data: [], error: null });
        },
      })),
    };
    return builder;
  };

  return {
    from: jest.fn().mockImplementation((table: string) => {
      if (table === "bookmarks") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: bookmarks, error: null }),
        };
      }
      if (table === "folders") {
        return createFoldersQueryBuilder();
      }
      if (table === "classification_suggestions") {
        return createSuggestionsQueryBuilder();
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      };
    }),
  } as unknown as ConstructorParameters<typeof AnalyticsService>[0];
};

// ============================================================================
// Tests
// ============================================================================

describe("AnalyticsService", () => {
  describe("isBrowserPlatform", () => {
    it("should correctly identify browser platforms", () => {
      expect(isBrowserPlatform("BROWSER_CHROME")).toBe(true);
      expect(isBrowserPlatform("BROWSER_EDGE")).toBe(true);
      expect(isBrowserPlatform("BROWSER_FIREFOX")).toBe(true);
      expect(isBrowserPlatform("BROWSER_SAFARI")).toBe(true);
    });

    it("should correctly identify non-browser platforms", () => {
      expect(isBrowserPlatform("WECHAT_OFFICIAL_ACCOUNT")).toBe(false);
      expect(isBrowserPlatform("BILIBILI")).toBe(false);
      expect(isBrowserPlatform("XIAOHONGSHU")).toBe(false);
      expect(isBrowserPlatform("UNKNOWN")).toBe(false);
    });
  });

  describe("BROWSER_PLATFORMS constant", () => {
    it("should contain all browser platforms", () => {
      expect(BROWSER_PLATFORMS).toContain("BROWSER_CHROME");
      expect(BROWSER_PLATFORMS).toContain("BROWSER_EDGE");
      expect(BROWSER_PLATFORMS).toContain("BROWSER_FIREFOX");
      expect(BROWSER_PLATFORMS).toContain("BROWSER_SAFARI");
      expect(BROWSER_PLATFORMS).toHaveLength(4);
    });
  });

  describe("DEFAULT_ANALYTICS_CONFIG", () => {
    it("should have correct default values", () => {
      expect(DEFAULT_ANALYTICS_CONFIG.trendDays).toBe(30);
      expect(DEFAULT_ANALYTICS_CONFIG.topTagsCount).toBe(10);
      expect(DEFAULT_ANALYTICS_CONFIG.topFoldersCount).toBe(10);
      expect(DEFAULT_ANALYTICS_CONFIG.mergeBrowserPlatforms).toBe(true);
      expect(DEFAULT_ANALYTICS_CONFIG.includeComparison).toBe(false);
      expect(DEFAULT_ANALYTICS_CONFIG.includeAIStats).toBe(false);
    });
  });

  describe("getFullAnalytics", () => {
    it("should return empty stats for no bookmarks", async () => {
      const supabase = createMockSupabase([], []);
      const service = new AnalyticsService(supabase, mockUserId);

      const result = await service.getFullAnalytics();

      expect(result.stats.totalBookmarks).toBe(0);
      expect(result.stats.contentBookmarks).toBe(0);
      expect(result.stats.browserBookmarks).toBe(0);
      expect(result.stats.todayCount).toBe(0);
      expect(result.stats.weekCount).toBe(0);
      expect(result.stats.last30DaysCount).toBe(0);
      expect(result.trendData).toHaveLength(30);
      expect(result.platformData).toHaveLength(0);
      expect(result.folderData).toHaveLength(0);
      expect(result.tagData).toHaveLength(0);
    });

    it("should correctly separate content and browser bookmarks", async () => {
      const bookmarks = [
        createMockBookmark({ platform: "WECHAT" }),
        createMockBookmark({ platform: "BILIBILI" }),
        createMockBookmark({ platform: "BROWSER_CHROME" }),
        createMockBookmark({ platform: "BROWSER_EDGE" }),
      ];
      const supabase = createMockSupabase(bookmarks, []);
      const service = new AnalyticsService(supabase, mockUserId);

      const result = await service.getFullAnalytics();

      expect(result.stats.totalBookmarks).toBe(4);
      expect(result.stats.contentBookmarks).toBe(2);
      expect(result.stats.browserBookmarks).toBe(2);
    });

    it("should calculate time-based counts correctly", async () => {
      const bookmarks = [
        createBookmarkWithDate(0), // today
        createBookmarkWithDate(0), // today
        createBookmarkWithDate(3), // within week
        createBookmarkWithDate(10), // within 30 days
        createBookmarkWithDate(35), // older than 30 days
      ];
      const supabase = createMockSupabase(bookmarks, []);
      const service = new AnalyticsService(supabase, mockUserId);

      const result = await service.getFullAnalytics();

      expect(result.stats.totalBookmarks).toBe(5);
      expect(result.stats.todayCount).toBe(2);
      expect(result.stats.weekCount).toBe(3); // today (2) + 3 days ago (1)
      expect(result.stats.last30DaysCount).toBe(4); // excludes 35 days ago
    });

    it("should merge browser platforms when configured", async () => {
      const bookmarks = [
        createMockBookmark({ platform: "BROWSER_CHROME" }),
        createMockBookmark({ platform: "BROWSER_EDGE" }),
        createMockBookmark({ platform: "BROWSER_FIREFOX" }),
        createMockBookmark({ platform: "WECHAT" }),
      ];
      const supabase = createMockSupabase(bookmarks, []);
      const service = new AnalyticsService(supabase, mockUserId, {
        mergeBrowserPlatforms: true,
      });

      const result = await service.getFullAnalytics();

      // Should have 2 platform entries: BROWSER (merged) and WECHAT
      expect(result.platformData).toHaveLength(2);
      const browserPlatform = result.platformData.find(
        (p) => p.platform === "BROWSER",
      );
      expect(browserPlatform).toBeDefined();
      expect(browserPlatform!.value).toBe(3);
      expect(browserPlatform!.name).toBe("浏览器书签");
    });

    it("should not merge browser platforms when disabled", async () => {
      const bookmarks = [
        createMockBookmark({ platform: "BROWSER_CHROME" }),
        createMockBookmark({ platform: "BROWSER_EDGE" }),
        createMockBookmark({ platform: "WECHAT" }),
      ];
      const supabase = createMockSupabase(bookmarks, []);
      const service = new AnalyticsService(supabase, mockUserId, {
        mergeBrowserPlatforms: false,
      });

      const result = await service.getFullAnalytics();

      // Should have 3 separate platform entries
      expect(result.platformData).toHaveLength(3);
    });

    it("should calculate folder distribution correctly", async () => {
      const folders = [
        { id: 1, name: "Work" },
        { id: 2, name: "Personal" },
      ];
      const bookmarks = [
        createMockBookmark({ folder_id: 1 }),
        createMockBookmark({ folder_id: 1 }),
        createMockBookmark({ folder_id: 2 }),
        createMockBookmark({ folder_id: null }), // unclassified
      ];
      const supabase = createMockSupabase(bookmarks, folders);
      const service = new AnalyticsService(supabase, mockUserId);

      const result = await service.getFullAnalytics();

      expect(result.folderData).toHaveLength(3); // Work, Personal, 未分类
      const workFolder = result.folderData.find((f) => f.name === "Work");
      expect(workFolder!.value).toBe(2);
      const unclassified = result.folderData.find((f) => f.name === "未分类");
      expect(unclassified!.value).toBe(1);
    });

    it("should calculate tag stats from content bookmarks only", async () => {
      const bookmarks = [
        createMockBookmark({
          platform: "WECHAT",
          ai_tags: ["tech", "programming"],
        }),
        createMockBookmark({
          platform: "BILIBILI",
          ai_tags: ["tech", "video"],
        }),
        createMockBookmark({
          platform: "BROWSER_CHROME",
          ai_tags: ["browser", "imported"],
        }), // should be excluded
      ];
      const supabase = createMockSupabase(bookmarks, []);
      const service = new AnalyticsService(supabase, mockUserId);

      const result = await service.getFullAnalytics();

      // Only content bookmarks' tags should be counted
      const techTag = result.tagData.find((t) => t.tag === "tech");
      expect(techTag!.count).toBe(2);
      // Browser bookmark tags should not appear
      const browserTag = result.tagData.find((t) => t.tag === "browser");
      expect(browserTag).toBeUndefined();
    });

    it("should calculate content type stats correctly", async () => {
      const bookmarks = [
        createMockBookmark({ platform: "BILIBILI" }), // video
        createMockBookmark({ platform: "BILIBILI" }), // video
        createMockBookmark({ platform: "XIAOHONGSHU" }), // image
        createMockBookmark({ platform: "WECHAT" }), // article
        createMockBookmark({ platform: "ZHIHU" }), // article
      ];
      const supabase = createMockSupabase(bookmarks, []);
      const service = new AnalyticsService(supabase, mockUserId);

      const result = await service.getFullAnalytics();

      const videoType = result.typeData.find((t) => t.type === "视频");
      expect(videoType!.count).toBe(2);
      const imageType = result.typeData.find((t) => t.type === "图文");
      expect(imageType!.count).toBe(1);
      const articleType = result.typeData.find((t) => t.type === "文章");
      expect(articleType!.count).toBe(2);
    });

    it("should include comparison data when configured", async () => {
      const bookmarks = [
        createBookmarkWithDate(0), // today
        createBookmarkWithDate(1), // yesterday
        createBookmarkWithDate(3), // this week
        createBookmarkWithDate(10), // last week
      ];
      const supabase = createMockSupabase(bookmarks, []);
      const service = new AnalyticsService(supabase, mockUserId, {
        includeComparison: true,
      });

      const result = await service.getFullAnalytics();

      expect(result.comparison).toBeDefined();
      expect(result.comparison!.daily).toBeDefined();
      expect(result.comparison!.weekly).toBeDefined();
      expect(result.comparison!.monthly).toBeDefined();
    });

    it("should not include comparison data when not configured", async () => {
      const supabase = createMockSupabase([], []);
      const service = new AnalyticsService(supabase, mockUserId, {
        includeComparison: false,
      });

      const result = await service.getFullAnalytics();

      expect(result.comparison).toBeUndefined();
    });

    it("should generate trend data for configured days", async () => {
      const supabase = createMockSupabase([], []);
      const service = new AnalyticsService(supabase, mockUserId, {
        trendDays: 7,
      });

      const result = await service.getFullAnalytics();

      expect(result.trendData).toHaveLength(7);
    });

    it("should calculate classification rate correctly", async () => {
      const bookmarks = [
        createMockBookmark({ folder_id: 1 }),
        createMockBookmark({ folder_id: 1 }),
        createMockBookmark({ folder_id: null }),
        createMockBookmark({ folder_id: null }),
      ];
      const supabase = createMockSupabase(bookmarks, [{ id: 1, name: "Test" }]);
      const service = new AnalyticsService(supabase, mockUserId);

      const result = await service.getFullAnalytics();

      expect(result.stats.unclassifiedCount).toBe(2);
      expect(result.stats.classificationRate).toBe(50); // 2/4 = 50%
    });
  });

  describe("comparison calculations", () => {
    it("should calculate upward trend correctly", async () => {
      // 2 bookmarks today, 1 yesterday = +100%
      const bookmarks = [
        createBookmarkWithDate(0),
        createBookmarkWithDate(0),
        createBookmarkWithDate(1),
      ];
      const supabase = createMockSupabase(bookmarks, []);
      const service = new AnalyticsService(supabase, mockUserId, {
        includeComparison: true,
      });

      const result = await service.getFullAnalytics();

      expect(result.comparison!.daily.trend).toBe("up");
      expect(result.comparison!.daily.current).toBe(2);
      expect(result.comparison!.daily.previous).toBe(1);
    });

    it("should calculate flat trend when no change", async () => {
      const supabase = createMockSupabase([], []);
      const service = new AnalyticsService(supabase, mockUserId, {
        includeComparison: true,
      });

      const result = await service.getFullAnalytics();

      expect(result.comparison!.daily.trend).toBe("flat");
    });
  });

  describe("generatedAt timestamp", () => {
    it("should include valid ISO timestamp", async () => {
      const supabase = createMockSupabase([], []);
      const service = new AnalyticsService(supabase, mockUserId);

      const result = await service.getFullAnalytics();

      expect(result.generatedAt).toBeDefined();
      expect(() => new Date(result.generatedAt)).not.toThrow();
    });
  });

  describe("data consistency with trash filtering", () => {
    it("should exclude trashed bookmarks from statistics", async () => {
      // 模拟：3 个活跃书签，1 个在垃圾箱中
      // Mock 返回的是已过滤后的数据（模拟数据库层的过滤）
      const activeBookmarks = [
        createMockBookmark({ is_in_trash: false }),
        createMockBookmark({ is_in_trash: false }),
        createMockBookmark({ is_in_trash: false }),
      ];
      const supabase = createMockSupabase(activeBookmarks, []);
      const service = new AnalyticsService(supabase, mockUserId);

      const result = await service.getFullAnalytics();

      // 应该只统计活跃书签，不包含垃圾箱
      expect(result.stats.totalBookmarks).toBe(3);
    });

    it("should have consistent platform distribution with total count", async () => {
      const bookmarks = [
        createMockBookmark({ platform: "WECHAT", is_in_trash: false }),
        createMockBookmark({ platform: "BILIBILI", is_in_trash: false }),
        createMockBookmark({ platform: "BROWSER_CHROME", is_in_trash: false }),
      ];
      const supabase = createMockSupabase(bookmarks, []);
      const service = new AnalyticsService(supabase, mockUserId);

      const result = await service.getFullAnalytics();

      // 平台分布数量之和应等于总数
      const platformSum = result.platformData.reduce(
        (sum, p) => sum + p.value,
        0,
      );
      expect(platformSum).toBe(result.stats.totalBookmarks);
    });
  });
});
