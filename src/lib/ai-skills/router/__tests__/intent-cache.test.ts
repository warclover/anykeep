/**
 * IntentCache 单元测试
 *
 * Phase 1 验收标准: LRU 缓存单元测试通过
 *
 * @version 1.0.0
 * @since 2026-01-13
 */

import {
  IntentCache,
  getIntentCache,
  resetIntentCache,
  isIntentCacheInitialized,
  DEFAULT_INTENT_CACHE_CONFIG,
  type IntentCacheConfig,
} from "../intent-cache";
import type { IntentClassification } from "../types";

describe("IntentCache", () => {
  let cache: IntentCache;

  // 测试用的分类结果
  const createClassification = (
    overrides: Partial<IntentClassification> = {},
  ): IntentClassification => ({
    type: "query",
    subType: "search",
    confidence: 0.9,
    entities: [],
    requiresMultiStep: false,
    hasDeliverableExpectation: false,
    source: "rule",
    ...overrides,
  });

  beforeEach(() => {
    resetIntentCache();
    cache = new IntentCache();
  });

  afterEach(() => {
    resetIntentCache();
  });

  describe("constructor", () => {
    it("should initialize with default config", () => {
      const defaultCache = new IntentCache();
      expect(defaultCache).toBeDefined();
    });

    it("should accept custom config", () => {
      const customConfig: Partial<IntentCacheConfig> = {
        maxSize: 5000,
        minConfidence: 0.8,
        storeOriginalMessage: true,
      };
      const customCache = new IntentCache(customConfig);
      expect(customCache).toBeDefined();
    });
  });

  describe("get/set basic operations", () => {
    it("should return null for cache miss", () => {
      const result = cache.get("不存在的消息");
      expect(result).toBeNull();
    });

    it("should cache and retrieve classification", () => {
      const message = "搜索 React 教程";
      const classification = createClassification();

      cache.set(message, classification);
      const cached = cache.get(message);

      expect(cached).not.toBeNull();
      expect(cached?.type).toBe("query");
      expect(cached?.subType).toBe("search");
      expect(cached?.source).toBe("cache_l1");
    });

    it("should normalize message keys (case insensitive)", () => {
      const message = "搜索 React";
      const classification = createClassification();

      cache.set(message, classification);

      // 不同大小写应该命中同一缓存
      expect(cache.get("搜索 react")).not.toBeNull();
      expect(cache.get("搜索 REACT")).not.toBeNull();
      expect(cache.get("  搜索 React  ")).not.toBeNull();
    });

    it("should normalize whitespace", () => {
      const classification = createClassification();

      cache.set("搜索   React   教程", classification);

      // 多个空格应该归一化
      expect(cache.get("搜索 React 教程")).not.toBeNull();
    });
  });

  describe("cache filtering", () => {
    it("should NOT cache low confidence results", () => {
      const message = "模糊请求";
      const lowConfidence = createClassification({ confidence: 0.5 });

      const result = cache.set(message, lowConfidence);

      expect(result).toBe(false);
      expect(cache.get(message)).toBeNull();
    });

    it("should NOT cache chitchat type", () => {
      const message = "你好";
      const chitchat = createClassification({
        type: "chitchat",
        confidence: 0.95,
      });

      const result = cache.set(message, chitchat);

      expect(result).toBe(false);
      expect(cache.get(message)).toBeNull();
    });

    it("should cache high confidence results", () => {
      const message = "搜索 Vue";
      const highConfidence = createClassification({ confidence: 0.85 });

      const result = cache.set(message, highConfidence);

      expect(result).toBe(true);
      expect(cache.get(message)).not.toBeNull();
    });

    it("should respect custom minConfidence threshold", () => {
      const strictCache = new IntentCache({ minConfidence: 0.9 });
      const message = "测试消息";
      const classification = createClassification({ confidence: 0.85 });

      const result = strictCache.set(message, classification);

      expect(result).toBe(false);
    });
  });

  describe("cache statistics", () => {
    it("should track hits and misses", () => {
      const classification = createClassification();
      cache.set("消息1", classification);

      // 1 hit
      cache.get("消息1");
      // 2 misses
      cache.get("消息2");
      cache.get("消息3");

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBeCloseTo(1 / 3, 2);
    });

    it("should track skipped entries", () => {
      // 低置信度跳过
      cache.set("低置信度", createClassification({ confidence: 0.3 }));
      // chitchat 跳过
      cache.set("闲聊", createClassification({ type: "chitchat" }));

      const stats = cache.getStats();
      expect(stats.skipped).toBe(2);
    });

    it("should reset stats correctly", () => {
      cache.set("消息", createClassification());
      cache.get("消息");
      cache.get("不存在");

      cache.resetStats();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.skipped).toBe(0);
    });

    it("should report correct cache size", () => {
      cache.set("消息1", createClassification());
      cache.set("消息2", createClassification());
      cache.set("消息3", createClassification());

      const stats = cache.getStats();
      expect(stats.size).toBe(3);
      expect(stats.maxSize).toBe(DEFAULT_INTENT_CACHE_CONFIG.maxSize);
    });
  });

  describe("cache operations", () => {
    it("should check existence with has()", () => {
      const message = "测试消息";
      cache.set(message, createClassification());

      expect(cache.has(message)).toBe(true);
      expect(cache.has("不存在")).toBe(false);
    });

    it("should delete entries", () => {
      const message = "要删除的消息";
      cache.set(message, createClassification());

      expect(cache.has(message)).toBe(true);

      const deleted = cache.delete(message);

      expect(deleted).toBe(true);
      expect(cache.has(message)).toBe(false);
    });

    it("should clear all entries", () => {
      cache.set("消息1", createClassification());
      cache.set("消息2", createClassification());
      cache.set("消息3", createClassification());

      cache.clear();

      expect(cache.getStats().size).toBe(0);
      expect(cache.get("消息1")).toBeNull();
    });
  });

  describe("hit count tracking", () => {
    it("should increment hit count on each access", () => {
      const message = "热门消息";
      cache.set(message, createClassification());

      // 访问 3 次
      cache.get(message);
      cache.get(message);
      cache.get(message);

      const topEntries = cache.getTopEntries(1);
      expect(topEntries[0].hitCount).toBe(3);
    });

    it("should return top entries sorted by hit count", () => {
      cache.set("冷门", createClassification());
      cache.set("热门", createClassification());
      cache.set("中等", createClassification());

      // 热门访问 5 次
      for (let i = 0; i < 5; i++) cache.get("热门");
      // 中等访问 2 次
      for (let i = 0; i < 2; i++) cache.get("中等");
      // 冷门访问 1 次
      cache.get("冷门");

      const top = cache.getTopEntries(3);

      expect(top[0].key).toContain("热门");
      expect(top[0].hitCount).toBe(5);
      expect(top[1].key).toContain("中等");
      expect(top[1].hitCount).toBe(2);
    });
  });

  describe("LRU eviction", () => {
    it("should evict least recently used entries when full", () => {
      const smallCache = new IntentCache({ maxSize: 3 });

      smallCache.set("第一", createClassification());
      smallCache.set("第二", createClassification());
      smallCache.set("第三", createClassification());

      // 缓存已满，添加新条目应该淘汰最旧的
      smallCache.set("第四", createClassification());

      expect(smallCache.getStats().size).toBe(3);
      expect(smallCache.has("第一")).toBe(false); // 被淘汰
      expect(smallCache.has("第四")).toBe(true);
    });

    it("should refresh age on get (updateAgeOnGet)", () => {
      const smallCache = new IntentCache({ maxSize: 3 });

      smallCache.set("第一", createClassification());
      smallCache.set("第二", createClassification());
      smallCache.set("第三", createClassification());

      // 访问第一个，刷新其年龄
      smallCache.get("第一");

      // 添加新条目，应该淘汰第二个（最旧的未访问条目）
      smallCache.set("第四", createClassification());

      expect(smallCache.has("第一")).toBe(true); // 被访问过，保留
      expect(smallCache.has("第二")).toBe(false); // 被淘汰
    });
  });

  describe("singleton management", () => {
    it("should return same instance from getIntentCache()", () => {
      const instance1 = getIntentCache();
      const instance2 = getIntentCache();

      expect(instance1).toBe(instance2);
    });

    it("should create new instance after reset", () => {
      const instance1 = getIntentCache();
      resetIntentCache();
      const instance2 = getIntentCache();

      expect(instance1).not.toBe(instance2);
    });

    it("should report initialization status", () => {
      resetIntentCache();
      expect(isIntentCacheInitialized()).toBe(false);

      getIntentCache();
      expect(isIntentCacheInitialized()).toBe(true);
    });
  });

  describe("source field", () => {
    it("should set source to cache_l1 on cache hit", () => {
      const message = "测试消息";
      const original = createClassification({ source: "rule" });

      cache.set(message, original);
      const cached = cache.get(message);

      expect(cached?.source).toBe("cache_l1");
    });
  });

  describe("edge cases", () => {
    it("should handle empty string message", () => {
      const result = cache.set("", createClassification());
      expect(result).toBe(true);
      expect(cache.get("")).not.toBeNull();
    });

    it("should handle very long messages", () => {
      const longMessage = "搜索 ".repeat(1000) + "内容";
      const result = cache.set(longMessage, createClassification());

      expect(result).toBe(true);
      expect(cache.get(longMessage)).not.toBeNull();
    });

    it("should handle unicode characters", () => {
      const unicodeMessage = "搜索 🚀 emoji 和日本語";
      const result = cache.set(unicodeMessage, createClassification());

      expect(result).toBe(true);
      expect(cache.get(unicodeMessage)).not.toBeNull();
    });

    it("should handle special characters", () => {
      const specialMessage = "搜索 $%^&*()[]{}";
      const result = cache.set(specialMessage, createClassification());

      expect(result).toBe(true);
      expect(cache.get(specialMessage)).not.toBeNull();
    });
  });
});
