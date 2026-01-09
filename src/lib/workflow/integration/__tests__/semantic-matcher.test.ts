/**
 * SemanticMatcher 单元测试
 *
 * @version 1.0.0
 * @since 2026-01-09
 */

// Unmock the global mock from jest.setup.ts to test the real implementation
jest.unmock("@/lib/workflow/integration/semantic-matcher");

import * as embeddingModule from "@/lib/embedding";

// Mock logger first
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock embedding service with default resolved values
jest.mock("@/lib/embedding", () => ({
  generateEmbedding: jest.fn().mockResolvedValue(Array(4).fill(0.5)),
  generateEmbeddingsBatch: jest.fn().mockResolvedValue([Array(4).fill(0.5)]),
}));

// Import after mocking
import {
  SemanticMatcher,
  getSemanticMatcher,
  resetSemanticMatcher,
} from "../semantic-matcher";

// Get references to mocked functions using jest.MockedFunction
const mockGenerateEmbedding =
  embeddingModule.generateEmbedding as jest.MockedFunction<
    typeof embeddingModule.generateEmbedding
  >;
const mockGenerateEmbeddingsBatch =
  embeddingModule.generateEmbeddingsBatch as jest.MockedFunction<
    typeof embeddingModule.generateEmbeddingsBatch
  >;

