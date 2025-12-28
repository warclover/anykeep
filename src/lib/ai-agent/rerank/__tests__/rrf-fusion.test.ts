/**
 * RRFFusion 融合算法测试
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import { RRFFusion, getRRFFusion, resetRRFFusion } from "../rrf-fusion";
import { DEFAULT_RRF_CONFIG } from "../rrf-types";
import type { RankItem } from "../rrf-types";

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
// 测试数据
// ============================================================================

const bookmarkRankList: RankItem[] = [
  { id: 1, rank: 1, source: "bookmark", score: 0.95 },
  { id: 2, rank: 2, source: "bookmark", score: 0.85 },
  { id: 3, rank: 3, source: "bookmark", score: 0.75 },
  { id: 4, rank: 4, source: "bookmark", score: 0.65 },
];

const chunkRankList: RankItem[] = [
  { id: 3, rank: 1, source: "chunk", score: 0.92 }, // 与 bookmark 重叠
  { id: 5, rank: 2, source: "chunk", score: 0.88 },
  { id: 1, rank: 3, source: "chunk", score: 0.8 }, // 与 bookmark 重叠
  { id: 6, rank: 4, source: "chunk", score: 0.7 },
];

// ============================================================================
// 测试套件
// ============================================================================

describe("RRFFusion", () => {
  let rrfFusion: RRFFusion;

  beforeEach(() => {
    rrfFusion = new RRFFusion();
  });

  afterEach(() => {
    resetRRFFusion();
  });

  describe("fuse", () => {
    it("空列表应该返回空数组", () => {
      const results = rrfFusion.fuse([]);
      expect(results).toEqual([]);
    });

    it("单个列表应该按 RRF 分数排序", () => {
      const results = rrfFusion.fuse([bookmarkRankList]);

      expect(results.length).toBe(4);
      // RRF 分数应该是 1/(k+rank)
      expect(results[0].id).toBe(1); // rank 1 有最高分
      expect(results[0].rrfScore).toBeCloseTo(1 / (60 + 1), 5);
    });

    it("两个列表应该正确融合", () => {
      const results = rrfFusion.fuse([bookmarkRankList, chunkRankList]);

      // ID 1 和 3 在两个列表中都出现，应该有更高的 RRF 分数
      const id1Result = results.find((r) => r.id === 1);
      const id2Result = results.find((r) => r.id === 2);

      expect(id1Result).toBeDefined();
      expect(id2Result).toBeDefined();

      // ID 1 出现在两个列表中，分数应该更高
      expect(id1Result!.rrfScore).toBeGreaterThan(id2Result!.rrfScore);
    });

    it("融合结果应该包含所有唯一 ID", () => {
      const results = rrfFusion.fuse([bookmarkRankList, chunkRankList]);

      const uniqueIds = new Set([
        ...bookmarkRankList.map((r) => r.id),
        ...chunkRankList.map((r) => r.id),
      ]);

      expect(results.length).toBe(uniqueIds.size);
    });

    it("每个结果应该记录来源", () => {
      const results = rrfFusion.fuse([bookmarkRankList, chunkRankList]);

      for (const result of results) {
        expect(result.sources.length).toBeGreaterThan(0);
        expect(result.sourceRanks).toBeDefined();
      }

      // ID 1 应该来自两个来源
      const id1Result = results.find((r) => r.id === 1);
      expect(id1Result!.sources).toContain("bookmark");
      expect(id1Result!.sources).toContain("chunk");
    });

    it("空列表项应该被跳过", () => {
      const results = rrfFusion.fuse([bookmarkRankList, [], chunkRankList]);

      expect(results.length).toBe(6); // 4 + 4 - 2(重叠)
    });
  });

  describe("fuseTwoLists", () => {
    it("应该正确融合两个列表", () => {
      const results = rrfFusion.fuseTwoLists(bookmarkRankList, chunkRankList);

      expect(results.length).toBe(6);
    });
  });

  describe("配置", () => {
    it("自定义 k 值应该影响分数计算", () => {
      const rrfK30 = new RRFFusion({ k: 30 });
      const rrfK100 = new RRFFusion({ k: 100 });

      const results30 = rrfK30.fuse([bookmarkRankList]);
      const results100 = rrfK100.fuse([bookmarkRankList]);

      // k 较小时，排名差异对分数影响更大
      const score30_rank1 = results30[0].rrfScore;
      const score100_rank1 = results100[0].rrfScore;

      expect(score30_rank1).toBeGreaterThan(score100_rank1);
    });

    it("来源权重应该影响融合分数", () => {
      const rrfWeighted = new RRFFusion({
        sourceWeights: {
          chunk: 2.0, // chunk 权重更高
          bookmark: 1.0,
        },
      });

      const results = rrfWeighted.fuse([bookmarkRankList, chunkRankList]);

      // ID 3: bookmark rank 3, chunk rank 1
      // ID 1: bookmark rank 1, chunk rank 3
      // 由于 chunk 权重更高，ID 3 应该排在前面
      const id3Result = results.find((r) => r.id === 3);
      const id1Result = results.find((r) => r.id === 1);

      expect(id3Result!.rrfScore).toBeGreaterThan(id1Result!.rrfScore);
    });

    it("topK 应该限制返回数量", () => {
      const rrfTopK = new RRFFusion({ topK: 3 });
      const results = rrfTopK.fuse([bookmarkRankList, chunkRankList]);

      expect(results.length).toBe(3);
    });
  });

  describe("createRankList", () => {
    it("应该从对象数组创建排名列表", () => {
      const items = [
        { bookmarkId: 101, similarity: 0.9 },
        { bookmarkId: 102, similarity: 0.8 },
        { bookmarkId: 103, similarity: 0.7 },
      ];

      const rankList = RRFFusion.createRankList(
        items,
        "vector",
        (item) => item.bookmarkId,
        (item) => item.similarity,
      );

      expect(rankList.length).toBe(3);
      expect(rankList[0].id).toBe(101);
      expect(rankList[0].rank).toBe(1);
      expect(rankList[0].score).toBe(0.9);
      expect(rankList[0].source).toBe("vector");
    });

    it("应该支持 payload 提取", () => {
      const items = [
        { id: 1, title: "标题1", score: 0.9 },
        { id: 2, title: "标题2", score: 0.8 },
      ];

      const rankList = RRFFusion.createRankList(
        items,
        "search",
        (item) => item.id,
        (item) => item.score,
        (item) => ({ title: item.title }),
      );

      expect(rankList[0].payload).toEqual({ title: "标题1" });
    });
  });

  describe("getStats", () => {
    it("应该返回正确的统计信息", () => {
      const results = rrfFusion.fuse([bookmarkRankList, chunkRankList]);
      const stats = rrfFusion.getStats(results, [
        bookmarkRankList,
        chunkRankList,
      ]);

      expect(stats.sourceCount).toBe(2);
      expect(stats.itemsPerSource.bookmark).toBe(4);
      expect(stats.itemsPerSource.chunk).toBe(4);
      expect(stats.uniqueItems).toBe(6);
      expect(stats.avgAppearances).toBeGreaterThan(1);
    });

    it("空结果应该返回零统计", () => {
      const stats = rrfFusion.getStats([], []);

      expect(stats.sourceCount).toBe(0);
      expect(stats.uniqueItems).toBe(0);
      expect(stats.avgAppearances).toBe(0);
    });
  });

  describe("配置更新", () => {
    it("updateConfig 应该更新配置", () => {
      rrfFusion.updateConfig({ k: 100 });

      const config = rrfFusion.getConfig();
      expect(config.k).toBe(100);
    });

    it("getConfig 应该返回当前配置副本", () => {
      const config = rrfFusion.getConfig();

      expect(config.k).toBe(DEFAULT_RRF_CONFIG.k);

      // 修改返回的配置不应影响内部配置
      config.k = 999;
      expect(rrfFusion.getConfig().k).toBe(DEFAULT_RRF_CONFIG.k);
    });
  });
});

describe("getRRFFusion", () => {
  afterEach(() => {
    resetRRFFusion();
  });

  it("应该返回单例实例", () => {
    const instance1 = getRRFFusion();
    const instance2 = getRRFFusion();

    expect(instance1).toBe(instance2);
  });
});

describe("RRFFusion - 边界情况", () => {
  let rrfFusion: RRFFusion;

  beforeEach(() => {
    rrfFusion = new RRFFusion();
  });

  it("单项列表应该正常处理", () => {
    const singleItem: RankItem[] = [{ id: 1, rank: 1, source: "test" }];
    const results = rrfFusion.fuse([singleItem]);

    expect(results.length).toBe(1);
    expect(results[0].id).toBe(1);
  });

  it("相同 ID 的多个来源应该正确累加", () => {
    const list1: RankItem[] = [{ id: 1, rank: 1, source: "a" }];
    const list2: RankItem[] = [{ id: 1, rank: 1, source: "b" }];
    const list3: RankItem[] = [{ id: 1, rank: 1, source: "c" }];

    const results = rrfFusion.fuse([list1, list2, list3]);

    expect(results.length).toBe(1);
    expect(results[0].sources.length).toBe(3);
    // RRF 分数应该是 3 * (1/(60+1))
    expect(results[0].rrfScore).toBeCloseTo(3 / 61, 5);
  });

  it("字符串 ID 应该正常处理", () => {
    const stringIdList: RankItem[] = [
      { id: "uuid-1", rank: 1, source: "test" },
      { id: "uuid-2", rank: 2, source: "test" },
    ];

    const results = rrfFusion.fuse([stringIdList]);

    expect(results.length).toBe(2);
    expect(results[0].id).toBe("uuid-1");
  });
});
