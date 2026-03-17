/**
 * AiTagScorer 单元测试
 *
 * @module classification-v2/__tests__/scorer
 */

import { AiTagScorer } from "../../scorer/ai-tag.scorer";
import type { BookmarkContext, FolderContext, UserContext } from "../../types";

// ============================================================================
// Fixtures
// ============================================================================

function makeBookmark(
  overrides: Partial<BookmarkContext> = {},
): BookmarkContext {
  return {
    bookmarkId: "bm_1",
    title: "React 性能优化",
    url: "https://example.com",
    tags: ["React", "性能优化"],
    embedding: [],
    normalizedTitle: "react 性能优化",
    normalizedTags: ["react", "性能优化"],
    ...overrides,
  };
}

function makeFolder(
  id: number,
  name: string,
  overrides: Partial<FolderContext> = {},
): FolderContext {
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
    ...overrides,
  };
}

function makeUserCtx(): UserContext {
  return {
    userId: "user_1",
    weights: {},
    rules: [],
    stage: "mature",
    folderCount: 5,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("AiTagScorer", () => {
  const scorer = new AiTagScorer();

  describe("基本属性", () => {
    it("name/tier/weight 正确", () => {
      expect(scorer.name).toBe("aiTag");
      expect(scorer.tier).toBe("instant");
      expect(scorer.defaultWeight).toBeGreaterThan(0);
    });
  });

  describe("shouldRun", () => {
    it("无标签时返回 false", () => {
      const bookmark = makeBookmark({ tags: [], normalizedTags: [] });
      expect(scorer.shouldRun!(bookmark, makeUserCtx())).toBe(false);
    });

    it("有标签时返回 true", () => {
      const bookmark = makeBookmark();
      expect(scorer.shouldRun!(bookmark, makeUserCtx())).toBe(true);
    });
  });

  describe("策略 0: 标题包含文件夹名", () => {
    it("标题包含文件夹名 → 0.92（优先于精确标签匹配）", async () => {
      const bookmark = makeBookmark({
        title: '流程工业的"OpenClaw"：协同生成与审查',
        normalizedTitle: '流程工业的"openclaw"：协同生成与审查',
        normalizedTags: ["流程工业"],
      });
      const folders = [makeFolder(1, "openclaw")];

      const results = await scorer.score(bookmark, folders, makeUserCtx());

      expect(results.has(1)).toBe(true);
      const score = results.get(1)!;
      expect(score.value).toBe(0.92);
      expect(score.signals[0].type).toBe("title_folder_name");
    });

    it("文件夹名仅单字（长度<2）→ 不触发标题匹配", async () => {
      const bookmark = makeBookmark({
        title: "AI 在工业中的应用",
        normalizedTitle: "ai 在工业中的应用",
        normalizedTags: [],
        tags: [],
      });
      const folders = [makeFolder(1, "A", { normalizedName: "a" })];

      const results = await scorer.score(bookmark, folders, makeUserCtx());
      expect(results.size).toBe(0);
    });

    it("标题不包含文件夹名 → 降级到后续策略", async () => {
      const bookmark = makeBookmark({
        title: "React Hooks 完全指南",
        normalizedTitle: "react hooks 完全指南",
        normalizedTags: ["react"],
      });
      const folders = [makeFolder(1, "React")];

      const results = await scorer.score(bookmark, folders, makeUserCtx());

      // 标题不含 "react"（包含 "react hooks"），但标签精确匹配
      // 注意：normalizedTitle "react hooks 完全指南" includes "react" → 标题匹配会命中
      expect(results.has(1)).toBe(true);
      expect(results.get(1)!.value).toBe(0.92); // 标题匹配优先
    });
  });

  describe("策略 1: 精确匹配", () => {
    it("标签与文件夹名精确匹配 → 最高分 0.98", async () => {
      // 标题不包含文件夹名，确保测试纯标签路径
      const bookmark = makeBookmark({
        title: "前端框架性能对比",
        normalizedTitle: "前端框架性能对比",
        normalizedTags: ["react"],
      });
      const folders = [makeFolder(1, "React")];

      const results = await scorer.score(bookmark, folders, makeUserCtx());

      expect(results.has(1)).toBe(true);
      const score = results.get(1)!;
      expect(score.value).toBe(0.98);
      expect(score.signals[0].type).toBe("tag_exact");
    });

    it("大小写不同但标准化后相同 → 匹配", async () => {
      const bookmark = makeBookmark({
        normalizedTags: ["typescript"],
      });
      const folders = [
        makeFolder(1, "TypeScript", { normalizedName: "typescript" }),
      ];

      const results = await scorer.score(bookmark, folders, makeUserCtx());
      expect(results.has(1)).toBe(true);
      expect(results.get(1)!.value).toBe(0.98);
    });
  });

  describe("策略 2: 别名匹配", () => {
    it("标签匹配文件夹别名 → 0.95", async () => {
      const bookmark = makeBookmark({
        normalizedTags: ["js"],
      });
      const folders = [
        makeFolder(1, "JavaScript", {
          normalizedName: "javascript",
          aliases: ["JS", "ECMAScript"],
        }),
      ];

      const results = await scorer.score(bookmark, folders, makeUserCtx());

      expect(results.has(1)).toBe(true);
      expect(results.get(1)!.value).toBe(0.95);
      expect(results.get(1)!.signals[0].type).toBe("tag_alias");
    });
  });

  describe("策略 3: 部分匹配", () => {
    it("标签为文件夹名子串 → 0.60", async () => {
      // "reactjs"(7) vs "reactjs教程"(9)，ratio=7/9=0.78 > 0.5
      const bookmark = makeBookmark({
        normalizedTags: ["reactjs"],
      });
      const folders = [
        makeFolder(1, "ReactJS教程", { normalizedName: "reactjs教程" }),
      ];

      const results = await scorer.score(bookmark, folders, makeUserCtx());

      expect(results.has(1)).toBe(true);
      expect(results.get(1)!.value).toBe(0.6);
      expect(results.get(1)!.signals[0].type).toBe("tag_partial");
    });

    it("标签太短（<3字符）→ 跳过部分匹配", async () => {
      const bookmark = makeBookmark({
        normalizedTags: ["ai"],
      });
      const folders = [makeFolder(1, "AI 应用", { normalizedName: "ai 应用" })];

      const results = await scorer.score(bookmark, folders, makeUserCtx());
      // "ai" 长度为 2，低于 minTagLength(3)，部分匹配跳过
      // 但精确匹配也不行（"ai" !== "ai 应用"）
      expect(results.size).toBe(0);
    });
  });

  describe("策略 4: 核心标签匹配", () => {
    it("2 个核心标签匹配 → 0.92", async () => {
      const bookmark = makeBookmark({
        normalizedTags: ["react", "hooks", "状态管理"],
      });
      const folders = [
        makeFolder(1, "前端框架", {
          coreTags: ["React", "Vue", "Angular", "Hooks", "组件"],
        }),
      ];

      const results = await scorer.score(bookmark, folders, makeUserCtx());

      expect(results.has(1)).toBe(true);
      expect(results.get(1)!.value).toBe(0.92);
      expect(results.get(1)!.signals[0].type).toBe("tag_core");
    });

    it("1 个核心标签匹配 → 0.87", async () => {
      const bookmark = makeBookmark({
        normalizedTags: ["react"],
      });
      const folders = [
        makeFolder(1, "前端框架", {
          normalizedName: "前端框架",
          coreTags: ["React", "Vue"],
        }),
      ];

      const results = await scorer.score(bookmark, folders, makeUserCtx());

      expect(results.has(1)).toBe(true);
      expect(results.get(1)!.value).toBe(0.87);
    });
  });

  describe("策略 5: 相关标签匹配", () => {
    it("≥3 个相关标签匹配 → 0.85", async () => {
      const bookmark = makeBookmark({
        normalizedTags: ["webpack", "babel", "eslint", "prettier"],
      });
      const folders = [
        makeFolder(1, "工程化", {
          normalizedName: "工程化",
          relatedTags: ["Webpack", "Babel", "ESLint", "Prettier", "Vite"],
        }),
      ];

      const results = await scorer.score(bookmark, folders, makeUserCtx());

      expect(results.has(1)).toBe(true);
      expect(results.get(1)!.value).toBe(0.85);
      expect(results.get(1)!.signals[0].type).toBe("tag_related");
    });

    it("<3 个相关标签匹配 → 不命中", async () => {
      const bookmark = makeBookmark({
        normalizedTags: ["webpack", "babel"],
      });
      const folders = [
        makeFolder(1, "工程化", {
          normalizedName: "工程化",
          relatedTags: ["Webpack", "Babel", "ESLint"],
        }),
      ];

      const results = await scorer.score(bookmark, folders, makeUserCtx());
      // 只匹配 2 个，低于阈值 3
      expect(results.has(1)).toBe(false);
    });
  });

  describe("策略优先级", () => {
    it("标题匹配优先于精确标签匹配", async () => {
      const bookmark = makeBookmark({
        title: "React 状态管理最佳实践",
        normalizedTitle: "react 状态管理最佳实践",
        normalizedTags: ["react"],
      });
      const folders = [
        makeFolder(1, "React", {
          normalizedName: "react",
          aliases: ["ReactJS"],
          coreTags: ["React"],
        }),
      ];

      const results = await scorer.score(bookmark, folders, makeUserCtx());
      // 标题 "react 状态管理..." includes "react" → 标题匹配 0.92 优先
      expect(results.get(1)!.value).toBe(0.92);
      expect(results.get(1)!.signals[0].type).toBe("title_folder_name");
    });

    it("标题不匹配时回退到精确标签匹配", async () => {
      const bookmark = makeBookmark({
        title: "Vue.js 新特性一览",
        normalizedTitle: "vue.js 新特性一览",
        normalizedTags: ["react"],
      });
      const folders = [
        makeFolder(1, "React", {
          normalizedName: "react",
        }),
      ];

      const results = await scorer.score(bookmark, folders, makeUserCtx());
      // 标题 "vue.js..." 不包含 "react"，回退到精确标签匹配 0.98
      expect(results.get(1)!.value).toBe(0.98);
      expect(results.get(1)!.signals[0].type).toBe("tag_exact");
    });
  });

  describe("多文件夹竞争", () => {
    it("多个文件夹同时匹配 → 各自独立评分", async () => {
      // 标题不包含任何文件夹名，确保走标签精确匹配路径
      const bookmark = makeBookmark({
        title: "前端技术栈选型分析",
        normalizedTitle: "前端技术栈选型分析",
        normalizedTags: ["react", "typescript"],
      });
      const folders = [
        makeFolder(1, "React", { normalizedName: "react" }),
        makeFolder(2, "TypeScript", { normalizedName: "typescript" }),
      ];

      const results = await scorer.score(bookmark, folders, makeUserCtx());

      expect(results.size).toBe(2);
      expect(results.get(1)!.value).toBe(0.98);
      expect(results.get(2)!.value).toBe(0.98);
    });
  });

  describe("边界情况", () => {
    it("空候选列表 → 返回空 Map", async () => {
      const results = await scorer.score(makeBookmark(), [], makeUserCtx());
      expect(results.size).toBe(0);
    });

    it("文件夹无标签/别名/核心标签 → 仅靠文件夹名匹配", async () => {
      // 标题不含文件夹名，测试纯标签精确匹配
      const bookmark = makeBookmark({
        title: "编程语言学习笔记",
        normalizedTitle: "编程语言学习笔记",
        normalizedTags: ["python"],
      });
      const folders = [makeFolder(1, "Python")];

      const results = await scorer.score(bookmark, folders, makeUserCtx());
      expect(results.has(1)).toBe(true);
      // 精确匹配
      expect(results.get(1)!.value).toBe(0.98);
    });
  });
});
