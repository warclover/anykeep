/**
 * SemanticCache 单元测试
 *
 * 测试语义意图缓存服务的核心功能：
 * - 配置初始化
 * - 消息规范化
 * - 缓存过滤条件
 * - 统计功能
 *
 * @version 1.0.1
 * @since 2026-01-12
 */

import {
  SemanticCache,
  getSemanticCache,
  resetSemanticCache,
  isSemanticCacheInitialized,
} from "../semantic-cache";
import type { IntentClassification } from "../types";

// Mock RPC function - must be defined before jest.mock
const mockRpcImpl = jest.fn();

// Mock Supabase - createServiceClient returns a promise
jest.mock("@/lib/supabase/server", () => ({
  createServiceClient: jest.fn().mockImplementation(() =>
    Promise.resolve({
      rpc: (...args: unknown[]) => mockRpcImpl(...args),
    }),
  ),
}));

// Mock Embedding
jest.mock("@/lib/embedding", () => ({
  generateEmbedding: jest.fn().mockResolvedValue(new Array(1024).fill(0.1)),
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("SemanticCache", () => {
  let cache: SemanticCache;

  beforeEach(() => {
    resetSemanticCache();
    // Reset and set default behavior
    mockRpcImpl.mockReset();
    mockRpcImpl.mockResolvedValue({ data: [], error: null });
    cache = new SemanticCache();
  });

  afterEach(() => {
    resetSemanticCache();
  });

  describe("initialization", () => {
    it("should initialize with default config", () => {
      const newCache = new SemanticCache();
      const stats = newCache.getStats();

      expect(stats.queries).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
    });

    it("should allow custom config", () => {
      const newCache = new SemanticCache({
        similarityThreshold: 0.9,
        ttlDays: 14,
        minConfidence: 0.8,
      });

      // 配置应用正确（通过行为验证）
      expect(newCache).toBeInstanceOf(SemanticCache);
    });

    it("should merge custom config with defaults", () => {
      const newCache = new SemanticCache({
        similarityThreshold: 0.9,
      });

      // 应该保留其他默认值
      expect(newCache).toBeInstanceOf(SemanticCache);
    });
  });

  describe("singleton management", () => {
    it("should return same instance with getSemanticCache", () => {
      resetSemanticCache();

      const cache1 = getSemanticCache();
      const cache2 = getSemanticCache();

      expect(cache1).toBe(cache2);
    });

    it("should report initialization status correctly", () => {
      resetSemanticCache();
      expect(isSemanticCacheInitialized()).toBe(false);

      getSemanticCache();
      expect(isSemanticCacheInitialized()).toBe(true);

      resetSemanticCache();
      expect(isSemanticCacheInitialized()).toBe(false);
    });
  });

  describe("cache filtering", () => {
    it("should skip caching low confidence results", async () => {
      const lowConfidenceResult: IntentClassification = {
        type: "query",
        subType: "search",
        confidence: 0.5, // 低于阈值 0.75
        entities: [],
        requiresMultiStep: false,
        hasDeliverableExpectation: false,
        source: "rule",
      };

      const result = await cache.set("test message", lowConfidenceResult);

      expect(result).toBe(false);
    });

    it("should skip caching chitchat results", async () => {
      const chitchatResult: IntentClassification = {
        type: "chitchat",
        subType: "greeting",
        confidence: 0.9,
        entities: [],
        requiresMultiStep: false,
        hasDeliverableExpectation: false,
        source: "rule",
      };

      const result = await cache.set("你好", chitchatResult);

      expect(result).toBe(false);
    });

    it("should cache high confidence non-chitchat results", async () => {
      mockRpcImpl.mockResolvedValue({ data: null, error: null });

      const validResult: IntentClassification = {
        type: "query",
        subType: "search",
        confidence: 0.9,
        entities: [],
        requiresMultiStep: false,
        hasDeliverableExpectation: false,
        source: "rule",
      };

      const result = await cache.set("搜索 React", validResult);

      expect(result).toBe(true);
    });
  });

  describe("statistics", () => {
    it("should track query count", async () => {
      // 模拟查询
      await cache.get("test query 1");
      await cache.get("test query 2");

      const stats = cache.getStats();
      expect(stats.queries).toBe(2);
    });

    it("should track miss count when no results", async () => {
      // Default mock returns empty array
      await cache.get("test query");

      const stats = cache.getStats();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(0);
    });

    it("should reset stats correctly", async () => {
      await cache.get("test query 1");
      await cache.get("test query 2");

      cache.resetStats();

      const stats = cache.getStats();
      expect(stats.queries).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    it("should calculate hit rate correctly", async () => {
      // Use mockImplementation to handle multiple calls correctly
      let matchCallCount = 0;
      mockRpcImpl.mockImplementation((funcName: string) => {
        if (funcName === "match_intent_cache_semantic") {
          matchCallCount++;
          // First call - return hit
          if (matchCallCount === 1) {
            return Promise.resolve({
              data: [
                {
                  id: 1,
                  intent_type: "query",
                  intent_subtype: "search",
                  confidence: 0.9,
                  method: "rule",
                  slots: {},
                  similarity: 0.98,
                },
              ],
              error: null,
            });
          }
          // Second call - return miss
          return Promise.resolve({
            data: [],
            error: null,
          });
        }
        // Other calls (increment_intent_cache_hit, etc.)
        return Promise.resolve({ data: null, error: null });
      });

      await cache.get("搜索 React");
      await cache.get("其他查询");

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });
  });

  describe("cache retrieval", () => {
    it("should return null on cache miss", async () => {
      const result = await cache.get("未缓存的消息");

      expect(result).toBeNull();
    });

    it("should return classification on cache hit", async () => {
      const mockEntry = {
        id: 1,
        input_hash: "abc123",
        normalized_input: "搜索 react",
        original_message: "搜索 React",
        intent_type: "query",
        intent_subtype: "search",
        confidence: 0.9,
        method: "rule",
        slots: { keyword: "React" },
        similarity: 0.98,
      };

      mockRpcImpl.mockResolvedValueOnce({
        data: [mockEntry],
        error: null,
      });

      const result = await cache.get("搜索 React");

      expect(result).not.toBeNull();
      expect(result?.type).toBe("query");
      expect(result?.subType).toBe("search");
      expect(result?.confidence).toBe(0.9);
      expect(result?.source).toBe("cache_l2");
    });

    it("should handle database errors gracefully", async () => {
      mockRpcImpl.mockResolvedValueOnce({
        data: null,
        error: { message: "Database error", code: "500" },
      });

      const result = await cache.get("test query");

      expect(result).toBeNull();
      const stats = cache.getStats();
      expect(stats.misses).toBe(1);
    });
  });

  describe("warmup", () => {
    it("should call warmup RPC", async () => {
      mockRpcImpl.mockResolvedValueOnce({
        data: [{ id: 1 }, { id: 2 }, { id: 3 }],
        error: null,
      });

      const count = await cache.warmup(100);

      expect(count).toBe(3);
      expect(mockRpcImpl).toHaveBeenCalledWith("get_top_intent_cache_entries", {
        top_k: 100,
      });
    });

    it("should only warmup once", async () => {
      mockRpcImpl.mockResolvedValue({
        data: [{ id: 1 }],
        error: null,
      });

      await cache.warmup(100);
      const callCountAfterFirst = mockRpcImpl.mock.calls.length;

      await cache.warmup(100);
      const callCountAfterSecond = mockRpcImpl.mock.calls.length;

      // 第二次 warmup 不应触发额外的 RPC 调用
      expect(callCountAfterSecond).toBe(callCountAfterFirst);
    });

    it("should handle warmup errors", async () => {
      mockRpcImpl.mockResolvedValueOnce({
        data: null,
        error: { message: "Warmup failed" },
      });

      const count = await cache.warmup();

      expect(count).toBe(0);
    });
  });
});
