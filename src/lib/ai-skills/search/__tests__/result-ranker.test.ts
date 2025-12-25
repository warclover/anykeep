/**
 * ResultRanker 单元测试
 */

import {
  ResultRanker,
  createResultRanker,
  rankResults,
  type BookmarkForRanking,
} from "../result-ranker";
import type { ParsedQuery } from "../types";

describe("ResultRanker", () => {
  let ranker: ResultRanker;

  // 创建测试用的 ParsedQuery
  const createQuery = (
    keywords: string[],
    timeRange?: { start: Date; end: Date },
  ): ParsedQuery => ({
    original: keywords.join(" "),
    keywords,
    timeRange: timeRange ? { ...timeRange, original: "test" } : undefined,
    fuzzyLevel: "phrase",
    searchIntent: "find_specific",
    hasReference: false,
    confidence: 0.8,
  });

  // 创建测试用的书签
  const createBookmark = (
    id: number,
    title: string,
    options: Partial<BookmarkForRanking> = {},
  ): BookmarkForRanking => ({
    id,
    title,
    createdAt: new Date(),
    ...options,
  });

  beforeEach(() => {
    ranker = new ResultRanker();
  });

  describe("基本排序", () => {
    it("应该返回排序后的结果", () => {
      const bookmarks = [
        createBookmark(1, "React 入门教程"),
        createBookmark(2, "Vue.js 基础"),
        createBookmark(3, "React 高级技巧"),
      ];
      const query = createQuery(["React"]);

      const results = ranker.rank(bookmarks, query);

      expect(results).toHaveLength(3);
      expect(results[0].bookmarkId).toBe(1); // 或 3，取决于其他因子
      expect(results[0].score).toBeGreaterThan(0);
    });

    it("应该按得分降序排序", () => {
      const bookmarks = [
        createBookmark(1, "无关内容"),
        createBookmark(2, "React 教程"),
        createBookmark(3, "深入 React"),
      ];
      const query = createQuery(["React"]);

      const results = ranker.rank(bookmarks, query);

      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it("应该处理空书签列表", () => {
      const query = createQuery(["React"]);
      const results = ranker.rank([], query);
      expect(results).toHaveLength(0);
    });

    it("应该处理空关键词", () => {
      const bookmarks = [createBookmark(1, "React 教程")];
      const query = createQuery([]);

      const results = ranker.rank(bookmarks, query);

      expect(results).toHaveLength(1);
      expect(results[0].score).toBeGreaterThan(0); // 仍有时间、质量等因子
    });
  });

  describe("标题匹配", () => {
    it("精确匹配应得高分", () => {
      const bookmarks = [
        createBookmark(1, "React 入门"),
        createBookmark(2, "ReactJS 教程"), // React 不是完整词
      ];
      const query = createQuery(["React"]);

      const results = ranker.rank(bookmarks, query);

      // 精确匹配应该排在前面
      expect(results[0].bookmarkId).toBe(1);
      expect(results[0].factors?.titleMatch.type).toBe("exact");
    });

    it("多关键词匹配应得更高分", () => {
      const bookmarks = [
        createBookmark(1, "React 教程"),
        createBookmark(2, "React 状态管理教程"),
      ];
      const query = createQuery(["React", "状态管理"]);

      const results = ranker.rank(bookmarks, query);

      expect(results[0].bookmarkId).toBe(2);
    });

    it("标题不匹配时应返回低分", () => {
      const bookmarks = [createBookmark(1, "Vue.js 教程")];
      const query = createQuery(["React"]);

      const results = ranker.rank(bookmarks, query);

      expect(results[0].factors?.titleMatch.score).toBe(0);
    });
  });

  describe("内容匹配", () => {
    it("内容包含关键词应提高得分", () => {
      const bookmarks = [
        createBookmark(1, "前端教程", { summary: "学习 React 和 Vue" }),
        createBookmark(2, "前端教程", { summary: "学习 HTML 和 CSS" }),
      ];
      const query = createQuery(["React"]);

      const results = ranker.rank(bookmarks, query);

      expect(results[0].bookmarkId).toBe(1);
    });

    it("多次出现应提高密度分数", () => {
      const bookmarks = [
        createBookmark(1, "教程", {
          summary: "React 是一个很好的框架，React 用于构建 UI，React 很流行",
        }),
        createBookmark(2, "教程", { summary: "学习前端开发" }),
      ];
      const query = createQuery(["React"]);

      const results = ranker.rank(bookmarks, query);

      // 包含关键词的内容得分应该更高
      const score1 =
        results.find((r) => r.bookmarkId === 1)?.factors?.contentMatch.score ||
        0;
      const score2 =
        results.find((r) => r.bookmarkId === 2)?.factors?.contentMatch.score ||
        0;

      expect(score1).toBeGreaterThan(score2);
    });
  });

  describe("时间相关性", () => {
    it("最近的内容应得更高分", () => {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const bookmarks = [
        createBookmark(1, "React", { createdAt: monthAgo }),
        createBookmark(2, "React", { createdAt: weekAgo }),
        createBookmark(3, "React", { createdAt: now }),
      ];
      const query = createQuery(["React"]);

      const results = ranker.rank(bookmarks, query);

      // 检查时间因子
      const timeScores = results.map((r) => ({
        id: r.bookmarkId,
        time: r.factors?.timeRelevance || 0,
      }));

      // 最新的应该时间分最高
      expect(timeScores.find((t) => t.id === 3)!.time).toBeGreaterThan(
        timeScores.find((t) => t.id === 1)!.time,
      );
    });

    it("时间范围内的内容应得满分", () => {
      const now = new Date();
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const inRange = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const outOfRange = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      const bookmarks = [
        createBookmark(1, "React", { createdAt: inRange }),
        createBookmark(2, "React", { createdAt: outOfRange }),
      ];
      const query = createQuery(["React"], { start, end: now });

      const results = ranker.rank(bookmarks, query);

      expect(results[0].bookmarkId).toBe(1);
      expect(results[0].factors?.timeRelevance).toBeGreaterThan(0.5);
      expect(results[1].factors?.timeRelevance).toBe(0);
    });
  });

  describe("用户行为", () => {
    it("高访问次数应得更高分", () => {
      const bookmarks = [
        createBookmark(1, "React", { accessCount: 1 }),
        createBookmark(2, "React", { accessCount: 10 }),
      ];
      const query = createQuery(["React"]);

      const results = ranker.rank(bookmarks, query);

      const behavior1 =
        results.find((r) => r.bookmarkId === 1)?.factors?.userBehavior || 0;
      const behavior2 =
        results.find((r) => r.bookmarkId === 2)?.factors?.userBehavior || 0;

      expect(behavior2).toBeGreaterThan(behavior1);
    });

    it("收藏状态应提高分数", () => {
      const bookmarks = [
        createBookmark(1, "React", { isFavorite: false }),
        createBookmark(2, "React", { isFavorite: true }),
      ];
      const query = createQuery(["React"]);

      const results = ranker.rank(bookmarks, query);

      const behavior1 =
        results.find((r) => r.bookmarkId === 1)?.factors?.userBehavior || 0;
      const behavior2 =
        results.find((r) => r.bookmarkId === 2)?.factors?.userBehavior || 0;

      expect(behavior2).toBeGreaterThan(behavior1);
    });

    it("最近访问应提高分数", () => {
      const now = new Date();
      const recent = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
      const old = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      const bookmarks = [
        createBookmark(1, "React", { lastAccessedAt: old }),
        createBookmark(2, "React", { lastAccessedAt: recent }),
      ];
      const query = createQuery(["React"]);

      const results = ranker.rank(bookmarks, query);

      const behavior1 =
        results.find((r) => r.bookmarkId === 1)?.factors?.userBehavior || 0;
      const behavior2 =
        results.find((r) => r.bookmarkId === 2)?.factors?.userBehavior || 0;

      expect(behavior2).toBeGreaterThan(behavior1);
    });
  });

  describe("质量信号", () => {
    it("有摘要应得更高分", () => {
      const bookmarks = [
        createBookmark(1, "React", { summary: "" }),
        createBookmark(2, "React", {
          summary: "这是一篇关于 React 的详细教程，涵盖了组件、状态管理等内容",
        }),
      ];
      const query = createQuery(["React"]);

      const results = ranker.rank(bookmarks, query);

      const quality1 =
        results.find((r) => r.bookmarkId === 1)?.factors?.qualitySignal || 0;
      const quality2 =
        results.find((r) => r.bookmarkId === 2)?.factors?.qualitySignal || 0;

      expect(quality2).toBeGreaterThan(quality1);
    });

    it("有标签应得更高分", () => {
      const bookmarks = [
        createBookmark(1, "React", { tagCount: 0 }),
        createBookmark(2, "React", { tagCount: 3 }),
      ];
      const query = createQuery(["React"]);

      const results = ranker.rank(bookmarks, query);

      const quality1 =
        results.find((r) => r.bookmarkId === 1)?.factors?.qualitySignal || 0;
      const quality2 =
        results.find((r) => r.bookmarkId === 2)?.factors?.qualitySignal || 0;

      expect(quality2).toBeGreaterThan(quality1);
    });
  });

  describe("相关度等级", () => {
    it("高分应为 high 等级", () => {
      const bookmarks = [
        createBookmark(1, "React 教程", {
          summary: "React 是一个流行的前端框架",
          accessCount: 10,
          isFavorite: true,
          tagCount: 3,
        }),
      ];
      const query = createQuery(["React"]);

      const results = ranker.rank(bookmarks, query);

      expect(results[0].relevance).toBe("high");
    });

    it("低分应为 low 等级", () => {
      const bookmarks = [
        createBookmark(1, "无关内容", {
          createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        }),
      ];
      const query = createQuery(["React"]);

      const results = ranker.rank(bookmarks, query);

      expect(results[0].relevance).toBe("low");
    });
  });

  describe("向量得分混合", () => {
    it("应该混合向量得分和关键词得分", () => {
      const bookmarks = [
        createBookmark(1, "Vue 教程", { vectorScore: 0.9 }), // 高向量分，低关键词分
        createBookmark(2, "React 教程", { vectorScore: 0.3 }), // 低向量分，高关键词分
      ];
      const query = createQuery(["React"]);

      const results = ranker.rank(bookmarks, query);

      // 两者应该都有合理的分数
      expect(results[0].score).toBeGreaterThan(0);
      expect(results[1].score).toBeGreaterThan(0);
    });
  });

  describe("配置选项", () => {
    it("应该支持自定义权重", () => {
      const ranker = new ResultRanker({
        titleWeight: 0.8,
        contentWeight: 0.1,
        timeWeight: 0.05,
        behaviorWeight: 0.025,
        qualityWeight: 0.025,
      });

      const bookmarks = [
        createBookmark(1, "React 教程", { summary: "学习 Vue" }),
        createBookmark(2, "Vue 教程", { summary: "学习 React" }),
      ];
      const query = createQuery(["React"]);

      const results = ranker.rank(bookmarks, query);

      // 标题权重高，所以标题匹配的应该排在前面
      expect(results[0].bookmarkId).toBe(1);
    });
  });

  describe("工厂函数和便捷方法", () => {
    it("createResultRanker 应创建实例", () => {
      const ranker = createResultRanker({ titleWeight: 0.5 });
      expect(ranker).toBeInstanceOf(ResultRanker);
    });

    it("rankResults 应使用默认配置", () => {
      const bookmarks = [createBookmark(1, "React 教程")];
      const query = createQuery(["React"]);

      const results = rankResults(bookmarks, query);

      expect(results).toHaveLength(1);
      expect(results[0].score).toBeGreaterThan(0);
    });
  });
});
