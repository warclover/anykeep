/**
 * 持久化存储层单元测试
 * V5.0: 验证 localStorage 缓存的恢复、持久化、过期等场景
 */

import { persistentStorage } from "../persistent-storage";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    key: jest.fn((index: number) => Object.keys(store)[index] || null),
    get length() {
      return Object.keys(store).length;
    },
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

describe("PersistentStorage", () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  describe("restore", () => {
    it("应该在没有缓存时返回 null", () => {
      const result = persistentStorage.restore();
      expect(result).toBeNull();
    });

    it("应该成功恢复有效的缓存数据", () => {
      const mockCache = {
        version: 1,
        timestamp: Date.now(),
        entries: {
          "bookmarks:all:created_desc:": {
            data: { bookmarks: [{ id: 1, title: "Test" }], hasMore: false },
            timestamp: Date.now(),
          },
        },
      };

      localStorageMock.setItem("anykeep:cache:v1", JSON.stringify(mockCache));

      const result = persistentStorage.restore();

      expect(result).not.toBeNull();
      expect(result?.size).toBe(1);
      expect(result?.has("bookmarks:all:created_desc:")).toBe(true);
    });

    it("应该拒绝版本不匹配的缓存", () => {
      const mockCache = {
        version: 999, // 错误版本
        timestamp: Date.now(),
        entries: {},
      };

      localStorageMock.setItem("anykeep:cache:v1", JSON.stringify(mockCache));

      const result = persistentStorage.restore();

      expect(result).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(
        "anykeep:cache:v1",
      );
    });

    it("应该拒绝已过期的缓存（24小时）", () => {
      const mockCache = {
        version: 1,
        timestamp: Date.now() - 25 * 60 * 60 * 1000, // 25小时前
        entries: {
          "bookmarks:all:created_desc:": {
            data: { bookmarks: [], hasMore: false },
            timestamp: Date.now() - 25 * 60 * 60 * 1000,
          },
        },
      };

      localStorageMock.setItem("anykeep:cache:v1", JSON.stringify(mockCache));

      const result = persistentStorage.restore();

      expect(result).toBeNull();
    });

    it("应该过滤掉单条过期的条目", () => {
      const now = Date.now();
      const mockCache = {
        version: 1,
        timestamp: now,
        entries: {
          "bookmarks:fresh:": {
            data: { bookmarks: [{ id: 1 }], hasMore: false },
            timestamp: now, // 新鲜
          },
          "bookmarks:stale:": {
            data: { bookmarks: [{ id: 2 }], hasMore: false },
            timestamp: now - 25 * 60 * 60 * 1000, // 过期
          },
        },
      };

      localStorageMock.setItem("anykeep:cache:v1", JSON.stringify(mockCache));

      const result = persistentStorage.restore();

      expect(result?.size).toBe(1);
      expect(result?.has("bookmarks:fresh:")).toBe(true);
      expect(result?.has("bookmarks:stale:")).toBe(false);
    });

    it("应该处理无效的 JSON 数据", () => {
      localStorageMock.setItem("anykeep:cache:v1", "invalid json {{{");

      const result = persistentStorage.restore();

      expect(result).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(
        "anykeep:cache:v1",
      );
    });
  });

  describe("persist", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("应该防抖持久化操作", () => {
      const entries = new Map();
      entries.set("bookmarks:test:", {
        data: { bookmarks: [], hasMore: false },
        timestamp: Date.now(),
        isValidating: false,
      });

      // 连续调用多次
      persistentStorage.persist(entries);
      persistentStorage.persist(entries);
      persistentStorage.persist(entries);

      // 还没有持久化
      expect(localStorageMock.setItem).not.toHaveBeenCalled();

      // 等待防抖时间
      jest.advanceTimersByTime(500);

      // 只持久化一次
      expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);
    });

    it("应该只持久化 bookmarks: 前缀的数据", () => {
      const entries = new Map();
      entries.set("bookmarks:test:", {
        data: { bookmarks: [], hasMore: false },
        timestamp: Date.now(),
        isValidating: false,
      });
      entries.set("other:data:", {
        data: { something: "else" },
        timestamp: Date.now(),
        isValidating: false,
      });

      persistentStorage.persist(entries);
      jest.advanceTimersByTime(500);

      const savedData = JSON.parse(
        localStorageMock.setItem.mock.calls[0][1] as string,
      );
      expect(Object.keys(savedData.entries)).toEqual(["bookmarks:test:"]);
    });

    it("应该限制最多 10 个条目", () => {
      const entries = new Map();
      for (let i = 0; i < 15; i++) {
        entries.set(`bookmarks:key${i}:`, {
          data: { bookmarks: [], hasMore: false },
          timestamp: Date.now(),
          isValidating: false,
        });
      }

      persistentStorage.persist(entries);
      jest.advanceTimersByTime(500);

      const savedData = JSON.parse(
        localStorageMock.setItem.mock.calls[0][1] as string,
      );
      expect(Object.keys(savedData.entries).length).toBe(10);
    });
  });

  describe("clear", () => {
    it("应该清除缓存", () => {
      localStorageMock.setItem("anykeep:cache:v1", "some data");

      persistentStorage.clear();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith(
        "anykeep:cache:v1",
      );
    });
  });

  describe("has", () => {
    it("应该正确检测缓存存在", () => {
      expect(persistentStorage.has()).toBe(false);

      localStorageMock.setItem("anykeep:cache:v1", "{}");

      expect(persistentStorage.has()).toBe(true);
    });
  });

  describe("getStats", () => {
    it("应该返回正确的统计信息", () => {
      const mockCache = {
        version: 1,
        timestamp: Date.now() - 1000,
        entries: {
          "bookmarks:a:": { data: {}, timestamp: Date.now() },
          "bookmarks:b:": { data: {}, timestamp: Date.now() },
        },
      };

      localStorageMock.setItem("anykeep:cache:v1", JSON.stringify(mockCache));

      const stats = persistentStorage.getStats();

      expect(stats.hasCache).toBe(true);
      expect(stats.entryCount).toBe(2);
      expect(stats.sizeKB).toBeGreaterThan(0);
      expect(stats.age).toBeGreaterThanOrEqual(1000);
    });

    it("应该在无缓存时返回空统计", () => {
      const stats = persistentStorage.getStats();

      expect(stats.hasCache).toBe(false);
      expect(stats.entryCount).toBe(0);
      expect(stats.sizeKB).toBe(0);
      expect(stats.age).toBeNull();
    });
  });
});
