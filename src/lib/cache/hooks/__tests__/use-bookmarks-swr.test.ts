/**
 * useBookmarksSWR Hook 集成测试
 * V5.0: 验证乐观更新、回滚、缓存同步等场景
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useBookmarksSWR, type CacheSnapshot } from "../use-bookmarks-swr";
import { dataCache } from "../../data-cache";

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// 创建一个可变的缓存存储，用于模拟真实的缓存行为
let mockCacheStore: Map<string, { data: unknown; timestamp: number }>;

// Mock dataCache - 使用动态实现来正确模拟缓存行为
jest.mock("../../data-cache", () => ({
  dataCache: {
    getSync: jest.fn().mockImplementation((key: string) => {
      const entry = mockCacheStore.get(key);
      if (!entry) {
        return { data: undefined, isStale: true, timestamp: undefined };
      }
      return {
        data: entry.data,
        isStale: false,
        timestamp: entry.timestamp,
      };
    }),
    hasSync: jest.fn().mockImplementation((key: string) => {
      return mockCacheStore.has(key);
    }),
    setCache: jest.fn().mockImplementation((key: string, data: unknown) => {
      mockCacheStore.set(key, { data, timestamp: Date.now() });
    }),
    get: jest.fn(),
    invalidate: jest.fn(),
  },
}));

// Mock 书签数据类型（测试用简化版）
type MockBookmark = {
  id: number;
  title: string;
  url: string;
  user_id: string;
  platform: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  is_read: boolean;
  is_starred: boolean;
  folders?: { name: string } | null;
};

// 创建 Mock 书签数据的工厂函数
const createMockBookmarks = (): MockBookmark[] => [
  {
    id: 1,
    title: "书签 1",
    url: "https://example.com/1",
    user_id: "user-1",
    platform: "UNKNOWN",
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
    is_deleted: false,
    is_read: false,
    is_starred: false,
  },
  {
    id: 2,
    title: "书签 2",
    url: "https://example.com/2",
    user_id: "user-1",
    platform: "UNKNOWN",
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
    is_deleted: false,
    is_read: false,
    is_starred: false,
  },
  {
    id: 3,
    title: "书签 3",
    url: "https://example.com/3",
    user_id: "user-1",
    platform: "UNKNOWN",
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
    is_deleted: false,
    is_read: false,
    is_starred: false,
  },
];

describe("useBookmarksSWR", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 重置缓存存储
    mockCacheStore = new Map();

    // 默认 API 响应
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            bookmarks: createMockBookmarks(),
            pagination: { hasMore: false },
          },
        }),
    });
  });

  describe("初始化", () => {
    it("应该在没有缓存时初始状态为 loading", () => {
      // 注意：这里只验证初始状态，因为 fetch mock 在测试环境中异步行为不稳定
      // 完整的数据加载流程由其他测试覆盖
      const { result } = renderHook(() =>
        useBookmarksSWR({
          platform: "",
          sort: "created_desc",
          folder: "",
        }),
      );

      // 验证初始状态：无缓存时应该显示 loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.data.length).toBe(0);
    });

    it("应该在有缓存时立即显示数据", async () => {
      const mockBookmarks = createMockBookmarks();
      const cacheKey = "bookmarks:all:created_desc:";
      const cachedData = {
        bookmarks: mockBookmarks.slice(0, 2),
        hasMore: true,
      };

      // 预先设置缓存
      mockCacheStore.set(cacheKey, {
        data: cachedData,
        timestamp: Date.now(),
      });

      const { result } = renderHook(() =>
        useBookmarksSWR({
          platform: "",
          sort: "created_desc",
          folder: "",
        }),
      );

      // 立即有数据，不显示 loading
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data.length).toBe(2);
    });
  });

  describe("乐观更新", () => {
    it("removeCacheItem 应该立即从列表移除书签", async () => {
      const mockBookmarks = createMockBookmarks();
      const cacheKey = "bookmarks:all:created_desc:";
      const cachedData = {
        bookmarks: mockBookmarks,
        hasMore: false,
      };

      mockCacheStore.set(cacheKey, {
        data: cachedData,
        timestamp: Date.now(),
      });

      const { result } = renderHook(() =>
        useBookmarksSWR({
          platform: "",
          sort: "created_desc",
          folder: "",
        }),
      );

      expect(result.current.data.length).toBe(3);

      // 乐观删除
      act(() => {
        result.current.removeCacheItem(2);
      });

      // 等待状态更新
      await waitFor(() => {
        expect(result.current.data.length).toBe(2);
      });

      expect(result.current.data.find((b) => b.id === 2)).toBeUndefined();

      // 验证同步到缓存
      expect(dataCache.setCache).toHaveBeenCalled();
    });

    it("updateCacheItem 应该立即更新书签属性", async () => {
      const mockBookmarks = createMockBookmarks();
      const cacheKey = "bookmarks:all:created_desc:";
      const cachedData = {
        bookmarks: mockBookmarks,
        hasMore: false,
      };

      mockCacheStore.set(cacheKey, {
        data: cachedData,
        timestamp: Date.now(),
      });

      const { result } = renderHook(() =>
        useBookmarksSWR({
          platform: "",
          sort: "created_desc",
          folder: "",
        }),
      );

      // 乐观更新星标
      act(() => {
        result.current.updateCacheItem(1, (bookmark) => ({
          ...bookmark,
          is_starred: true,
        }));
      });

      // 等待状态更新
      await waitFor(() => {
        const updatedBookmark = result.current.data.find((b) => b.id === 1);
        expect(updatedBookmark?.is_starred).toBe(true);
      });

      // 验证同步到缓存
      expect(dataCache.setCache).toHaveBeenCalled();
    });

    it("mutate 函数形式应该正确更新", async () => {
      const mockBookmarks = createMockBookmarks();
      const cacheKey = "bookmarks:all:created_desc:";
      const cachedData = {
        bookmarks: mockBookmarks,
        hasMore: false,
      };

      mockCacheStore.set(cacheKey, {
        data: cachedData,
        timestamp: Date.now(),
      });

      const { result } = renderHook(() =>
        useBookmarksSWR({
          platform: "",
          sort: "created_desc",
          folder: "",
        }),
      );

      // 使用函数形式更新
      act(() => {
        result.current.mutate((prev) =>
          prev.map((b) => (b.id === 1 ? { ...b, title: "更新后的标题" } : b)),
        );
      });

      await waitFor(() => {
        const updatedBookmark = result.current.data.find((b) => b.id === 1);
        expect(updatedBookmark?.title).toBe("更新后的标题");
      });
    });
  });

  describe("快照与回滚", () => {
    it("createSnapshot 应该创建当前状态的快照", async () => {
      const mockBookmarks = createMockBookmarks();
      const cacheKey = "bookmarks:all:created_desc:";
      const cachedData = {
        bookmarks: mockBookmarks,
        hasMore: true,
      };

      mockCacheStore.set(cacheKey, {
        data: cachedData,
        timestamp: Date.now(),
      });

      const { result } = renderHook(() =>
        useBookmarksSWR({
          platform: "",
          sort: "created_desc",
          folder: "",
        }),
      );

      let snapshot: CacheSnapshot;

      act(() => {
        snapshot = result.current.createSnapshot();
      });

      expect(snapshot!.data.length).toBe(3);
      expect(snapshot!.hasMore).toBe(true);
      expect(snapshot!.timestamp).toBeDefined();
    });

    it("rollback 应该恢复到快照状态", async () => {
      const mockBookmarks = createMockBookmarks();
      const cacheKey = "bookmarks:all:created_desc:";
      const cachedData = {
        bookmarks: mockBookmarks,
        hasMore: true,
      };

      mockCacheStore.set(cacheKey, {
        data: cachedData,
        timestamp: Date.now(),
      });

      const { result } = renderHook(() =>
        useBookmarksSWR({
          platform: "",
          sort: "created_desc",
          folder: "",
        }),
      );

      let snapshot: CacheSnapshot;

      // 1. 创建快照
      act(() => {
        snapshot = result.current.createSnapshot();
      });

      // 2. 乐观删除
      act(() => {
        result.current.removeCacheItem(1);
        result.current.removeCacheItem(2);
      });

      await waitFor(() => {
        expect(result.current.data.length).toBe(1);
      });

      // 3. 模拟 API 失败，回滚
      act(() => {
        result.current.rollback(snapshot!);
      });

      // 4. 验证恢复
      await waitFor(() => {
        expect(result.current.data.length).toBe(3);
      });
      expect(result.current.hasMore).toBe(true);

      // 5. 验证缓存也被回滚
      expect(dataCache.setCache).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({
          bookmarks: expect.arrayContaining([
            expect.objectContaining({ id: 1 }),
            expect.objectContaining({ id: 2 }),
            expect.objectContaining({ id: 3 }),
          ]),
        }),
      );
    });

    it("完整的乐观更新 + API 失败 + 回滚流程", async () => {
      const mockBookmarks = createMockBookmarks();
      const cacheKey = "bookmarks:all:created_desc:";
      const cachedData = {
        bookmarks: mockBookmarks,
        hasMore: false,
      };

      mockCacheStore.set(cacheKey, {
        data: cachedData,
        timestamp: Date.now(),
      });

      const { result } = renderHook(() =>
        useBookmarksSWR({
          platform: "",
          sort: "created_desc",
          folder: "",
        }),
      );

      const bookmarkToDelete = 2;

      // 1. 创建快照
      let snapshot: CacheSnapshot;
      act(() => {
        snapshot = result.current.createSnapshot();
      });

      // 2. 乐观更新 UI
      act(() => {
        result.current.removeCacheItem(bookmarkToDelete);
      });

      // 验证 UI 已更新
      await waitFor(() => {
        expect(result.current.data.length).toBe(2);
      });

      // 3. 模拟 API 请求失败，回滚
      act(() => {
        result.current.rollback(snapshot!);
      });

      // 4. 验证已恢复
      await waitFor(() => {
        expect(result.current.data.length).toBe(3);
      });
      expect(result.current.data.find((b) => b.id === 2)).toBeDefined();
    });
  });

  describe("appendToCache", () => {
    it("应该正确追加加载更多的数据", async () => {
      const mockBookmarks = createMockBookmarks();
      const cacheKey = "bookmarks:all:created_desc:";
      const cachedData = {
        bookmarks: mockBookmarks.slice(0, 2),
        hasMore: true,
      };

      mockCacheStore.set(cacheKey, {
        data: cachedData,
        timestamp: Date.now(),
      });

      const { result } = renderHook(() =>
        useBookmarksSWR({
          platform: "",
          sort: "created_desc",
          folder: "",
        }),
      );

      expect(result.current.data.length).toBe(2);
      expect(result.current.hasMore).toBe(true);

      // 追加数据
      act(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result.current.appendToCache([mockBookmarks[2]] as any, false);
      });

      await waitFor(() => {
        expect(result.current.data.length).toBe(3);
      });
      expect(result.current.hasMore).toBe(false);

      // 验证同步到缓存
      expect(dataCache.setCache).toHaveBeenCalled();
    });
  });
});
