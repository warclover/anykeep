/**
 * ResponseFormatter 单元测试
 */

import {
  ResponseFormatter,
  createResponseFormatter,
  formatSearchResponse,
  type BookmarkData,
} from "../response-formatter";
import type { ParsedQuery, RankedResult } from "../types";

describe("ResponseFormatter", () => {
  let formatter: ResponseFormatter;

  // 创建测试用的 ParsedQuery
  const createQuery = (
    keywords: string[],
    options: Partial<ParsedQuery> = {},
  ): ParsedQuery => ({
    original: keywords.join(" "),
    keywords,
    fuzzyLevel: "phrase",
    searchIntent: "find_specific",
    hasReference: false,
    confidence: 0.8,
    ...options,
  });

  // 创建测试用的 RankedResult
  const createRankedResult = (
    id: number,
    score: number,
    relevance: "high" | "medium" | "low" = "medium",
  ): RankedResult => ({
    bookmarkId: id,
    score,
    relevance,
  });

  // 创建测试用的 BookmarkData
  const createBookmark = (
    id: number,
    title: string,
    options: Partial<BookmarkData> = {},
  ): BookmarkData => ({
    id,
    title,
    url: `https://example.com/${id}`,
    platform: "wechat",
    createdAt: new Date(),
    ...options,
  });

  beforeEach(() => {
    formatter = new ResponseFormatter();
  });

  describe("基本格式化", () => {
    it("应该正确格式化搜索结果", () => {
      const rankedResults = [createRankedResult(1, 80, "high")];
      const bookmarks = new Map([[1, createBookmark(1, "React 教程")]]);
      const query = createQuery(["React"]);

      const response = formatter.format(rankedResults, bookmarks, query, 50);

      expect(response.results).toHaveLength(1);
      expect(response.results[0].title).toBe("React 教程");
      expect(response.meta.totalCount).toBe(1);
      expect(response.meta.queryTimeMs).toBe(50);
    });

    it("应该处理空结果", () => {
      const rankedResults: RankedResult[] = [];
      const bookmarks = new Map<number, BookmarkData>();
      const query = createQuery(["React"]);

      const response = formatter.format(rankedResults, bookmarks, query, 10);

      expect(response.results).toHaveLength(0);
      expect(response.responseText).toContain("没有找到");
      expect(response.suggestions).toBeDefined();
    });

    it("应该限制返回结果数量", () => {
      const formatter = new ResponseFormatter({ maxResults: 5 });
      const rankedResults = Array.from({ length: 10 }, (_, i) =>
        createRankedResult(i + 1, 80 - i, "medium"),
      );
      const bookmarks = new Map(
        rankedResults.map((r) => [
          r.bookmarkId,
          createBookmark(r.bookmarkId, `文章 ${r.bookmarkId}`),
        ]),
      );
      const query = createQuery(["测试"]);

      const response = formatter.format(rankedResults, bookmarks, query, 30);

      expect(response.results).toHaveLength(5);
      expect(response.meta.totalCount).toBe(10);
      expect(response.meta.hasMore).toBe(true);
    });
  });

  describe("摘要格式化", () => {
    it("应该高亮关键词", () => {
      const rankedResults = [createRankedResult(1, 80)];
      const bookmarks = new Map([
        [
          1,
          createBookmark(1, "教程", {
            summary: "这是一篇关于 React 的教程",
          }),
        ],
      ]);
      const query = createQuery(["React"]);

      const response = formatter.format(rankedResults, bookmarks, query, 10);

      expect(response.results[0].summary).toContain("**React**");
    });

    it("应该截断过长的摘要", () => {
      const formatter = new ResponseFormatter({ summaryMaxLength: 50 });
      const longSummary = "a".repeat(200);
      const rankedResults = [createRankedResult(1, 80)];
      const bookmarks = new Map([
        [1, createBookmark(1, "文章", { summary: longSummary })],
      ]);
      const query = createQuery(["测试"]);

      const response = formatter.format(rankedResults, bookmarks, query, 10);

      expect(response.results[0].summary!.length).toBeLessThanOrEqual(53); // 50 + "..."
    });

    it("应该在关键词附近截断", () => {
      const formatter = new ResponseFormatter({ summaryMaxLength: 100 });
      const longSummary =
        "a".repeat(100) + " React 是一个很好的框架 " + "b".repeat(100);
      const rankedResults = [createRankedResult(1, 80)];
      const bookmarks = new Map([
        [1, createBookmark(1, "文章", { summary: longSummary })],
      ]);
      const query = createQuery(["React"]);

      const response = formatter.format(rankedResults, bookmarks, query, 10);

      // 应该包含关键词
      expect(response.results[0].summary).toContain("React");
    });
  });

  describe("平台名称格式化", () => {
    it("应该转换平台代码为显示名称", () => {
      const platforms = [
        { code: "wechat", display: "微信公众号" },
        { code: "bilibili", display: "B站" },
        { code: "xiaohongshu", display: "小红书" },
        { code: "zhihu", display: "知乎" },
        { code: "juejin", display: "掘金" },
        { code: "csdn", display: "CSDN" },
        { code: "browser", display: "浏览器书签" },
      ];

      for (const { code, display } of platforms) {
        const rankedResults = [createRankedResult(1, 80)];
        const bookmarks = new Map([
          [1, createBookmark(1, "文章", { platform: code })],
        ]);
        const query = createQuery(["测试"]);

        const response = formatter.format(rankedResults, bookmarks, query, 10);

        expect(response.results[0].platform).toBe(display);
      }
    });

    it("未知平台应保留原值", () => {
      const rankedResults = [createRankedResult(1, 80)];
      const bookmarks = new Map([
        [1, createBookmark(1, "文章", { platform: "custom_platform" })],
      ]);
      const query = createQuery(["测试"]);

      const response = formatter.format(rankedResults, bookmarks, query, 10);

      expect(response.results[0].platform).toBe("custom_platform");
    });
  });

  describe("响应文本生成", () => {
    it("高相关度结果应显示在最前", () => {
      const rankedResults = [
        createRankedResult(1, 90, "high"),
        createRankedResult(2, 60, "medium"),
        createRankedResult(3, 30, "low"),
      ];
      const bookmarks = new Map([
        [1, createBookmark(1, "高相关文章")],
        [2, createBookmark(2, "中相关文章")],
        [3, createBookmark(3, "低相关文章")],
      ]);
      const query = createQuery(["测试"]);

      const response = formatter.format(rankedResults, bookmarks, query, 10);

      expect(response.responseText).toContain("最相关的结果");
      expect(response.responseText).toContain("高相关文章");
    });

    it("详细模式应包含更多信息", () => {
      const formatter = new ResponseFormatter({ responseStyle: "detailed" });
      const rankedResults = [createRankedResult(1, 80)];
      const bookmarks = new Map([
        [
          1,
          createBookmark(1, "文章", {
            platform: "wechat",
          }),
        ],
      ]);
      const query = createQuery(["测试"], {
        timeRange: {
          start: new Date(),
          end: new Date(),
          original: "最近一周",
        },
        platform: "wechat",
      });

      const response = formatter.format(rankedResults, bookmarks, query, 100);

      expect(response.responseText).toContain("100ms");
    });

    it("应该提示还有更多结果", () => {
      const formatter = new ResponseFormatter({ maxResults: 2 });
      const rankedResults = [
        createRankedResult(1, 80),
        createRankedResult(2, 70),
        createRankedResult(3, 60),
      ];
      const bookmarks = new Map([
        [1, createBookmark(1, "文章1")],
        [2, createBookmark(2, "文章2")],
        [3, createBookmark(3, "文章3")],
      ]);
      const query = createQuery(["测试"]);

      const response = formatter.format(rankedResults, bookmarks, query, 10);

      expect(response.responseText).toContain("还有");
    });
  });

  describe("空结果建议", () => {
    it("有时间范围时应建议放宽", () => {
      const query = createQuery(["测试"], {
        timeRange: {
          start: new Date(),
          end: new Date(),
          original: "今天",
        },
      });

      const response = formatter.format([], new Map(), query, 10);

      expect(response.suggestions).toContain(
        "尝试放宽时间范围，查看更多历史内容",
      );
    });

    it("多关键词时应建议减少", () => {
      const query = createQuery(["关键词1", "关键词2", "关键词3"]);

      const response = formatter.format([], new Map(), query, 10);

      expect(response.suggestions).toContain(
        "尝试减少搜索关键词，使用更通用的词汇",
      );
    });

    it("有平台过滤时应建议取消", () => {
      const query = createQuery(["测试"], { platform: "wechat" });

      const response = formatter.format([], new Map(), query, 10);

      expect(response.suggestions).toContain("尝试搜索所有平台的内容");
    });

    it("长关键词时应建议缩短", () => {
      const query = createQuery(["这是一个很长的关键词"]);

      const response = formatter.format([], new Map(), query, 10);

      expect(response.suggestions).toContain("尝试使用更短的关键词");
    });
  });

  describe("调试信息", () => {
    it("includeDebugInfo 为 true 时应包含解析后的查询", () => {
      const formatter = new ResponseFormatter({ includeDebugInfo: true });
      const rankedResults = [createRankedResult(1, 80)];
      const bookmarks = new Map([[1, createBookmark(1, "文章")]]);
      const query = createQuery(["测试"]);

      const response = formatter.format(rankedResults, bookmarks, query, 10);

      expect(response.meta.parsedQuery).toBeDefined();
      expect(response.meta.parsedQuery?.keywords).toEqual(["测试"]);
    });

    it("includeDebugInfo 为 false 时不应包含解析后的查询", () => {
      const formatter = new ResponseFormatter({ includeDebugInfo: false });
      const rankedResults = [createRankedResult(1, 80)];
      const bookmarks = new Map([[1, createBookmark(1, "文章")]]);
      const query = createQuery(["测试"]);

      const response = formatter.format(rankedResults, bookmarks, query, 10);

      expect(response.meta.parsedQuery).toBeUndefined();
    });
  });

  describe("工厂函数和便捷方法", () => {
    it("createResponseFormatter 应创建实例", () => {
      const formatter = createResponseFormatter({ maxResults: 10 });
      expect(formatter).toBeInstanceOf(ResponseFormatter);
    });

    it("formatSearchResponse 应使用默认配置", () => {
      const rankedResults = [createRankedResult(1, 80)];
      const bookmarks = new Map([[1, createBookmark(1, "文章")]]);
      const query = createQuery(["测试"]);

      const response = formatSearchResponse(
        rankedResults,
        bookmarks,
        query,
        10,
      );

      expect(response.results).toHaveLength(1);
    });
  });
});
