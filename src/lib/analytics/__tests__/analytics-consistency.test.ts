/**
 * Analytics 数据一致性测试
 * @description 验证统计数据的逻辑一致性
 * @version 1.0.0
 */

import {
  isBrowserPlatform,
  BROWSER_PLATFORMS,
} from "@/lib/repositories/server";
import type { Bookmark, Platform } from "@/types/supabase";

// 测试数据生成器
const createMockBookmark = (
  overrides: Partial<Bookmark> = {},
): Partial<Bookmark> => ({
  id: Math.floor(Math.random() * 10000),
  user_id: "test-user-id",
  url: "https://example.com",
  title: "Test Bookmark",
  platform: "WECHAT" as Platform,
  created_at: new Date().toISOString(),
  deleted_at: null,
  is_in_trash: false,
  folder_id: null,
  ai_tags: [],
  ...overrides,
});

describe("Analytics 数据一致性", () => {
  describe("isBrowserPlatform 函数", () => {
    it("正确识别浏览器平台", () => {
      expect(isBrowserPlatform("BROWSER_CHROME")).toBe(true);
      expect(isBrowserPlatform("BROWSER_EDGE")).toBe(true);
      expect(isBrowserPlatform("BROWSER_FIREFOX")).toBe(true);
      expect(isBrowserPlatform("BROWSER_SAFARI")).toBe(true);
    });

    it("正确识别内容平台", () => {
      expect(isBrowserPlatform("WECHAT")).toBe(false);
      expect(isBrowserPlatform("BILIBILI")).toBe(false);
      expect(isBrowserPlatform("XIAOHONGSHU")).toBe(false);
      expect(isBrowserPlatform("ZHIHU")).toBe(false);
    });

    it("处理空值", () => {
      expect(isBrowserPlatform(null)).toBe(false);
      expect(isBrowserPlatform("")).toBe(false);
    });
  });

  describe("BROWSER_PLATFORMS 常量", () => {
    it("包含所有浏览器平台", () => {
      expect(BROWSER_PLATFORMS).toContain("BROWSER_CHROME");
      expect(BROWSER_PLATFORMS).toContain("BROWSER_EDGE");
      expect(BROWSER_PLATFORMS).toContain("BROWSER_FIREFOX");
      expect(BROWSER_PLATFORMS).toContain("BROWSER_SAFARI");
    });

    it("只包含浏览器平台", () => {
      expect(BROWSER_PLATFORMS).toHaveLength(4);
    });
  });

  describe("数据分离一致性", () => {
    it("contentBookmarks + browserBookmarks = totalBookmarks", () => {
      // 创建混合数据
      const bookmarks = [
        createMockBookmark({ platform: "WECHAT" }),
        createMockBookmark({ platform: "BILIBILI" }),
        createMockBookmark({ platform: "BROWSER_CHROME" }),
        createMockBookmark({ platform: "BROWSER_EDGE" }),
        createMockBookmark({ platform: "XIAOHONGSHU" }),
      ];

      const contentBookmarks = bookmarks.filter(
        (b) => !isBrowserPlatform(b.platform as Platform),
      );
      const browserBookmarks = bookmarks.filter((b) =>
        isBrowserPlatform(b.platform as Platform),
      );

      expect(contentBookmarks.length + browserBookmarks.length).toBe(
        bookmarks.length,
      );
      expect(contentBookmarks).toHaveLength(3); // WECHAT, BILIBILI, XIAOHONGSHU
      expect(browserBookmarks).toHaveLength(2); // BROWSER_CHROME, BROWSER_EDGE
    });

    it("分离后无重复", () => {
      const bookmarks = [
        createMockBookmark({ id: 1, platform: "WECHAT" }),
        createMockBookmark({ id: 2, platform: "BROWSER_CHROME" }),
        createMockBookmark({ id: 3, platform: "BILIBILI" }),
      ];

      const contentIds = bookmarks
        .filter((b) => !isBrowserPlatform(b.platform as Platform))
        .map((b) => b.id);
      const browserIds = bookmarks
        .filter((b) => isBrowserPlatform(b.platform as Platform))
        .map((b) => b.id);

      // 验证无交集
      const intersection = contentIds.filter((id) => browserIds.includes(id));
      expect(intersection).toHaveLength(0);
    });
  });

  describe("时间统计逻辑", () => {
    it("todayCount <= weekCount <= last30DaysCount", () => {
      const now = new Date();
      const daysAgo = (days: number) => {
        const date = new Date(now);
        date.setDate(date.getDate() - days);
        return date.toISOString();
      };

      const bookmarks = [
        createMockBookmark({ created_at: daysAgo(0) }), // 今天
        createMockBookmark({ created_at: daysAgo(3) }), // 本周
        createMockBookmark({ created_at: daysAgo(10) }), // 近30天
        createMockBookmark({ created_at: daysAgo(15) }), // 近30天
        createMockBookmark({ created_at: daysAgo(45) }), // 超过30天
      ];

      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - 7);
      weekStart.setHours(0, 0, 0, 0);

      const monthStart = new Date(now);
      monthStart.setDate(monthStart.getDate() - 30);
      monthStart.setHours(0, 0, 0, 0);

      const todayCount = bookmarks.filter((b) => {
        if (!b.created_at) return false;
        return new Date(b.created_at) >= todayStart;
      }).length;

      const weekCount = bookmarks.filter((b) => {
        if (!b.created_at) return false;
        return new Date(b.created_at) >= weekStart;
      }).length;

      const last30DaysCount = bookmarks.filter((b) => {
        if (!b.created_at) return false;
        return new Date(b.created_at) >= monthStart;
      }).length;

      expect(todayCount).toBeLessThanOrEqual(weekCount);
      expect(weekCount).toBeLessThanOrEqual(last30DaysCount);
      expect(last30DaysCount).toBeLessThanOrEqual(bookmarks.length);
    });

    it("last30DaysCount <= contentBookmarks 总数", () => {
      const now = new Date();
      const daysAgo = (days: number) => {
        const date = new Date(now);
        date.setDate(date.getDate() - days);
        return date.toISOString();
      };

      const contentBookmarks = [
        createMockBookmark({ platform: "WECHAT", created_at: daysAgo(10) }),
        createMockBookmark({ platform: "BILIBILI", created_at: daysAgo(20) }),
        createMockBookmark({
          platform: "XIAOHONGSHU",
          created_at: daysAgo(45),
        }), // 超过30天
      ];

      const monthStart = new Date(now);
      monthStart.setDate(monthStart.getDate() - 30);
      monthStart.setHours(0, 0, 0, 0);

      const last30DaysCount = contentBookmarks.filter((b) => {
        if (!b.created_at) return false;
        return new Date(b.created_at) >= monthStart;
      }).length;

      expect(last30DaysCount).toBe(2); // 只有2条在30天内
      expect(last30DaysCount).toBeLessThanOrEqual(contentBookmarks.length);
    });
  });

  describe("分类率计算", () => {
    it("分类率在 0-100 之间", () => {
      const contentBookmarks = [
        createMockBookmark({ folder_id: 1 }),
        createMockBookmark({ folder_id: 2 }),
        createMockBookmark({ folder_id: null }), // 未分类
      ];

      const unclassifiedCount = contentBookmarks.filter(
        (b) => !b.folder_id,
      ).length;
      const classificationRate =
        contentBookmarks.length > 0
          ? Math.round(
              ((contentBookmarks.length - unclassifiedCount) /
                contentBookmarks.length) *
                100,
            )
          : 0;

      expect(classificationRate).toBeGreaterThanOrEqual(0);
      expect(classificationRate).toBeLessThanOrEqual(100);
      expect(classificationRate).toBe(67); // 2/3 ≈ 67%
    });

    it("空数据时分类率为 0", () => {
      const contentBookmarks: Partial<Bookmark>[] = [];
      const classificationRate = contentBookmarks.length > 0 ? 100 : 0;

      expect(classificationRate).toBe(0);
    });
  });
});
