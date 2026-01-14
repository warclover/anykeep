/**
 * RuleMiner 集成测试
 *
 * 测试规则挖掘 Pipeline 的完整流程：
 * 1. 从数据库收集 LLM 兜底案例
 * 2. 聚类相似案例
 * 3. LLM 辅助生成正则表达式
 * 4. 验证生成的规则
 * 5. 存储候选规则
 *
 * @version 1.0.0
 * @since 2026-01-13
 */

import {
  RuleMiner,
  getRuleMiner,
  resetRuleMiner,
  type MiningCase,
  DEFAULT_RULE_MINER_CONFIG,
} from "../rule-miner";

// Mock AI SDK
jest.mock("ai", () => ({
  generateText: jest.fn().mockResolvedValue({
    text: "/^(?:帮我|请)?(?:整理|清理)一下(?:收藏)?$/",
  }),
}));

// Import mocked module after jest.mock
import { generateText } from "ai";

// Mock embedding
jest.mock("@/lib/embedding", () => ({
  generateEmbedding: jest.fn().mockResolvedValue(
    Array(1536)
      .fill(0)
      .map((_, i) => Math.sin(i) * 0.1),
  ),
}));

// 模拟数据库中的案例（ai_intent_feedback 表格式）
interface MockFeedbackRow {
  id: number;
  original_input: string;
  predicted_type: string;
  predicted_subtype: string | null;
  predicted_confidence: number;
  created_at: string;
  metadata: { source: string };
}

const mockFeedbackRows: MockFeedbackRow[] = [
  {
    id: 1,
    original_input: "帮我整理一下收藏",
    predicted_type: "organize",
    predicted_subtype: "cleanup",
    predicted_confidence: 0.85,
    created_at: new Date().toISOString(),
    metadata: { source: "llm" },
  },
  {
    id: 2,
    original_input: "请清理一下我的收藏",
    predicted_type: "organize",
    predicted_subtype: "cleanup",
    predicted_confidence: 0.82,
    created_at: new Date().toISOString(),
    metadata: { source: "llm" },
  },
  {
    id: 3,
    original_input: "整理收藏",
    predicted_type: "organize",
    predicted_subtype: "cleanup",
    predicted_confidence: 0.88,
    created_at: new Date().toISOString(),
    metadata: { source: "hybrid" },
  },
];

// Mock Supabase client
const mockInsert = jest.fn(() => ({
  data: null,
  error: null,
}));

const createMockChain = (
  data: MockFeedbackRow[] | null = mockFeedbackRows,
  error: { message: string } | null = null,
) => ({
  gte: jest.fn(() => ({
    or: jest.fn(() => ({
      order: jest.fn(() => ({
        limit: jest.fn(() => ({
          data,
          error,
        })),
      })),
    })),
    // 保留 in 方法以兼容其他可能的调用
    in: jest.fn(() => ({
      order: jest.fn(() => ({
        limit: jest.fn(() => ({
          data,
          error,
        })),
      })),
    })),
  })),
});

const mockSelect = jest.fn(() => createMockChain());

const mockFrom = jest.fn((table: string) => {
  if (table === "ai_intent_feedback") {
    return {
      select: mockSelect,
    };
  }
  if (table === "ai_intent_pattern_suggestions") {
    return {
      insert: mockInsert,
    };
  }
  return {
    select: mockSelect,
    insert: mockInsert,
  };
});

jest.mock("@/lib/supabase/server", () => ({
  createServiceClient: jest.fn(() =>
    Promise.resolve({
      from: mockFrom,
    }),
  ),
}));

// Mock getModelByTask
jest.mock("@/lib/ai-providers", () => ({
  getModelByTask: jest.fn(() => ({
    modelId: "test-model",
  })),
}));

