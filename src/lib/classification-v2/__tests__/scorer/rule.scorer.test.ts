/**
 * RuleScorer 单元测试
 *
 * @module classification-v2/__tests__/scorer
 */

import { RuleScorer } from "../../scorer/rule.scorer";
import type { BookmarkContext, FolderContext, UserContext } from "../../types";

// ============================================================================
// Fixtures
// ============================================================================

function makeBookmark(
  overrides: Partial<BookmarkContext> = {},
): BookmarkContext {
  return {
    bookmarkId: "bm_1",
    title: "React Hooks 完全指南",
    url: "https://reactjs.org/docs/hooks",
    summary: "学习 React Hooks",
    tags: ["React", "前端"],
    embedding: [],
    normalizedTitle: "react hooks 完全指南",
    normalizedTags: ["react", "前端"],
    ...overrides,
  };
}

function makeFolder(id: number, name: string): FolderContext {
  return {
    id,
    name,
    normalizedName: name.toLowerCase(),
    aliases: [],
    coreTags: [],
    relatedTags: [],
    sampleTitles: [],
    keywords: [],
    bookmarkCount: 5,
  };
}

function makeUserCtx(
  rules: UserContext["rules"] = [],
  overrides: Partial<UserContext> = {},
): UserContext {
  return {
    userId: "user_1",
    weights: {},
    rules,
    stage: "mature",
    folderCount: 5,
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("RuleScorer", () => {
  const scorer = new RuleScorer();

  describe("基本属性", () => {
    it("name/tier/weight 正确", () => {
      expect(scorer.name).toBe("rule");
      expect(scorer.tier).toBe("instant");
      expect(scorer.defaultWeight).toBeGreaterThan(0);
    });
  });

  describe("shouldRun", () => {
    it("无规则时返回 false", () => {
      const ctx = makeUserCtx([]);
      expect(scorer.shouldRun!(makeBookmark(), ctx)).toBe(false);
    });

    it("有规则时返回 true", () => {
      const ctx = makeUserCtx([
        {
          id: 1,
          urlDomains: ["github.com"],
          titleKeywords: [],
          tags: [],
          folderId: 10,
          folderName: "GitHub",
          confidence: 0.95,
          priority: 1,
          enabled: true,
        },
      ]);
      expect(scorer.shouldRun!(makeBookmark(), ctx)).toBe(true);
    });
  });

  describe("URL 域名匹配", () => {
    it("域名命中 → 返回对应 folderId 的高分", async () => {
      const bookmark = makeBookmark({
        url: "https://github.com/facebook/react",
      });
      const candidates = [makeFolder(10, "GitHub"), makeFolder(20, "React")];
      const ctx = makeUserCtx([
        {
          id: 1,
          urlDomains: ["github.com"],
          titleKeywords: [],
          tags: [],
          folderId: 10,
          folderName: "GitHub",
          confidence: 0.95,
          priority: 1,
          enabled: true,
        },
      ]);

      const results = await scorer.score(bookmark, candidates, ctx);

      expect(results.has(10)).toBe(true);
      const score = results.get(10)!;
      expect(score.value).toBe(0.95);
      expect(score.signals[0].type).toBe("url_pattern");
    });

    it("域名不匹配 → 不返回该规则的分数", async () => {
      const bookmark = makeBookmark({
        url: "https://stackoverflow.com/questions",
      });
      const candidates = [makeFolder(10, "GitHub")];
      const ctx = makeUserCtx([
        {
          id: 1,
          urlDomains: ["github.com"],
          titleKeywords: [],
          tags: [],
          folderId: 10,
          folderName: "GitHub",
          confidence: 0.95,
          priority: 1,
          enabled: true,
        },
      ]);

      const results = await scorer.score(bookmark, candidates, ctx);
      expect(results.size).toBe(0);
    });
  });

  describe("标题关键词匹配", () => {
    it("标题包含关键词 → 命中", async () => {
      const bookmark = makeBookmark({
        normalizedTitle: "vue3 composition api 入门教程",
        url: undefined,
      });
      const candidates = [makeFolder(20, "Vue")];
      const ctx = makeUserCtx([
        {
          id: 2,
          urlDomains: [],
          titleKeywords: ["vue3"],
          tags: [],
          folderId: 20,
          folderName: "Vue",
          confidence: 0.9,
          priority: 1,
          enabled: true,
        },
      ]);

      const results = await scorer.score(bookmark, candidates, ctx);
      expect(results.has(20)).toBe(true);
      expect(results.get(20)!.signals[0].type).toBe("keyword");
    });
  });

  describe("标签匹配", () => {
    it("标签精确匹配 → 命中", async () => {
      const bookmark = makeBookmark({
        normalizedTags: ["typescript", "前端"],
        url: undefined,
      });
      const candidates = [makeFolder(30, "TypeScript")];
      const ctx = makeUserCtx([
        {
          id: 3,
          urlDomains: [],
          titleKeywords: [],
          tags: ["TypeScript"],
          folderId: 30,
          folderName: "TypeScript",
          confidence: 0.88,
          priority: 1,
          enabled: true,
        },
      ]);

      const results = await scorer.score(bookmark, candidates, ctx);
      expect(results.has(30)).toBe(true);
      expect(results.get(30)!.signals[0].type).toBe("tag_exact");
    });
  });

  describe("禁用规则", () => {
    it("enabled=false 的规则被跳过", async () => {
      const bookmark = makeBookmark({
        url: "https://github.com/test",
      });
      const candidates = [makeFolder(10, "GitHub")];
      const ctx = makeUserCtx([
        {
          id: 1,
          urlDomains: ["github.com"],
          titleKeywords: [],
          tags: [],
          folderId: 10,
          folderName: "GitHub",
          confidence: 0.95,
          priority: 1,
          enabled: false,
        },
      ]);

      const results = await scorer.score(bookmark, candidates, ctx);
      expect(results.size).toBe(0);
    });
  });

  describe("多规则竞争", () => {
    it("同一 folderId 多规则命中 → 取最高分", async () => {
      const bookmark = makeBookmark({
        url: "https://github.com/repo",
        normalizedTitle: "github action 自动部署",
        normalizedTags: ["github", "ci"],
      });
      const candidates = [makeFolder(10, "GitHub")];
      const ctx = makeUserCtx([
        {
          id: 1,
          urlDomains: ["github.com"],
          titleKeywords: [],
          tags: [],
          folderId: 10,
          folderName: "GitHub",
          confidence: 0.8,
          priority: 1,
          enabled: true,
        },
        {
          id: 2,
          urlDomains: [],
          titleKeywords: ["github"],
          tags: [],
          folderId: 10,
          folderName: "GitHub",
          confidence: 0.95,
          priority: 2,
          enabled: true,
        },
      ]);

      const results = await scorer.score(bookmark, candidates, ctx);
      expect(results.get(10)!.value).toBe(0.95);
    });
  });

  describe("边界情况", () => {
    it("URL 格式无效 → 域名匹配跳过，不抛异常", async () => {
      const bookmark = makeBookmark({ url: "not-a-valid-url" });
      const candidates = [makeFolder(10, "GitHub")];
      const ctx = makeUserCtx([
        {
          id: 1,
          urlDomains: ["github.com"],
          titleKeywords: [],
          tags: [],
          folderId: 10,
          folderName: "GitHub",
          confidence: 0.95,
          priority: 1,
          enabled: true,
        },
      ]);

      const results = await scorer.score(bookmark, candidates, ctx);
      expect(results.size).toBe(0);
    });

    it("空规则列表 → 返回空 Map", async () => {
      const ctx = makeUserCtx([]);
      const results = await scorer.score(
        makeBookmark(),
        [makeFolder(1, "test")],
        ctx,
      );
      expect(results.size).toBe(0);
    });
  });
});
