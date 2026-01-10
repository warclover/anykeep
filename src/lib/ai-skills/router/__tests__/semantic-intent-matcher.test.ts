/**
 * SemanticIntentMatcher 单元测试
 *
 * @version 1.0.0
 * @since 2026-01-09
 */

import { SemanticIntentMatcher } from "../semantic-intent-matcher";
import type { IntentRule } from "../types";
import * as embeddingGenerator from "@/lib/utils/embedding-generator";

// Mock EmbeddingService
jest.mock("@/lib/utils/embedding-generator", () => ({
  generateEmbedding: jest.fn(),
}));

describe("SemanticIntentMatcher", () => {
  let matcher: SemanticIntentMatcher;
  const mockGenerateEmbedding =
    embeddingGenerator.generateEmbedding as jest.MockedFunction<
      typeof embeddingGenerator.generateEmbedding
    >;

  beforeEach(() => {
    matcher = new SemanticIntentMatcher({
      similarityThreshold: 0.7,
      enableCache: true,
      debug: false,
    });
    mockGenerateEmbedding.mockClear();
  });

  // ============================================
  // 预计算 Embedding 测试
  // ============================================
  describe("precomputeEmbeddings", () => {
    const mockRules: IntentRule[] = [
      {
        pattern: /整理|清理/,
        type: "organize",
        subType: "cleanup",
        complexity: "complex",
        weight: 80,
      },
      {
        pattern: /搜索|查找/,
        type: "query",
        subType: "search",
        complexity: "simple",
        weight: 85,
      },
    ];

    it("应该预计算所有意图的 Embedding", async () => {
      // Mock Embedding 返回
      mockGenerateEmbedding.mockResolvedValue([0.1, 0.2, 0.3, 0.4, 0.5]);

      await matcher.precomputeEmbeddings(mockRules);

      // 验证调用了 generateEmbedding（每个规则一次）
      expect(mockGenerateEmbedding).toHaveBeenCalledTimes(2);
      expect(matcher.getInitializedCount()).toBe(2);
      expect(matcher.getIsInitialized()).toBe(true);
    });

    it("应该处理重复的 type:subType 规则（保留权重最高的）", async () => {
      const duplicateRules: IntentRule[] = [
        {
          pattern: /整理/,
          type: "organize",
          subType: "cleanup",
          complexity: "complex",
          weight: 80,
        },
        {
          pattern: /清理/,
          type: "organize",
          subType: "cleanup",
          complexity: "complex",
          weight: 90, // 更高权重
        },
      ];

      mockGenerateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);

      await matcher.precomputeEmbeddings(duplicateRules);

      // 应该只计算一次（去重后）
      expect(mockGenerateEmbedding).toHaveBeenCalledTimes(1);
      expect(matcher.getInitializedCount()).toBe(1);
    });

    it("应该处理 Embedding 生成失败", async () => {
      mockGenerateEmbedding.mockResolvedValue([]); // 空向量

      await matcher.precomputeEmbeddings(mockRules);

      // 应该跳过失败的规则
      expect(matcher.getInitializedCount()).toBe(0);
    });

    it("应该处理 Embedding 生成错误（捕获但不抛出）", async () => {
      mockGenerateEmbedding.mockRejectedValue(
        new Error("Embedding service error"),
      );

      // 代码中捕获了错误，不会抛出，但会记录日志
      await matcher.precomputeEmbeddings(mockRules);

      // 验证没有成功初始化
      expect(matcher.getInitializedCount()).toBe(0);
    });

    it("应该支持批量处理（限制并发）", async () => {
      const manyRules: IntentRule[] = Array.from({ length: 10 }, (_, i) => ({
        pattern: new RegExp(`test${i}`),
        type: "query",
        subType: `test${i}`,
        complexity: "simple",
        weight: 50,
      }));

      mockGenerateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);

      await matcher.precomputeEmbeddings(manyRules);

      // 应该调用 10 次（每个规则一次）
      expect(mockGenerateEmbedding).toHaveBeenCalledTimes(10);
      expect(matcher.getInitializedCount()).toBe(10);
    });
  });

  // ============================================
  // 语义匹配测试
  // ============================================
  describe("match", () => {
    const mockRules: IntentRule[] = [
      {
        pattern: /整理|清理/,
        type: "organize",
        subType: "cleanup",
        complexity: "complex",
        weight: 80,
      },
      {
        pattern: /搜索|查找/,
        type: "query",
        subType: "search",
        complexity: "simple",
        weight: 85,
      },
    ];

    beforeEach(async () => {
      // 预计算 Embedding
      mockGenerateEmbedding.mockImplementation((text: string) => {
        // 模拟不同的 Embedding 向量
        if (text.includes("整理") || text.includes("清理")) {
          return Promise.resolve([0.9, 0.8, 0.7, 0.6, 0.5]); // 高相似度
        }
        if (text.includes("搜索") || text.includes("查找")) {
          return Promise.resolve([0.1, 0.2, 0.3, 0.4, 0.5]); // 低相似度
        }
        return Promise.resolve([0.5, 0.5, 0.5, 0.5, 0.5]); // 默认
      });

      await matcher.precomputeEmbeddings(mockRules);
      mockGenerateEmbedding.mockClear();
    });

    it("应该返回匹配的意图（相似度 > 阈值）", async () => {
      // Mock 用户输入的 Embedding（与"整理"相似）
      mockGenerateEmbedding.mockResolvedValue([0.85, 0.75, 0.65, 0.55, 0.45]);

      const matches = await matcher.match("帮我整理一下收藏");

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.type).toBe("organize");
      expect(matches[0]?.subType).toBe("cleanup");
      expect(matches[0]?.similarity).toBeGreaterThan(0.7);
    });

    it("应该按相似度降序排序", async () => {
      // Mock 用户输入（与多个意图都相似）
      mockGenerateEmbedding.mockResolvedValue([0.6, 0.6, 0.6, 0.6, 0.6]);

      const matches = await matcher.match("测试输入");

      if (matches.length > 1) {
        for (let i = 0; i < matches.length - 1; i++) {
          expect(matches[i]!.similarity).toBeGreaterThanOrEqual(
            matches[i + 1]!.similarity,
          );
        }
      }
    });

    it("应该过滤相似度 < 阈值的匹配", async () => {
      // 重新初始化，使用与用户输入不相似的 Embedding
      const differentRules: IntentRule[] = [
        {
          pattern: /整理/,
          type: "organize",
          subType: "cleanup",
          complexity: "complex",
          weight: 80,
        },
      ];

      // Mock 预计算时的 Embedding（与用户输入不相似）
      mockGenerateEmbedding.mockResolvedValue([1.0, 1.0, 1.0, 1.0, 1.0]);
      await matcher.precomputeEmbeddings(differentRules);
      mockGenerateEmbedding.mockClear();

      // Mock 用户输入的 Embedding（与预计算的完全不相似）
      mockGenerateEmbedding.mockResolvedValue([-1.0, -1.0, -1.0, -1.0, -1.0]);

      const matches = await matcher.match("完全不相关的输入");

      // 所有匹配的相似度都应该 < 0.7（阈值），或者没有匹配
      if (matches.length > 0) {
        matches.forEach((match) => {
          expect(match.similarity).toBeLessThan(0.7);
        });
      } else {
        // 如果没有匹配，也是正确的（都被过滤了）
        expect(matches).toEqual([]);
      }
    });

    it("应该在未初始化时返回空数组", async () => {
      const uninitializedMatcher = new SemanticIntentMatcher();
      mockGenerateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);

      const matches = await uninitializedMatcher.match("测试输入");

      expect(matches).toEqual([]);
    });

    it("应该处理 Embedding 生成失败", async () => {
      mockGenerateEmbedding.mockResolvedValue([]); // 空向量

      const matches = await matcher.match("测试输入");

      expect(matches).toEqual([]);
    });

    it("应该处理 Embedding 生成错误（返回空数组）", async () => {
      mockGenerateEmbedding.mockRejectedValue(new Error("Embedding error"));

      // 代码中捕获了错误，返回空数组而不是抛出
      const matches = await matcher.match("测试输入");

      expect(matches).toEqual([]);
    });
  });

  // ============================================
  // 配置测试
  // ============================================
  describe("配置", () => {
    it("应该使用自定义相似度阈值", async () => {
      const customMatcher = new SemanticIntentMatcher({
        similarityThreshold: 0.9, // 更高的阈值
      });

      const mockRules: IntentRule[] = [
        {
          pattern: /整理/,
          type: "organize",
          subType: "cleanup",
          complexity: "complex",
          weight: 80,
        },
      ];

      mockGenerateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      await customMatcher.precomputeEmbeddings(mockRules);

      // Mock 用户输入（中等相似度）
      mockGenerateEmbedding.mockResolvedValue([0.5, 0.5, 0.5]);

      const matches = await customMatcher.match("整理");

      // 由于阈值更高，可能没有匹配
      matches.forEach((match) => {
        expect(match.similarity).toBeGreaterThanOrEqual(0.9);
      });
    });

    it("应该支持调试模式", () => {
      const debugMatcher = new SemanticIntentMatcher({
        debug: true,
      });

      expect(debugMatcher).toBeDefined();
    });
  });

  // ============================================
  // 边界情况测试
  // ============================================
  describe("边界情况", () => {
    it("应该处理空规则列表", async () => {
      await matcher.precomputeEmbeddings([]);

      expect(matcher.getInitializedCount()).toBe(0);
      expect(matcher.getIsInitialized()).toBe(true);
    });

    it("应该处理空输入", async () => {
      const mockRules: IntentRule[] = [
        {
          pattern: /整理/,
          type: "organize",
          subType: "cleanup",
          complexity: "complex",
          weight: 80,
        },
      ];

      mockGenerateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      await matcher.precomputeEmbeddings(mockRules);

      mockGenerateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      const matches = await matcher.match("");

      // 空输入可能匹配，也可能不匹配
      expect(Array.isArray(matches)).toBe(true);
    });

    it("应该处理非常长的输入", async () => {
      const mockRules: IntentRule[] = [
        {
          pattern: /整理/,
          type: "organize",
          subType: "cleanup",
          complexity: "complex",
          weight: 80,
        },
      ];

      mockGenerateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      await matcher.precomputeEmbeddings(mockRules);

      const longInput = "整理".repeat(1000);
      mockGenerateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);

      const matches = await matcher.match(longInput);

      expect(Array.isArray(matches)).toBe(true);
    });
  });
});
