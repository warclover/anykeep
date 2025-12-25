/**
 * ReferenceResolver 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import type { ReferenceResolver } from "../index";
import {
  createReferenceResolver,
  type ConversationState,
  type MentionedEntity,
} from "../index";

describe("ReferenceResolver", () => {
  let resolver: ReferenceResolver;

  // 创建测试用的会话状态
  const createState = (
    overrides: Partial<ConversationState> = {},
  ): ConversationState => ({
    conversationId: "conv-1",
    userId: "user-1",
    messages: [],
    mentionedBookmarks: [],
    mentionedFolders: [],
    mentionedTags: [],
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    ...overrides,
  });

  const createBookmark = (id: number, name: string): MentionedEntity => ({
    type: "bookmark",
    id,
    name,
    mentionedAt: Date.now(),
  });

  const createFolder = (id: number, name: string): MentionedEntity => ({
    type: "folder",
    id,
    name,
    mentionedAt: Date.now(),
  });

  beforeEach(() => {
    resolver = createReferenceResolver();
  });

  describe("hasReferences", () => {
    it("should detect '刚才' reference", () => {
      expect(resolver.hasReferences("把刚才的导出成PDF")).toBe(true);
    });

    it("should detect '这些' reference", () => {
      expect(resolver.hasReferences("这些内容都很有用")).toBe(true);
    });

    it("should detect '那个文件夹' reference", () => {
      expect(resolver.hasReferences("移动到那个文件夹")).toBe(true);
    });

    it("should detect '那篇文章' reference", () => {
      expect(resolver.hasReferences("我要看那篇文章")).toBe(true);
    });

    it("should detect '上一个' reference", () => {
      expect(resolver.hasReferences("打开上一个")).toBe(true);
    });

    it("should return false for text without references", () => {
      expect(resolver.hasReferences("搜索关于AI的文章")).toBe(false);
    });
  });

  describe("detectReferences", () => {
    it("should detect multiple references", () => {
      const input = "把刚才的这些内容导出到那个文件夹";
      const detected = resolver.detectReferences(input);

      expect(detected.length).toBeGreaterThanOrEqual(2);
      expect(detected.some((d) => d.includes("刚才"))).toBe(true);
    });

    it("should not duplicate same reference", () => {
      const input = "刚才的和刚才那个";
      const detected = resolver.detectReferences(input);

      // 应该检测到两个不同的匹配
      expect(detected.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("resolve - 刚才/刚刚", () => {
    it("should resolve '刚才的' to lastOutput", () => {
      const state = createState({
        lastOutput: {
          type: "text",
          summary: "找到 5 篇关于 AI 的文章",
          relatedEntityIds: [1, 2, 3],
          outputAt: Date.now(),
        },
      });

      const result = resolver.resolve("把刚才的导出", state);

      expect(result.references.length).toBe(1);
      expect(result.references[0].type).toBe("last_output");
      expect(result.references[0].resolvedEntities.length).toBe(3);
    });

    it("should handle missing lastOutput", () => {
      const state = createState();

      const result = resolver.resolve("把刚才的导出", state);

      expect(result.hasUnresolvedReferences).toBe(true);
      expect(result.unresolvedReferences).toContain("刚才的");
    });
  });

  describe("resolve - 这些/这几个", () => {
    it("should resolve '这些内容' to lastSearchResults", () => {
      const state = createState({
        lastSearchResults: {
          query: "AI articles",
          resultCount: 3,
          resultIds: [10, 20, 30],
          searchedAt: Date.now(),
        },
      });

      const result = resolver.resolve("这些内容都很有用", state);

      expect(result.references.length).toBe(1);
      expect(result.references[0].type).toBe("these_results");
      expect(result.references[0].resolvedEntities.length).toBe(3);
      expect(result.references[0].resolvedEntities[0].id).toBe(10);
    });

    it("should resolve '这几个' variants", () => {
      const state = createState({
        lastSearchResults: {
          query: "test",
          resultCount: 2,
          resultIds: [1, 2],
          searchedAt: Date.now(),
        },
      });

      const result = resolver.resolve("这几篇文章", state);

      expect(result.references.length).toBe(1);
      expect(result.references[0].type).toBe("these_results");
    });
  });

  describe("resolve - 那个文件夹", () => {
    it("should resolve '那个文件夹' to mentionedFolders", () => {
      const state = createState({
        mentionedFolders: [createFolder(1, "工作"), createFolder(2, "学习")],
      });

      const result = resolver.resolve("移动到那个文件夹", state);

      expect(result.references.length).toBe(1);
      expect(result.references[0].type).toBe("that_folder");
      // 应该返回最后一个提及的文件夹
      expect(result.references[0].resolvedEntities[0].name).toBe("学习");
    });

    it("should handle empty mentionedFolders", () => {
      const state = createState();

      const result = resolver.resolve("移动到那个文件夹", state);

      expect(result.hasUnresolvedReferences).toBe(true);
    });
  });

  describe("resolve - 那篇文章", () => {
    it("should resolve '那篇文章' to mentionedBookmarks", () => {
      const state = createState({
        mentionedBookmarks: [
          createBookmark(100, "AI 入门指南"),
          createBookmark(200, "机器学习实战"),
        ],
      });

      const result = resolver.resolve("我要看那篇文章", state);

      expect(result.references.length).toBe(1);
      expect(result.references[0].type).toBe("that_bookmark");
      expect(result.references[0].resolvedEntities[0].name).toBe(
        "机器学习实战",
      );
    });
  });

  describe("resolve - 上一个", () => {
    it("should resolve '上一个' to last search result", () => {
      const state = createState({
        lastSearchResults: {
          query: "test",
          resultCount: 3,
          resultIds: [1, 2, 3],
          searchedAt: Date.now(),
        },
      });

      const result = resolver.resolve("打开上一个", state);

      expect(result.references.length).toBe(1);
      expect(result.references[0].type).toBe("previous");
      expect(result.references[0].resolvedEntities[0].id).toBe(3);
    });

    it("should fallback to mentionedBookmarks if no search results", () => {
      const state = createState({
        mentionedBookmarks: [createBookmark(50, "最近的文章")],
      });

      const result = resolver.resolve("上一篇文章", state);

      expect(result.references.length).toBe(1);
      expect(result.references[0].resolvedEntities[0].id).toBe(50);
    });
  });

  describe("resolve - 提到的/说过的", () => {
    it("should resolve '提到的' to most recent mentioned entity", () => {
      const now = Date.now();
      const state = createState({
        mentionedBookmarks: [
          { ...createBookmark(1, "旧文章"), mentionedAt: now - 1000 },
        ],
        mentionedFolders: [
          { ...createFolder(2, "新文件夹"), mentionedAt: now },
        ],
      });

      const result = resolver.resolve("打开之前提到的", state);

      expect(result.references.length).toBe(1);
      expect(result.references[0].type).toBe("mentioned");
      // 应该返回最近提及的（文件夹）
      expect(result.references[0].resolvedEntities[0].name).toBe("新文件夹");
    });
  });

  describe("resolvedInput", () => {
    it("should replace reference with entity name", () => {
      const state = createState({
        mentionedBookmarks: [createBookmark(1, "AI 入门")],
      });

      const result = resolver.resolve("打开那篇", state);

      expect(result.resolvedInput).toContain('"AI 入门"');
      expect(result.resolvedInput).not.toContain("那篇");
    });

    it("should replace reference with ID list for multiple entities", () => {
      const state = createState({
        lastSearchResults: {
          query: "test",
          resultCount: 2,
          resultIds: [1, 2],
          searchedAt: Date.now(),
        },
      });

      const result = resolver.resolve("导出这些内容", state);

      expect(result.resolvedInput).toContain("[ID: 1,2]");
    });
  });

  describe("confidence", () => {
    it("should have higher confidence with more context", () => {
      const stateWithContext = createState({
        lastOutput: {
          type: "text",
          summary: "结果",
          relatedEntityIds: [1],
          outputAt: Date.now(),
        },
        lastSearchResults: {
          query: "test",
          resultCount: 1,
          resultIds: [1],
          searchedAt: Date.now(),
        },
        mentionedBookmarks: [createBookmark(1, "文章")],
      });

      const stateMinimal = createState({
        lastOutput: {
          type: "text",
          summary: "结果",
          outputAt: Date.now(),
        },
      });

      const resultWithContext = resolver.resolve("刚才的", stateWithContext);
      const resultMinimal = resolver.resolve("刚才的", stateMinimal);

      expect(resultWithContext.references[0].confidence).toBeGreaterThan(
        resultMinimal.references[0].confidence,
      );
    });
  });

  describe("configuration", () => {
    it("should filter by minConfidence", () => {
      const highThresholdResolver = createReferenceResolver({
        minConfidence: 0.95, // 非常高的阈值
      });

      const state = createState({
        lastOutput: {
          type: "text",
          summary: "结果",
          outputAt: Date.now(),
        },
      });

      const result = highThresholdResolver.resolve("刚才的", state);

      // 应该被过滤掉
      expect(result.hasUnresolvedReferences).toBe(true);
    });

    it("should update config", () => {
      resolver.updateConfig({ minConfidence: 0.8 });

      const config = resolver.getConfig();
      expect(config.minConfidence).toBe(0.8);
    });
  });

  describe("explanation", () => {
    it("should generate explanation for resolved reference", () => {
      const state = createState({
        mentionedFolders: [createFolder(1, "工作文件夹")],
      });

      const result = resolver.resolve("移动到那个文件夹", state);

      expect(result.references[0].explanation).toContain("文件夹");
      expect(result.references[0].explanation).toContain("工作文件夹");
    });
  });

  describe("edge cases", () => {
    it("should handle empty input", () => {
      const state = createState();
      const result = resolver.resolve("", state);

      expect(result.references).toEqual([]);
      expect(result.hasUnresolvedReferences).toBe(false);
    });

    it("should handle input with no references", () => {
      const state = createState();
      const result = resolver.resolve("搜索关于AI的文章", state);

      expect(result.references).toEqual([]);
      expect(result.resolvedInput).toBe("搜索关于AI的文章");
    });

    it("should handle multiple references in one input", () => {
      const state = createState({
        lastSearchResults: {
          query: "test",
          resultCount: 2,
          resultIds: [1, 2],
          searchedAt: Date.now(),
        },
        mentionedFolders: [createFolder(10, "目标文件夹")],
      });

      const result = resolver.resolve("把这些内容移动到那个文件夹", state);

      expect(result.references.length).toBe(2);
    });
  });
});
