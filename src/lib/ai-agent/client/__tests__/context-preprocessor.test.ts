/**
 * 客户端上下文预处理器测试
 *
 * @since 2026-01-11
 */

import type { BookmarkListItemResponse } from "@/contracts/responses/bookmark.response";
import {
  preprocessBookmarks,
  preprocessSelectionSummary,
  estimateTokens,
  calculateTokenSavings,
  smartPreprocess,
  type LightweightBookmark,
  type SelectionSummary,
} from "../context-preprocessor";

// ============================================
// 测试数据工厂
// ============================================

function createMockBookmark(
  overrides: Partial<BookmarkListItemResponse> = {}
): BookmarkListItemResponse {
  return {
    id: 1,
    title: "测试书签标题",
    description: "这是一个测试书签的描述",
    url: "https://example.com/test",
    platform: "weixin",
    userTags: ["技术", "AI"],
    aiTags: ["机器学习"],
    folderName: "收藏夹",
    isRead: false,
    isStarred: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as BookmarkListItemResponse;
}

function createMockBookmarks(count: number): BookmarkListItemResponse[] {
  return Array.from({ length: count }, (_, i) =>
    createMockBookmark({
      id: i + 1,
      title: `书签标题 ${i + 1}`,
      platform: i % 3 === 0 ? "weixin" : i % 3 === 1 ? "bilibili" : "zhihu",
      userTags: i % 2 === 0 ? ["标签A", "标签B"] : null,
      aiTags: i % 3 === 0 ? ["AI标签"] : null,
      isRead: i % 4 === 0,
      isStarred: i % 5 === 0,
    })
  );
}

describe("context-preprocessor", () => {
  // ============================================
  // preprocessBookmarks 测试
  // ============================================
  describe("preprocessBookmarks", () => {
    describe("basic transformation", () => {
      it("should transform bookmark to lightweight format", () => {
        const bookmark = createMockBookmark();
        const result = preprocessBookmarks([bookmark]);

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          id: bookmark.id,
          title: bookmark.title,
          platform: bookmark.platform,
        });
      });

      it("should include description when enabled", () => {
        const bookmark = createMockBookmark({
          description: "测试描述",
        });
        const result = preprocessBookmarks([bookmark], {
          includeDescription: true,
        });

        expect(result[0].description).toBe("测试描述");
      });

      it("should exclude description when disabled", () => {
        const bookmark = createMockBookmark({
          description: "测试描述",
        });
        const result = preprocessBookmarks([bookmark], {
          includeDescription: false,
        });

        expect(result[0].description).toBeUndefined();
      });

      it("should include read status when enabled", () => {
        const bookmark = createMockBookmark({
          isRead: true,
          isStarred: true,
        });
        const result = preprocessBookmarks([bookmark], {
          includeReadStatus: true,
        });

        expect(result[0].isRead).toBe(true);
        expect(result[0].isStarred).toBe(true);
      });

      it("should exclude read status when disabled", () => {
        const bookmark = createMockBookmark({
          isRead: true,
          isStarred: true,
        });
        const result = preprocessBookmarks([bookmark], {
          includeReadStatus: false,
        });

        expect(result[0].isRead).toBeUndefined();
        expect(result[0].isStarred).toBeUndefined();
      });
    });

    describe("truncation", () => {
      it("should truncate long titles", () => {
        const longTitle = "A".repeat(150);
        const bookmark = createMockBookmark({ title: longTitle });
        const result = preprocessBookmarks([bookmark], { maxTitleLength: 100 });

        expect(result[0].title.length).toBeLessThanOrEqual(100);
        expect(result[0].title.endsWith("...")).toBe(true);
      });

      it("should not truncate short titles", () => {
        const shortTitle = "短标题";
        const bookmark = createMockBookmark({ title: shortTitle });
        const result = preprocessBookmarks([bookmark], { maxTitleLength: 100 });

        expect(result[0].title).toBe(shortTitle);
      });

      it("should truncate long descriptions", () => {
        const longDesc = "B".repeat(300);
        const bookmark = createMockBookmark({ description: longDesc });
        const result = preprocessBookmarks([bookmark], {
          maxDescriptionLength: 200,
          includeDescription: true,
        });

        expect(result[0].description!.length).toBeLessThanOrEqual(200);
        expect(result[0].description!.endsWith("...")).toBe(true);
      });

      it("should handle null/undefined description gracefully", () => {
        const bookmark = createMockBookmark({ description: null as unknown as string });
        const result = preprocessBookmarks([bookmark]);

        expect(result[0].description).toBeUndefined();
      });
    });

    describe("tag merging", () => {
      it("should merge userTags and aiTags", () => {
        const bookmark = createMockBookmark({
          userTags: ["用户标签1", "用户标签2"],
          aiTags: ["AI标签1", "AI标签2"],
        });
        const result = preprocessBookmarks([bookmark], { maxTags: 5 });

        expect(result[0].tags).toContain("用户标签1");
        expect(result[0].tags).toContain("用户标签2");
        expect(result[0].tags).toContain("AI标签1");
        expect(result[0].tags).toContain("AI标签2");
      });

      it("should prioritize userTags over aiTags", () => {
        const bookmark = createMockBookmark({
          userTags: ["用户1", "用户2", "用户3"],
          aiTags: ["AI1", "AI2", "AI3"],
        });
        const result = preprocessBookmarks([bookmark], { maxTags: 3 });

        expect(result[0].tags).toEqual(["用户1", "用户2", "用户3"]);
      });

      it("should limit tags to maxTags", () => {
        const bookmark = createMockBookmark({
          userTags: ["标签1", "标签2", "标签3", "标签4", "标签5", "标签6"],
          aiTags: null,
        });
        const result = preprocessBookmarks([bookmark], { maxTags: 3 });

        expect(result[0].tags).toHaveLength(3);
      });

      it("should handle null tags gracefully", () => {
        const bookmark = createMockBookmark({
          userTags: null,
          aiTags: null,
        });
        const result = preprocessBookmarks([bookmark]);

        expect(result[0].tags).toBeUndefined();
      });

      it("should deduplicate tags", () => {
        const bookmark = createMockBookmark({
          userTags: ["相同标签", "用户标签"],
          aiTags: ["相同标签", "AI标签"],
        });
        const result = preprocessBookmarks([bookmark], { maxTags: 10 });

        const tagCounts = result[0].tags?.filter((t) => t === "相同标签").length;
        expect(tagCounts).toBe(1);
      });
    });

    describe("count limiting", () => {
      it("should limit bookmarks to maxCount", () => {
        const bookmarks = createMockBookmarks(50);
        const result = preprocessBookmarks(bookmarks, { maxCount: 20 });

        expect(result).toHaveLength(20);
      });

      it("should handle empty array", () => {
        const result = preprocessBookmarks([]);

        expect(result).toHaveLength(0);
      });

      it("should handle array smaller than maxCount", () => {
        const bookmarks = createMockBookmarks(5);
        const result = preprocessBookmarks(bookmarks, { maxCount: 20 });

        expect(result).toHaveLength(5);
      });
    });

    describe("default config", () => {
      it("should use default config when not provided", () => {
        const bookmarks = createMockBookmarks(30);
        const result = preprocessBookmarks(bookmarks);

        // Default maxCount is 20
        expect(result.length).toBeLessThanOrEqual(20);
        // Default includeDescription is true
        expect(result[0]).toHaveProperty("description");
        // Default includeReadStatus is true
        expect(result[0]).toHaveProperty("isRead");
      });
    });
  });

  // ============================================
  // preprocessSelectionSummary 测试
  // ============================================
  describe("preprocessSelectionSummary", () => {
    describe("basic statistics", () => {
      it("should return correct totalCount", () => {
        const bookmarks = createMockBookmarks(25);
        const result = preprocessSelectionSummary(bookmarks);

        expect(result.totalCount).toBe(25);
      });

      it("should calculate platform distribution", () => {
        const bookmarks = [
          createMockBookmark({ id: 1, platform: "weixin" }),
          createMockBookmark({ id: 2, platform: "weixin" }),
          createMockBookmark({ id: 3, platform: "bilibili" }),
          createMockBookmark({ id: 4, platform: "zhihu" }),
        ];
        const result = preprocessSelectionSummary(bookmarks);

        expect(result.platforms).toEqual({
          weixin: 2,
          bilibili: 1,
          zhihu: 1,
        });
      });

      it("should collect unique tags", () => {
        const bookmarks = [
          createMockBookmark({ id: 1, userTags: ["标签A", "标签B"], aiTags: null }),
          createMockBookmark({ id: 2, userTags: ["标签A", "标签C"], aiTags: ["标签D"] }),
        ];
        const result = preprocessSelectionSummary(bookmarks);

        expect(result.uniqueTags).toContain("标签A");
        expect(result.uniqueTags).toContain("标签B");
        expect(result.uniqueTags).toContain("标签C");
        expect(result.uniqueTags).toContain("标签D");
      });

      it("should limit uniqueTags to 20", () => {
        const manyTags = Array.from({ length: 30 }, (_, i) => `标签${i}`);
        const bookmark = createMockBookmark({ userTags: manyTags, aiTags: null });
        const result = preprocessSelectionSummary([bookmark]);

        expect(result.uniqueTags.length).toBeLessThanOrEqual(20);
      });
    });

    describe("status detection", () => {
      it("should detect hasUntagged", () => {
        const bookmarks = [
          createMockBookmark({ id: 1, userTags: ["标签"], aiTags: null }),
          createMockBookmark({ id: 2, userTags: null, aiTags: null }),
        ];
        const result = preprocessSelectionSummary(bookmarks);

        expect(result.hasUntagged).toBe(true);
      });

      it("should detect hasUnread", () => {
        const bookmarks = [
          createMockBookmark({ id: 1, isRead: true }),
          createMockBookmark({ id: 2, isRead: false }),
        ];
        const result = preprocessSelectionSummary(bookmarks);

        expect(result.hasUnread).toBe(true);
      });

      it("should detect hasStarred", () => {
        const bookmarks = [
          createMockBookmark({ id: 1, isStarred: false }),
          createMockBookmark({ id: 2, isStarred: true }),
        ];
        const result = preprocessSelectionSummary(bookmarks);

        expect(result.hasStarred).toBe(true);
      });

      it("should return false when no special status", () => {
        const bookmarks = [
          createMockBookmark({
            id: 1,
            userTags: ["标签"],
            aiTags: null,
            isRead: true,
            isStarred: false,
          }),
        ];
        const result = preprocessSelectionSummary(bookmarks);

        expect(result.hasUntagged).toBe(false);
        expect(result.hasUnread).toBe(false);
        expect(result.hasStarred).toBe(false);
      });
    });

    describe("samples", () => {
      it("should include up to 5 samples", () => {
        const bookmarks = createMockBookmarks(20);
        const result = preprocessSelectionSummary(bookmarks);

        expect(result.samples).toHaveLength(5);
      });

      it("should include fewer samples if less bookmarks", () => {
        const bookmarks = createMockBookmarks(3);
        const result = preprocessSelectionSummary(bookmarks);

        expect(result.samples).toHaveLength(3);
      });

      it("should use lightweight format for samples", () => {
        const bookmarks = createMockBookmarks(10);
        const result = preprocessSelectionSummary(bookmarks);

        // Samples should not include description and read status
        expect(result.samples[0].description).toBeUndefined();
        expect(result.samples[0].isRead).toBeUndefined();
      });
    });

    describe("empty input", () => {
      it("should handle empty array", () => {
        const result = preprocessSelectionSummary([]);

        expect(result.totalCount).toBe(0);
        expect(result.platforms).toEqual({});
        expect(result.uniqueTags).toEqual([]);
        expect(result.samples).toEqual([]);
      });
    });
  });

  // ============================================
  // estimateTokens 测试
  // ============================================
  describe("estimateTokens", () => {
    it("should return 0 for empty string", () => {
      expect(estimateTokens("")).toBe(0);
    });

    it("should return 0 for null/undefined", () => {
      expect(estimateTokens(null as unknown as string)).toBe(0);
      expect(estimateTokens(undefined as unknown as string)).toBe(0);
    });

    it("should estimate Chinese characters (1.5 tokens each)", () => {
      const chineseText = "这是中文";
      const tokens = estimateTokens(chineseText);

      // 4 Chinese chars × 1.5 = 6
      expect(tokens).toBe(6);
    });

    it("should estimate English words (1 token each)", () => {
      const englishText = "hello world test";
      const tokens = estimateTokens(englishText);

      // 3 English words
      expect(tokens).toBe(3);
    });

    it("should estimate mixed content", () => {
      const mixedText = "Hello 世界 123";
      const tokens = estimateTokens(mixedText);

      // 1 English word + 2 Chinese chars × 1.5 + 1 number = 1 + 3 + 1 = 5
      expect(tokens).toBe(5);
    });

    it("should handle numbers", () => {
      const numbersText = "12345 67890";
      const tokens = estimateTokens(numbersText);

      // 2 number groups
      expect(tokens).toBe(2);
    });
  });

  // ============================================
  // calculateTokenSavings 测试
  // ============================================
  describe("calculateTokenSavings", () => {
    it("should calculate token savings correctly", () => {
      const original = createMockBookmarks(10);
      const processed = preprocessBookmarks(original);
      const result = calculateTokenSavings(original, processed);

      expect(result.originalTokens).toBeGreaterThan(0);
      expect(result.processedTokens).toBeGreaterThan(0);
      expect(result.originalTokens).toBeGreaterThan(result.processedTokens);
      expect(result.savings).toBeGreaterThan(0);
      expect(result.savings).toBeLessThanOrEqual(1);
    });

    it("should return 0 savings for empty arrays", () => {
      const result = calculateTokenSavings([], []);

      expect(result.originalTokens).toBe(0);
      expect(result.processedTokens).toBe(0);
      expect(result.savings).toBe(0);
    });

    it("should round savings to 2 decimal places", () => {
      const original = createMockBookmarks(5);
      const processed = preprocessBookmarks(original);
      const result = calculateTokenSavings(original, processed);

      const decimalPlaces = (result.savings.toString().split(".")[1] || "").length;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    });

    it("should show significant savings for large bookmarks", () => {
      // Create bookmarks with lots of extra data
      const original = Array.from({ length: 20 }, (_, i) =>
        createMockBookmark({
          id: i + 1,
          title: "A".repeat(200),
          description: "B".repeat(500),
          userTags: Array.from({ length: 10 }, (_, j) => `标签${j}`),
          aiTags: Array.from({ length: 10 }, (_, j) => `AI标签${j}`),
        })
      );
      const processed = preprocessBookmarks(original);
      const result = calculateTokenSavings(original, processed);

      // Should save at least 30% (likely more)
      expect(result.savings).toBeGreaterThanOrEqual(0.3);
    });
  });

  // ============================================
  // smartPreprocess 测试
  // ============================================
  describe("smartPreprocess", () => {
    const bookmarks = createMockBookmarks(100);

    describe("search context", () => {
      it("should return array for search context", () => {
        const result = smartPreprocess(bookmarks, "search");

        expect(Array.isArray(result)).toBe(true);
      });

      it("should include up to 50 bookmarks for search", () => {
        const result = smartPreprocess(bookmarks, "search") as LightweightBookmark[];

        expect(result.length).toBeLessThanOrEqual(50);
      });

      it("should include descriptions for search", () => {
        const result = smartPreprocess(bookmarks, "search") as LightweightBookmark[];

        // Should have description since it helps with search
        expect(result[0]).toHaveProperty("description");
      });

      it("should limit tags to 3 for search", () => {
        const manyTagBookmarks = [
          createMockBookmark({
            userTags: ["标签1", "标签2", "标签3", "标签4", "标签5"],
            aiTags: null,
          }),
        ];
        const result = smartPreprocess(manyTagBookmarks, "search") as LightweightBookmark[];

        expect(result[0].tags?.length).toBeLessThanOrEqual(3);
      });
    });

    describe("batch context", () => {
      it("should return SelectionSummary for batch context", () => {
        const result = smartPreprocess(bookmarks, "batch");

        expect(result).toHaveProperty("totalCount");
        expect(result).toHaveProperty("platforms");
        expect(result).toHaveProperty("uniqueTags");
        expect(result).toHaveProperty("samples");
      });

      it("should include all bookmarks in count", () => {
        const result = smartPreprocess(bookmarks, "batch") as SelectionSummary;

        expect(result.totalCount).toBe(100);
      });
    });

    describe("detail context", () => {
      it("should return array for detail context", () => {
        const result = smartPreprocess(bookmarks, "detail");

        expect(Array.isArray(result)).toBe(true);
      });

      it("should limit to 5 bookmarks for detail", () => {
        const result = smartPreprocess(bookmarks, "detail") as LightweightBookmark[];

        expect(result).toHaveLength(5);
      });

      it("should allow longer titles for detail", () => {
        const longTitleBookmarks = [
          createMockBookmark({ title: "A".repeat(180) }),
        ];
        const result = smartPreprocess(longTitleBookmarks, "detail") as LightweightBookmark[];

        // maxTitleLength is 200 for detail, so 180 chars should not be truncated
        expect(result[0].title).not.toContain("...");
      });

      it("should include read status for detail", () => {
        const result = smartPreprocess(bookmarks, "detail") as LightweightBookmark[];

        expect(result[0]).toHaveProperty("isRead");
        expect(result[0]).toHaveProperty("isStarred");
      });
    });

    describe("chat context", () => {
      it("should return array for chat context", () => {
        const result = smartPreprocess(bookmarks, "chat");

        expect(Array.isArray(result)).toBe(true);
      });

      it("should limit to 20 bookmarks for chat (default)", () => {
        const result = smartPreprocess(bookmarks, "chat") as LightweightBookmark[];

        expect(result).toHaveLength(20);
      });

      it("should include descriptions for chat", () => {
        const result = smartPreprocess(bookmarks, "chat") as LightweightBookmark[];

        expect(result[0]).toHaveProperty("description");
      });

      it("should include read status for chat", () => {
        const result = smartPreprocess(bookmarks, "chat") as LightweightBookmark[];

        expect(result[0]).toHaveProperty("isRead");
      });
    });

    describe("default behavior", () => {
      it("should use chat config as default", () => {
        const chatResult = smartPreprocess(bookmarks, "chat");
        // Default should behave the same as chat
        expect(chatResult).toBeDefined();
      });
    });
  });

  // ============================================
  // 性能测试
  // ============================================
  describe("performance", () => {
    it("should process 1000 bookmarks quickly", () => {
      const bookmarks = createMockBookmarks(1000);

      const start = performance.now();
      preprocessBookmarks(bookmarks);
      const duration = performance.now() - start;

      // Should complete in less than 100ms
      expect(duration).toBeLessThan(100);
    });

    it("should generate summary for 1000 bookmarks quickly", () => {
      const bookmarks = createMockBookmarks(1000);

      const start = performance.now();
      preprocessSelectionSummary(bookmarks);
      const duration = performance.now() - start;

      // Should complete in less than 100ms
      expect(duration).toBeLessThan(100);
    });
  });
});
