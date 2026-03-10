/**
 * CascadeRanker 单元测试
 *
 * @module classification-v2/__tests__/ranker
 */

import { CascadeRanker } from "../../ranker/cascade-ranker";
import type {
  Scorer,
  Score,
  BookmarkContext,
  FolderContext,
  UserContext,
} from "../../types";

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// ============================================================================
// Fixtures
// ============================================================================

function makeBookmark(): BookmarkContext {
  return {
    bookmarkId: "bm_1",
    title: "React Hooks",
    url: "https://example.com",
    tags: ["React"],
    embedding: [],
    normalizedTitle: "react hooks",
    normalizedTags: ["react"],
  };
}

function makeFolders(): FolderContext[] {
  return [
    {
      id: 1,
      name: "React",
      normalizedName: "react",
      aliases: [],
      coreTags: [],
      relatedTags: [],
      sampleTitles: [],
      keywords: [],
      bookmarkCount: 10,
    },
    {
      id: 2,
      name: "Vue",
      normalizedName: "vue",
      aliases: [],
      coreTags: [],
      relatedTags: [],
      sampleTitles: [],
      keywords: [],
      bookmarkCount: 5,
    },
  ];
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

/** 创建 mock Scorer */
function createMockScorer(
  name: string,
  tier: "instant" | "fast" | "slow",
  weight: number,
  scoreMap: Map<number, Score> | (() => Promise<Map<number, Score>>),
  options?: { shouldRun?: boolean },
): Scorer {
  return {
    name,
    tier,
    defaultWeight: weight,
    score:
      typeof scoreMap === "function"
        ? scoreMap
        : jest.fn().mockResolvedValue(scoreMap),
    ...(options?.shouldRun !== undefined
      ? { shouldRun: () => options.shouldRun! }
      : {}),
  };
}

function buildScore(value: number, reason: string = "test"): Score {
  return {
    value,
    confidence: value,
    reason,
    signals: [{ type: "keyword", detail: reason, strength: value }],
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("CascadeRanker", () => {
  describe("基本排序", () => {
    it("单个 Scorer 产出 → 正确排序", async () => {
      const ranker = new CascadeRanker();
      const scorers: Scorer[] = [
        createMockScorer(
          "rule",
          "instant",
          0.15,
          new Map([
            [1, buildScore(0.9, "规则命中")],
            [2, buildScore(0.3, "弱匹配")],
          ]),
        ),
      ];

      const result = await ranker.rank(
        scorers,
        makeBookmark(),
        makeFolders(),
        makeUserCtx(),
      );

      expect(result.entries.length).toBeGreaterThanOrEqual(1);
      expect(result.entries[0].folderId).toBe(1);
      expect(result.entries[0].mergedScore.value).toBeGreaterThan(
        result.entries[1]?.mergedScore.value ?? 0,
      );
    });
  });

  describe("提前终止", () => {
    it("instant tier 高置信度 → 不执行 fast/slow tier", async () => {
      const ranker = new CascadeRanker({
        earlyExitThresholds: { instant: 0.8, fast: 0.7 },
      });

      const fastScorer = createMockScorer("vector", "fast", 0.35, new Map());
      const slowScorer = createMockScorer("llm", "slow", 0.2, new Map());

      const scorers: Scorer[] = [
        createMockScorer(
          "rule",
          "instant",
          1.0, // 给满权重使归一化后分数高于阈值
          new Map([[1, buildScore(0.95, "规则完美命中")]]),
        ),
        fastScorer,
        slowScorer,
      ];

      const result = await ranker.rank(
        scorers,
        makeBookmark(),
        makeFolders(),
        makeUserCtx(),
      );

      // 应提前终止于 instant
      expect(result.timing.earlyExitTier).toBe("instant");
      // fast 和 slow scorer 不应被调用
      expect(fastScorer.score).not.toHaveBeenCalled();
      expect(slowScorer.score).not.toHaveBeenCalled();
    });

    it("instant tier 低分 → 继续执行 fast tier", async () => {
      const ranker = new CascadeRanker({
        earlyExitThresholds: { instant: 0.9, fast: 0.7 },
      });

      const fastScorer = createMockScorer(
        "vector",
        "fast",
        0.35,
        new Map([[1, buildScore(0.8)]]),
      );

      const scorers: Scorer[] = [
        createMockScorer(
          "rule",
          "instant",
          0.15,
          new Map([[1, buildScore(0.5, "弱规则匹配")]]),
        ),
        fastScorer,
      ];

      await ranker.rank(scorers, makeBookmark(), makeFolders(), makeUserCtx());

      // fast scorer 应该被执行
      expect(fastScorer.score).toHaveBeenCalled();
    });
  });

  describe("完整遍历", () => {
    it("所有 tier 都低分 → 走完全部、earlyExitTier 为 undefined", async () => {
      const ranker = new CascadeRanker({
        earlyExitThresholds: { instant: 0.95, fast: 0.9 },
      });

      const scorers: Scorer[] = [
        createMockScorer(
          "rule",
          "instant",
          0.15,
          new Map([[1, buildScore(0.3)]]),
        ),
        createMockScorer(
          "vector",
          "fast",
          0.35,
          new Map([[1, buildScore(0.4)]]),
        ),
        createMockScorer("llm", "slow", 0.2, new Map([[1, buildScore(0.5)]])),
      ];

      const result = await ranker.rank(
        scorers,
        makeBookmark(),
        makeFolders(),
        makeUserCtx(),
      );

      expect(result.timing.earlyExitTier).toBeUndefined();
      // 所有 Scorer 都应有执行记录
      const executed = result.scorerDetails.filter((d) => d.executed);
      expect(executed.length).toBe(3);
    });
  });

  describe("shouldRun 过滤", () => {
    it("shouldRun=false 的 Scorer 被跳过且记录 skipped", async () => {
      const ranker = new CascadeRanker();

      const skippedScorer = createMockScorer(
        "rule",
        "instant",
        0.15,
        new Map(),
        { shouldRun: false },
      );

      const scorers: Scorer[] = [
        skippedScorer,
        createMockScorer(
          "vector",
          "fast",
          0.35,
          new Map([[1, buildScore(0.7)]]),
        ),
      ];

      const result = await ranker.rank(
        scorers,
        makeBookmark(),
        makeFolders(),
        makeUserCtx(),
      );

      const ruleDetail = result.scorerDetails.find((d) => d.scorer === "rule");
      expect(ruleDetail).toBeDefined();
      expect(ruleDetail?.executed).toBe(false);
      expect(ruleDetail?.skippedReason).toContain("shouldRun");
    });
  });

  describe("Scorer 异常处理", () => {
    it("Scorer 抛异常 → 不影响其他 Scorer 执行", async () => {
      const ranker = new CascadeRanker();

      const errorScorer = createMockScorer(
        "buggy",
        "instant",
        0.15,
        async () => {
          throw new Error("Scorer 内部错误");
        },
      );

      const normalScorer = createMockScorer(
        "vector",
        "fast",
        0.35,
        new Map([[1, buildScore(0.7)]]),
      );

      const scorers: Scorer[] = [errorScorer, normalScorer];

      const result = await ranker.rank(
        scorers,
        makeBookmark(),
        makeFolders(),
        makeUserCtx(),
      );

      // 正常 Scorer 应该执行并产出结果
      expect(result.entries.length).toBeGreaterThanOrEqual(1);
      // 异常 Scorer 应记录错误
      const buggyDetail = result.scorerDetails.find(
        (d) => d.scorer === "buggy",
      );
      expect(buggyDetail).toBeDefined();
      expect(buggyDetail?.skippedReason).toContain("Error");
    });
  });

  describe("分数融合", () => {
    it("多个 Scorer 对同一文件夹评分 → 加权融合", async () => {
      const ranker = new CascadeRanker();

      const scorers: Scorer[] = [
        createMockScorer(
          "rule",
          "instant",
          0.3,
          new Map([[1, buildScore(0.9)]]),
        ),
        createMockScorer(
          "vector",
          "fast",
          0.7,
          new Map([[1, buildScore(0.6)]]),
        ),
      ];

      const result = await ranker.rank(
        scorers,
        makeBookmark(),
        makeFolders(),
        makeUserCtx(),
      );

      expect(result.entries.length).toBeGreaterThanOrEqual(1);
      const top = result.entries[0];
      expect(top.folderId).toBe(1);
      // 融合后分数应在 0.6-0.9 之间
      expect(top.mergedScore.value).toBeGreaterThan(0.5);
      expect(top.mergedScore.value).toBeLessThanOrEqual(1.0);
      // breakdown 应包含两个 Scorer
      expect(top.mergedScore.breakdown).toHaveProperty("rule");
      expect(top.mergedScore.breakdown).toHaveProperty("vector");
    });
  });

  describe("timing 指标", () => {
    it("返回 totalMs 和各 tier 耗时", async () => {
      const ranker = new CascadeRanker();
      const scorers: Scorer[] = [
        createMockScorer(
          "rule",
          "instant",
          0.15,
          new Map([[1, buildScore(0.5)]]),
        ),
      ];

      const result = await ranker.rank(
        scorers,
        makeBookmark(),
        makeFolders(),
        makeUserCtx(),
      );

      expect(result.timing.totalMs).toBeGreaterThanOrEqual(0);
      expect(result.timing.tierMs).toHaveProperty("instant");
    });
  });

  describe("用户自定义权重", () => {
    it("用户权重覆盖默认权重", async () => {
      const ranker = new CascadeRanker();

      const scorers: Scorer[] = [
        createMockScorer(
          "rule",
          "instant",
          0.15,
          new Map([[1, buildScore(0.9)]]),
        ),
        createMockScorer(
          "vector",
          "fast",
          0.35,
          new Map([[2, buildScore(0.8)]]),
        ),
      ];

      const userCtx = makeUserCtx();
      // 用户大幅提升 rule 权重，降低 vector 权重
      userCtx.weights = { rule: 0.8, vector: 0.2 };

      const result = await ranker.rank(
        scorers,
        makeBookmark(),
        makeFolders(),
        userCtx,
      );

      // rule 高权重 + 高分 → folderId=1 应该排第一
      expect(result.entries[0].folderId).toBe(1);
    });
  });

  describe("空 Scorer 列表", () => {
    it("无 Scorer → 返回空 entries", async () => {
      const ranker = new CascadeRanker();
      const result = await ranker.rank(
        [],
        makeBookmark(),
        makeFolders(),
        makeUserCtx(),
      );

      expect(result.entries).toHaveLength(0);
      expect(result.scorerDetails).toHaveLength(0);
    });
  });
});