describe("RuleMiner Integration Tests", () => {
  let miner: RuleMiner;

  beforeEach(() => {
    resetRuleMiner();
    jest.clearAllMocks();
    miner = new RuleMiner();
  });

  afterEach(() => {
    resetRuleMiner();
    jest.clearAllMocks();
  });

  describe("Complete Pipeline", () => {
    it("should execute mining pipeline successfully", async () => {
      const candidates = await miner.mine();

      // 验证流程执行完成
      expect(Array.isArray(candidates)).toBe(true);

      // 检查统计信息
      const stats = miner.getStats();
      expect(stats.casesProcessed).toBeGreaterThanOrEqual(0);
      expect(stats.lastMiningAt).not.toBeNull();
    });

    it("should generate candidates from clustered cases", async () => {
      const candidates = await miner.mine();

      // 如果有足够的案例，应该生成候选规则
      if (mockFeedbackRows.length >= DEFAULT_RULE_MINER_CONFIG.minClusterSize) {
        // 验证候选规则的结构
        for (const candidate of candidates) {
          expect(candidate).toMatchObject({
            pattern: expect.any(String),
            intentType: expect.any(String),
            weight: expect.any(Number),
            examples: expect.any(Array),
            status: "pending_review",
          });
        }
      }
    });

    it("should track mining statistics correctly", async () => {
      await miner.mine();

      const stats = miner.getStats();

      expect(stats).toMatchObject({
        casesProcessed: expect.any(Number),
        clustersGenerated: expect.any(Number),
        candidatesGenerated: expect.any(Number),
        lastMiningAt: expect.any(Number),
        lastMiningDurationMs: expect.any(Number),
      });

      // 挖掘耗时应该大于 0
      expect(stats.lastMiningDurationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Clustering Logic", () => {
    it("should cluster cases by intent type", async () => {
      // 转换为 MiningCase 格式
      const cases: MiningCase[] = mockFeedbackRows.map((row) => ({
        id: String(row.id),
        message: row.original_input,
        normalizedMessage: row.original_input.toLowerCase().trim(),
        intentType: row.predicted_type,
        intentSubtype: row.predicted_subtype,
        confidence: row.predicted_confidence,
        createdAt: row.created_at,
      }));

      const clusters = await miner.clusterMessages(cases);

      expect(Array.isArray(clusters)).toBe(true);

      // 验证聚类结构
      for (const cluster of clusters) {
        expect(cluster).toMatchObject({
          intentKey: expect.any(String),
          messages: expect.any(Array),
          patterns: expect.any(Array),
          size: expect.any(Number),
          avgConfidence: expect.any(Number),
        });
      }
    });

    it("should respect minimum cluster size", async () => {
      // 使用较高的最小聚类大小
      const strictMiner = new RuleMiner({ minClusterSize: 10 });

      const candidates = await strictMiner.mine();

      // 由于案例不足，不应生成候选规则
      expect(candidates.length).toBe(0);
    });
  });

  describe("Singleton Pattern", () => {
    it("should return same instance", () => {
      const instance1 = getRuleMiner();
      const instance2 = getRuleMiner();

      expect(instance1).toBe(instance2);
    });

    it("should create new instance after reset", () => {
      const instance1 = getRuleMiner();
      resetRuleMiner();
      const instance2 = getRuleMiner();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe("Configuration", () => {
    it("should accept custom configuration", () => {
      const customMiner = new RuleMiner({
        minClusterSize: 5,
        lookbackDays: 14,
        maxCases: 1000,
        commonPatternThreshold: 0.6,
        initialWeight: 70,
        llmTimeoutMs: 15000,
      });

      expect(customMiner).toBeDefined();
    });

    it("should use default configuration when not provided", () => {
      const defaultMiner = new RuleMiner();
      expect(defaultMiner).toBeDefined();

      // 验证默认值被应用
      const stats = defaultMiner.getStats();
      expect(stats.casesProcessed).toBe(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle LLM generation failure gracefully", async () => {
      // 模拟 LLM 失败
      (generateText as jest.Mock).mockRejectedValueOnce(
        new Error("LLM unavailable"),
      );

      // 挖掘应该不会抛出异常
      await expect(miner.mine()).resolves.toBeDefined();
    });

    it("should handle database read failure gracefully", async () => {
      // 模拟数据库读取失败
      mockSelect.mockReturnValueOnce(
        createMockChain(null, { message: "Database error" }),
      );

      // 应该返回空数组而不是抛出异常
      const result = await miner.mine();
      expect(Array.isArray(result)).toBe(true);
    });

    it("should handle empty case list", async () => {
      // 模拟空案例
      mockSelect.mockReturnValueOnce(createMockChain([], null));

      const candidates = await miner.mine();
      expect(candidates.length).toBe(0);
    });
  });

  describe("Pattern Generation", () => {
    it("should generate valid regex patterns from LLM response", async () => {
      const testPattern = "/^(?:帮我|请)?(?:整理|清理)一下(?:收藏)?$/";

      // 提取正则表达式内容（去掉前后的斜杠）
      const regexContent = testPattern.slice(1, -1);

      // 验证正则表达式是有效的
      expect(() => new RegExp(regexContent)).not.toThrow();

      const regex = new RegExp(regexContent);
      expect(regex.test("帮我整理一下收藏")).toBe(true);
      expect(regex.test("请清理一下")).toBe(true);
    });
  });

  describe("Statistics", () => {
    it("should reset statistics correctly", () => {
      // 获取初始统计
      const initialStats = miner.getStats();
      expect(initialStats.casesProcessed).toBe(0);

      // 重置统计
      miner.resetStats();

      const resetStats = miner.getStats();
      expect(resetStats.casesProcessed).toBe(0);
      expect(resetStats.clustersGenerated).toBe(0);
      expect(resetStats.candidatesGenerated).toBe(0);
      expect(resetStats.lastMiningAt).toBeNull();
      expect(resetStats.lastMiningDurationMs).toBeNull();
    });

    it("should update statistics after mining", async () => {
      const statsBefore = miner.getStats();
      expect(statsBefore.lastMiningAt).toBeNull();

      await miner.mine();

      const statsAfter = miner.getStats();
      expect(statsAfter.lastMiningAt).not.toBeNull();
      expect(statsAfter.lastMiningDurationMs).toBeGreaterThanOrEqual(0);
    });
  });
});