describe("SemanticMatcher", () => {
  let matcher: SemanticMatcher;

  // Helper: create normalized embedding vector
  const createEmbedding = (values: number[]): number[] => {
    // Normalize to unit vector
    const norm = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0));
    return values.map((v) => v / norm);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resetSemanticMatcher();
    matcher = new SemanticMatcher();
  });

  describe("match", () => {
    it("should return matched when similarity exceeds threshold", async () => {
      // High similarity embeddings (cosine similarity ~ 0.98)
      const userEmbedding = createEmbedding([1, 0, 0, 0]);
      const refEmbedding = createEmbedding([0.99, 0.1, 0, 0]);

      mockGenerateEmbedding.mockResolvedValue(userEmbedding);
      mockGenerateEmbeddingsBatch.mockResolvedValue([refEmbedding]);

      const result = await matcher.match("帮我看看有没有打不开的链接", {
        referenceTexts: ["检查我的书签是否还能正常访问"],
        threshold: 0.8,
      });

      expect(result.matched).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.bestMatchIndex).toBe(0);
      expect(result.bestMatchText).toBe("检查我的书签是否还能正常访问");
    });

    it("should return not matched when similarity below threshold", async () => {
      // Low similarity embeddings (cosine similarity ~ 0)
      const userEmbedding = createEmbedding([1, 0, 0, 0]);
      const refEmbedding = createEmbedding([0, 1, 0, 0]);

      mockGenerateEmbedding.mockResolvedValue(userEmbedding);
      mockGenerateEmbeddingsBatch.mockResolvedValue([refEmbedding]);

      const result = await matcher.match("今天天气不错", {
        referenceTexts: ["检查书签健康状况"],
        threshold: 0.75,
      });

      expect(result.matched).toBe(false);
      expect(result.confidence).toBeLessThan(0.75);
      expect(result.bestMatchIndex).toBeUndefined();
      expect(result.bestMatchText).toBeUndefined();
    });

    it("should use default threshold of 0.75 when not specified", async () => {
      // Medium similarity embeddings (cosine similarity ~ 0.7)
      const userEmbedding = createEmbedding([1, 0, 0, 0]);
      const refEmbedding = createEmbedding([0.7, 0.7, 0, 0]);

      mockGenerateEmbedding.mockResolvedValue(userEmbedding);
      mockGenerateEmbeddingsBatch.mockResolvedValue([refEmbedding]);

      const result = await matcher.match("测试消息", {
        referenceTexts: ["参考文本"],
        // No threshold specified - should use 0.75
      });

      // Cosine similarity is ~0.707, below default 0.75
      expect(result.matched).toBe(false);
    });

    it("should find best match among multiple reference texts", async () => {
      const userEmbedding = createEmbedding([1, 0, 0, 0]);
      const refEmbeddings = [
        createEmbedding([0, 1, 0, 0]), // Low similarity
        createEmbedding([0.99, 0.1, 0, 0]), // High similarity
        createEmbedding([0.5, 0.5, 0.5, 0.5]), // Medium similarity
      ];

      mockGenerateEmbedding.mockResolvedValue(userEmbedding);
      mockGenerateEmbeddingsBatch.mockResolvedValue(refEmbeddings);

      const result = await matcher.match("用户消息", {
        referenceTexts: ["参考1", "参考2", "参考3"],
        threshold: 0.8,
      });

      expect(result.matched).toBe(true);
      expect(result.bestMatchIndex).toBe(1);
      expect(result.bestMatchText).toBe("参考2");
    });

    it("should use precomputed embeddings when provided", async () => {
      const userEmbedding = createEmbedding([1, 0, 0, 0]);
      const precomputed = [createEmbedding([0.99, 0.1, 0, 0])];

      mockGenerateEmbedding.mockResolvedValue(userEmbedding);

      const result = await matcher.match("用户消息", {
        referenceTexts: ["参考文本"],
        threshold: 0.8,
        precomputedEmbeddings: precomputed,
      });

      expect(result.matched).toBe(true);
      // Should not call batch embedding since precomputed is provided
      expect(mockGenerateEmbeddingsBatch).not.toHaveBeenCalled();
    });

    it("should handle embedding generation failure gracefully", async () => {
      mockGenerateEmbedding.mockRejectedValue(new Error("API error"));

      const result = await matcher.match("用户消息", {
        referenceTexts: ["参考文本"],
        threshold: 0.75,
      });

      expect(result.matched).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it("should handle empty reference texts", async () => {
      const userEmbedding = createEmbedding([1, 0, 0, 0]);
      mockGenerateEmbedding.mockResolvedValue(userEmbedding);
      mockGenerateEmbeddingsBatch.mockResolvedValue([]);

      const result = await matcher.match("用户消息", {
        referenceTexts: [],
        threshold: 0.75,
      });

      expect(result.matched).toBe(false);
      expect(result.confidence).toBe(0);
    });
  });

  describe("precomputeEmbeddings", () => {
    it("should batch generate embeddings for reference texts", async () => {
      const embeddings = [
        createEmbedding([1, 0, 0, 0]),
        createEmbedding([0, 1, 0, 0]),
      ];
      mockGenerateEmbeddingsBatch.mockResolvedValue(embeddings);

      const result = await matcher.precomputeEmbeddings(["参考1", "参考2"]);

      expect(result).toEqual(embeddings);
      expect(mockGenerateEmbeddingsBatch).toHaveBeenCalledWith([
        "参考1",
        "参考2",
      ]);
    });

    it("should return empty array for empty input", async () => {
      const result = await matcher.precomputeEmbeddings([]);

      expect(result).toEqual([]);
      expect(mockGenerateEmbeddingsBatch).not.toHaveBeenCalled();
    });

    it("should cache precomputed embeddings", async () => {
      const embeddings = [createEmbedding([1, 0, 0, 0])];
      mockGenerateEmbeddingsBatch.mockResolvedValue(embeddings);

      await matcher.precomputeEmbeddings(["参考文本"]);

      const stats = matcher.getCacheStats();
      expect(stats.referenceCount).toBe(1);
    });

    it("should throw error when batch generation fails", async () => {
      mockGenerateEmbeddingsBatch.mockRejectedValue(new Error("API error"));

      await expect(matcher.precomputeEmbeddings(["参考文本"])).rejects.toThrow(
        "API error",
      );
    });
  });

  describe("cosineSimilarity", () => {
    it("should calculate correct similarity for identical vectors", () => {
      const cosineSimilarity = (
        matcher as unknown as {
          cosineSimilarity: (a: number[], b: number[]) => number;
        }
      ).cosineSimilarity.bind(matcher);

      const v = [0.5, 0.5, 0.5, 0.5];
      const result = cosineSimilarity(v, v);

      expect(result).toBeCloseTo(1, 5);
    });

    it("should calculate correct similarity for orthogonal vectors", () => {
      const cosineSimilarity = (
        matcher as unknown as {
          cosineSimilarity: (a: number[], b: number[]) => number;
        }
      ).cosineSimilarity.bind(matcher);

      const v1 = [1, 0, 0, 0];
      const v2 = [0, 1, 0, 0];
      const result = cosineSimilarity(v1, v2);

      expect(result).toBeCloseTo(0, 5);
    });

    it("should calculate correct similarity for opposite vectors", () => {
      const cosineSimilarity = (
        matcher as unknown as {
          cosineSimilarity: (a: number[], b: number[]) => number;
        }
      ).cosineSimilarity.bind(matcher);

      const v1 = [1, 0, 0, 0];
      const v2 = [-1, 0, 0, 0];
      const result = cosineSimilarity(v1, v2);

      expect(result).toBeCloseTo(-1, 5);
    });

    it("should return 0 for dimension mismatch", () => {
      const cosineSimilarity = (
        matcher as unknown as {
          cosineSimilarity: (a: number[], b: number[]) => number;
        }
      ).cosineSimilarity.bind(matcher);

      const v1 = [1, 0, 0];
      const v2 = [1, 0, 0, 0];
      const result = cosineSimilarity(v1, v2);

      expect(result).toBe(0);
    });

    it("should return 0 for zero vectors", () => {
      const cosineSimilarity = (
        matcher as unknown as {
          cosineSimilarity: (a: number[], b: number[]) => number;
        }
      ).cosineSimilarity.bind(matcher);

      const v1 = [0, 0, 0, 0];
      const v2 = [1, 0, 0, 0];
      const result = cosineSimilarity(v1, v2);

      expect(result).toBe(0);
    });
  });

  describe("cache management", () => {
    it("should cache message embeddings", async () => {
      const embedding = createEmbedding([1, 0, 0, 0]);
      mockGenerateEmbedding.mockResolvedValue(embedding);
      mockGenerateEmbeddingsBatch.mockResolvedValue([embedding]);

      // First call
      await matcher.match("测试消息", {
        referenceTexts: ["参考"],
        threshold: 0.5,
      });

      // Second call with same message
      await matcher.match("测试消息", {
        referenceTexts: ["参考"],
        threshold: 0.5,
      });

      // Should only generate message embedding once (cached on second call)
      expect(mockGenerateEmbedding).toHaveBeenCalledTimes(1);
    });

    it("should cache reference embeddings", async () => {
      const embedding = createEmbedding([1, 0, 0, 0]);
      mockGenerateEmbedding.mockResolvedValue(embedding);
      mockGenerateEmbeddingsBatch.mockResolvedValue([embedding]);

      // First call
      await matcher.match("消息1", {
        referenceTexts: ["参考文本"],
        threshold: 0.5,
      });

      // Reset message embedding mock
      mockGenerateEmbedding.mockClear();
      mockGenerateEmbedding.mockResolvedValue(createEmbedding([0, 1, 0, 0]));

      // Second call with different message but same reference
      await matcher.match("消息2", {
        referenceTexts: ["参考文本"],
        threshold: 0.5,
      });

      // Reference embedding should be cached
      expect(mockGenerateEmbeddingsBatch).toHaveBeenCalledTimes(1);
    });

    it("should clear cache properly", async () => {
      const embedding = createEmbedding([1, 0, 0, 0]);
      mockGenerateEmbedding.mockResolvedValue(embedding);
      mockGenerateEmbeddingsBatch.mockResolvedValue([embedding]);

      // First call to populate cache
      await matcher.match("测试消息", {
        referenceTexts: ["参考"],
        threshold: 0.5,
      });

      expect(matcher.getCacheStats().messageCount).toBe(1);
      expect(matcher.getCacheStats().referenceCount).toBe(1);

      // Clear cache
      matcher.clearCache();

      expect(matcher.getCacheStats().messageCount).toBe(0);
      expect(matcher.getCacheStats().referenceCount).toBe(0);
    });

    it("should normalize cache keys (case insensitive)", async () => {
      const embedding = createEmbedding([1, 0, 0, 0]);
      mockGenerateEmbedding.mockResolvedValue(embedding);
      mockGenerateEmbeddingsBatch.mockResolvedValue([embedding]);

      // First call with uppercase
      await matcher.match("HELLO", {
        referenceTexts: ["参考"],
        threshold: 0.5,
      });

      // Second call with lowercase
      await matcher.match("hello", {
        referenceTexts: ["参考"],
        threshold: 0.5,
      });

      // Should use cached embedding (case insensitive)
      expect(mockGenerateEmbedding).toHaveBeenCalledTimes(1);
    });
  });

  describe("singleton", () => {
    it("should return same instance from getSemanticMatcher", () => {
      const instance1 = getSemanticMatcher();
      const instance2 = getSemanticMatcher();

      expect(instance1).toBe(instance2);
    });

    it("should reset instance with resetSemanticMatcher", () => {
      const instance1 = getSemanticMatcher();
      resetSemanticMatcher();
      const instance2 = getSemanticMatcher();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe("getCacheStats", () => {
    it("should return correct cache statistics", async () => {
      const embedding = createEmbedding([1, 0, 0, 0]);
      mockGenerateEmbedding.mockResolvedValue(embedding);
      mockGenerateEmbeddingsBatch.mockResolvedValue([embedding, embedding]);

      await matcher.match("消息", {
        referenceTexts: ["参考1", "参考2"],
        threshold: 0.5,
      });

      const stats = matcher.getCacheStats();

      expect(stats.messageCount).toBe(1);
      expect(stats.referenceCount).toBe(2);
    });
  });
});
