/**
 * IntentCache 单元测试
 *
 * @version 1.0.0
 * @since 2026-02-01
 */

import { IntentCache, createIntentCache } from "../cache/intent-cache";
import type { ClassifierResult } from "../types";

// ============================================
// Mock 数据
// ============================================

function createMockResult(
  overrides: Partial<ClassifierResult> = {},
): ClassifierResult {
  return {
    intent: "query",
    subType: "search",
    confidence: 0.8,
    entities: [],
    reasoning: "test result",
    ...overrides,
  };
}

// ============================================
// 测试用例
// ============================================

describe("IntentCache", () => {
  let cache: IntentCache;

  beforeEach(() => {
    cache = new IntentCache();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("set 和 get", () => {
    it("应该正确存储和获取结果", () => {
      const result = createMockResult({ intent: "action" });

      cache.set("test message", "user1", result);
      const retrieved = cache.get("test message", "user1");

      expect(retrieved).toEqual(result);
    });

    it("应该区分不同用户的缓存", () => {
      const result1 = createMockResult({ intent: "query" });
      const result2 = createMockResult({ intent: "action" });

      cache.set("same message", "user1", result1);
      cache.set("same message", "user2", result2);

      expect(cache.get("same message", "user1")?.intent).toBe("query");
      expect(cache.get("same message", "user2")?.intent).toBe("action");
    });

    it("应该忽略大小写和空格", () => {
      const result = createMockResult();

      cache.set("  Test Message  ", "user1", result);
      const retrieved = cache.get("test message", "user1");

      expect(retrieved).toEqual(result);
    });

    it("不存在的键应该返回 null", () => {
      const result = cache.get("nonexistent", "user1");
      expect(result).toBeNull();
    });
  });

  describe("TTL 过期", () => {
    it("过期的缓存应该返回 null", () => {
      const result = createMockResult();

      cache.set("test", "user1", result, 1000); // 1秒 TTL

      // 前进 500ms，还没过期
      jest.advanceTimersByTime(500);
      expect(cache.get("test", "user1")).toEqual(result);

      // 再前进 600ms，过期了
      jest.advanceTimersByTime(600);
      expect(cache.get("test", "user1")).toBeNull();
    });

    it("应该使用自定义 TTL", () => {
      const customCache = new IntentCache({ defaultTTL: 10000 });
      const result = createMockResult();

      customCache.set("test", "user1", result);

      jest.advanceTimersByTime(9000);
      expect(customCache.get("test", "user1")).toEqual(result);

      jest.advanceTimersByTime(2000);
      expect(customCache.get("test", "user1")).toBeNull();
    });
  });

  describe("LRU 淘汰", () => {
    it("超过最大容量时应该淘汰最久未访问的", () => {
      const smallCache = new IntentCache({ maxSize: 3, enableLRU: true });

      smallCache.set("msg1", "user", createMockResult({ intent: "query" }));
      smallCache.set("msg2", "user", createMockResult({ intent: "action" }));
      smallCache.set("msg3", "user", createMockResult({ intent: "create" }));

      // 访问 msg1，使其成为最近访问的
      smallCache.get("msg1", "user");

      // 添加第4个，应该淘汰 msg2（最久未访问）
      smallCache.set("msg4", "user", createMockResult({ intent: "learn" }));

      expect(smallCache.get("msg1", "user")).not.toBeNull();
      expect(smallCache.get("msg2", "user")).toBeNull(); // 被淘汰
      expect(smallCache.get("msg3", "user")).not.toBeNull();
      expect(smallCache.get("msg4", "user")).not.toBeNull();
    });

    it("禁用 LRU 时应该淘汰第一个", () => {
      const fifoCache = new IntentCache({ maxSize: 2, enableLRU: false });

      fifoCache.set("msg1", "user", createMockResult());
      fifoCache.set("msg2", "user", createMockResult());
      fifoCache.set("msg3", "user", createMockResult());

      expect(fifoCache.get("msg1", "user")).toBeNull(); // 第一个被淘汰
      expect(fifoCache.get("msg2", "user")).not.toBeNull();
      expect(fifoCache.get("msg3", "user")).not.toBeNull();
    });
  });

  describe("delete", () => {
    it("应该正确删除缓存项", () => {
      const result = createMockResult();
      cache.set("test", "user1", result);

      expect(cache.delete("test", "user1")).toBe(true);
      expect(cache.get("test", "user1")).toBeNull();
    });

    it("删除不存在的项应该返回 false", () => {
      expect(cache.delete("nonexistent", "user1")).toBe(false);
    });
  });

  describe("clear", () => {
    it("应该清空所有缓存", () => {
      cache.set("msg1", "user1", createMockResult());
      cache.set("msg2", "user2", createMockResult());

      cache.clear();

      expect(cache.get("msg1", "user1")).toBeNull();
      expect(cache.get("msg2", "user2")).toBeNull();
    });

    it("清空后统计应该重置", () => {
      cache.set("msg", "user", createMockResult());
      cache.get("msg", "user"); // hit
      cache.get("miss", "user"); // miss

      cache.clear();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe("cleanup", () => {
    it("应该清理过期条目", () => {
      cache.set("short", "user", createMockResult(), 1000);
      cache.set("long", "user", createMockResult(), 10000);

      jest.advanceTimersByTime(2000);

      const cleaned = cache.cleanup();

      expect(cleaned).toBe(1);
      expect(cache.get("short", "user")).toBeNull();
      expect(cache.get("long", "user")).not.toBeNull();
    });
  });

  describe("getStats", () => {
    it("应该返回正确的统计信息", () => {
      cache.set("msg1", "user", createMockResult());
      cache.set("msg2", "user", createMockResult());

      cache.get("msg1", "user"); // hit
      cache.get("msg1", "user"); // hit
      cache.get("miss", "user"); // miss

      const stats = cache.getStats();

      expect(stats.size).toBe(2);
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(2 / 3);
    });

    it("应该统计过期条目数量", () => {
      cache.set("expired", "user", createMockResult(), 1000);
      cache.set("valid", "user", createMockResult(), 10000);

      jest.advanceTimersByTime(2000);

      const stats = cache.getStats();
      expect(stats.expiredCount).toBe(1);
    });

    it("无操作时命中率应该为 0", () => {
      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0);
    });
  });

  describe("访问计数", () => {
    it("多次访问应该增加访问计数", () => {
      const result = createMockResult();
      cache.set("msg", "user", result);

      // 访问多次
      cache.get("msg", "user");
      cache.get("msg", "user");
      cache.get("msg", "user");

      const stats = cache.getStats();
      expect(stats.hits).toBe(3);
    });
  });
});

describe("createIntentCache", () => {
  it("应该创建默认配置的缓存", () => {
    const cache = createIntentCache();
    expect(cache).toBeInstanceOf(IntentCache);
  });

  it("应该创建带配置的缓存", () => {
    const cache = createIntentCache({
      maxSize: 500,
      defaultTTL: 60000,
      enableLRU: false,
    });
    expect(cache).toBeInstanceOf(IntentCache);
  });
});
