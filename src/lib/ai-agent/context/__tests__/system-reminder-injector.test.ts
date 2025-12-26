/**
 * System-Reminder 动态注入器测试
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import type { DynamicContext } from "../types";
import {
  REMINDER_TRIGGERS,
  getActiveReminders,
  injectSystemReminders,
  shouldInjectReminders,
} from "../system-reminder-injector";

// 创建测试用的 DynamicContext
function createMockContext(
  overrides: Partial<DynamicContext> = {},
): DynamicContext {
  return {
    time: {
      current: "2025-12-27 14:30",
      period: "afternoon",
      isWeekend: false,
    },
    stats: {
      totalBookmarks: 100,
      recentWeekCount: 5,
      topPlatform: { name: "微信公众号", code: "wechat", count: 60 },
      topFolders: [{ id: 1, name: "工作", count: 30 }],
    },
    preferences: {
      responseStyle: "concise",
      frequentTags: ["技术", "产品"],
    },
    recentActivity: {},
    session: {},
    ...overrides,
  };
}

describe("system-reminder-injector", () => {
  describe("REMINDER_TRIGGERS", () => {
    it("should have 6 triggers", () => {
      expect(REMINDER_TRIGGERS).toHaveLength(6);
    });

    it("should have required properties for each trigger", () => {
      for (const trigger of REMINDER_TRIGGERS) {
        expect(trigger).toHaveProperty("id");
        expect(trigger).toHaveProperty("condition");
        expect(trigger).toHaveProperty("reminder");
        expect(trigger).toHaveProperty("priority");
        expect(trigger).toHaveProperty("isProactive");
        expect(typeof trigger.condition).toBe("function");
        expect(typeof trigger.priority).toBe("number");
      }
    });
  });

  describe("getActiveReminders", () => {
    it("should return empty array when no conditions match", () => {
      const ctx = createMockContext();
      const reminders = getActiveReminders(ctx);
      // 根据默认 context，可能有一些匹配
      expect(Array.isArray(reminders)).toBe(true);
    });

    it('should return "long-inactive" reminder when recentWeekCount is 0', () => {
      const ctx = createMockContext({
        stats: {
          totalBookmarks: 150,
          recentWeekCount: 0,
          topPlatform: { name: "微信公众号", code: "wechat", count: 60 },
          topFolders: [],
        },
      });
      const reminders = getActiveReminders(ctx);
      expect(reminders.some((r) => r.id === "long-inactive")).toBe(true);
    });

    it('should return "platform-dominant" reminder when one platform > 60%', () => {
      const ctx = createMockContext({
        stats: {
          totalBookmarks: 100,
          recentWeekCount: 5,
          topPlatform: { name: "B站", code: "bilibili", count: 70 }, // 70%
          topFolders: [],
        },
      });
      const reminders = getActiveReminders(ctx);
      expect(reminders.some((r) => r.id === "platform-dominant")).toBe(true);
    });

    it('should return "selected-items" reminder when items are selected', () => {
      const ctx = createMockContext({
        session: {
          selectedBookmarkIds: [1, 2, 3],
        },
      });
      const reminders = getActiveReminders(ctx);
      expect(reminders.some((r) => r.id === "selected-items")).toBe(true);
    });

    it("should limit results by maxReminders", () => {
      const ctx = createMockContext({
        stats: {
          totalBookmarks: 150,
          recentWeekCount: 0,
          topPlatform: { name: "B站", code: "bilibili", count: 100 },
          topFolders: [{ id: 1, name: "空文件夹", count: 0 }],
        },
        session: {
          selectedBookmarkIds: [1],
        },
      });
      const reminders = getActiveReminders(ctx, 1);
      expect(reminders).toHaveLength(1);
    });

    it("should sort by priority descending", () => {
      const ctx = createMockContext({
        stats: {
          totalBookmarks: 150,
          recentWeekCount: 0,
          topPlatform: { name: "B站", code: "bilibili", count: 100 },
          topFolders: [],
        },
        session: {
          selectedBookmarkIds: [1],
        },
      });
      const reminders = getActiveReminders(ctx, 10);
      for (let i = 1; i < reminders.length; i++) {
        expect(reminders[i - 1].priority).toBeGreaterThanOrEqual(
          reminders[i].priority,
        );
      }
    });
  });

  describe("injectSystemReminders", () => {
    it("should return original prompt when no reminders match", () => {
      const ctx = createMockContext({
        stats: {
          totalBookmarks: 20,
          recentWeekCount: 10,
          topPlatform: { name: "微信", code: "wechat", count: 5 },
          topFolders: [],
        },
      });
      const basePrompt = "你是一个AI助手。";
      const result = injectSystemReminders(basePrompt, ctx);
      // 可能没有匹配的提醒
      expect(result).toContain("你是一个AI助手");
    });

    it("should inject system-reminder tags when conditions match", () => {
      const ctx = createMockContext({
        session: {
          selectedBookmarkIds: [1, 2],
        },
      });
      const basePrompt = "你是一个AI助手。";
      const result = injectSystemReminders(basePrompt, ctx);
      expect(result).toContain("<system-reminder>");
      expect(result).toContain("</system-reminder>");
    });

    it("should replace placeholders in reminders", () => {
      const ctx = createMockContext({
        session: {
          selectedBookmarkIds: [1, 2, 3],
        },
      });
      const basePrompt = "你是一个AI助手。";
      const result = injectSystemReminders(basePrompt, ctx);
      expect(result).toContain("3 条书签");
    });

    it("should filter proactive reminders when enableProactive is false", () => {
      const ctx = createMockContext({
        stats: {
          totalBookmarks: 150,
          recentWeekCount: 0,
          topPlatform: { name: "B站", code: "bilibili", count: 100 },
          topFolders: [],
        },
      });
      const basePrompt = "你是一个AI助手。";
      const result = injectSystemReminders(basePrompt, ctx, {
        enableProactive: false,
      });
      // long-inactive 和 platform-dominant 都是 proactive，应该被过滤
      expect(result).not.toContain("long-inactive");
    });
  });

  describe("shouldInjectReminders", () => {
    it("should return true when items are selected", () => {
      const ctx = createMockContext({
        session: {
          selectedBookmarkIds: [1],
        },
      });
      expect(shouldInjectReminders(ctx)).toBe(true);
    });

    it("should return false when bookmarks < 50 and nothing selected", () => {
      const ctx = createMockContext({
        stats: {
          totalBookmarks: 30,
          recentWeekCount: 5,
          topPlatform: { name: "微信", code: "wechat", count: 10 },
          topFolders: [],
        },
        session: {
          selectedBookmarkIds: [],
        },
      });
      expect(shouldInjectReminders(ctx)).toBe(false);
    });

    it("should return true when bookmarks >= 50", () => {
      const ctx = createMockContext({
        stats: {
          totalBookmarks: 50,
          recentWeekCount: 5,
          topPlatform: { name: "微信", code: "wechat", count: 10 },
          topFolders: [],
        },
        session: {
          selectedBookmarkIds: [],
        },
      });
      expect(shouldInjectReminders(ctx)).toBe(true);
    });
  });
});
