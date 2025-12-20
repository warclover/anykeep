/**
 * useBatchTags Hook 单元测试
 * @description 测试批量标签操作 Hook 的核心功能
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useBatchTags } from "../use-batch-tags";

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock toast
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe("useBatchTags", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  describe("初始状态", () => {
    it("isProcessing 初始为 false", () => {
      const { result } = renderHook(() => useBatchTags());

      expect(result.current.isProcessing).toBe(false);
    });

    it("提供 batchAddTags 方法", () => {
      const { result } = renderHook(() => useBatchTags());

      expect(typeof result.current.batchAddTags).toBe("function");
    });

    it("提供 batchRemoveTags 方法", () => {
      const { result } = renderHook(() => useBatchTags());

      expect(typeof result.current.batchRemoveTags).toBe("function");
    });
  });

  describe("batchAddTags 操作", () => {
    it("成功添加标签时返回结果", async () => {
      const mockResponse = {
        success: true,
        data: {
          action: "add",
          affectedCount: 3,
          affectedIds: [1, 2, 3],
          tags: ["tag1", "tag2"],
          message: "已为 3 个书签添加 2 个标签",
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const onSuccess = jest.fn();
      const { result } = renderHook(() => useBatchTags({ onSuccess }));

      await act(async () => {
        await result.current.batchAddTags([1, 2, 3], ["tag1", "tag2"]);
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/bookmarks/batch-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          bookmarkIds: [1, 2, 3],
          tags: ["tag1", "tag2"],
        }),
      });

      expect(onSuccess).toHaveBeenCalledWith(mockResponse.data);
    });

    it("处理中状态正确更新", async () => {
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: () =>
                    Promise.resolve({
                      success: true,
                      data: {
                        affectedCount: 1,
                        affectedIds: [1],
                        tags: ["tag"],
                      },
                    }),
                }),
              100,
            ),
          ),
      );

      const { result } = renderHook(() => useBatchTags());

      expect(result.current.isProcessing).toBe(false);

      const promise = act(async () => {
        await result.current.batchAddTags([1], ["tag"]);
      });

      // 等待状态变为处理中
      await waitFor(() => {
        expect(result.current.isProcessing).toBe(true);
      });

      await promise;

      expect(result.current.isProcessing).toBe(false);
    });
  });

  describe("batchRemoveTags 操作", () => {
    it("成功移除标签时返回结果", async () => {
      const mockResponse = {
        success: true,
        data: {
          action: "remove",
          affectedCount: 2,
          affectedIds: [1, 2],
          tags: ["oldTag"],
          message: "已从 2 个书签移除 1 个标签",
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const onSuccess = jest.fn();
      const { result } = renderHook(() => useBatchTags({ onSuccess }));

      await act(async () => {
        await result.current.batchRemoveTags([1, 2], ["oldTag"]);
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/bookmarks/batch-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove",
          bookmarkIds: [1, 2],
          tags: ["oldTag"],
        }),
      });

      expect(onSuccess).toHaveBeenCalledWith(mockResponse.data);
    });
  });

  describe("错误处理", () => {
    it("API 返回错误时调用 onError", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () =>
          Promise.resolve({
            success: false,
            error: { message: "部分书签不存在或无权操作" },
          }),
      });

      const onError = jest.fn();
      const { result } = renderHook(() => useBatchTags({ onError }));

      await act(async () => {
        await result.current.batchAddTags([999], ["tag"]);
      });

      expect(onError).toHaveBeenCalled();
    });

    it("网络错误时调用 onError", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const onError = jest.fn();
      const { result } = renderHook(() => useBatchTags({ onError }));

      await act(async () => {
        await result.current.batchAddTags([1], ["tag"]);
      });

      expect(onError).toHaveBeenCalled();
    });

    it("错误后 isProcessing 重置为 false", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() => useBatchTags());

      await act(async () => {
        await result.current.batchAddTags([1], ["tag"]);
      });

      expect(result.current.isProcessing).toBe(false);
    });
  });

  describe("参数验证", () => {
    it("空书签 ID 数组不发起请求", async () => {
      const { result } = renderHook(() => useBatchTags());

      await act(async () => {
        await result.current.batchAddTags([], ["tag"]);
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("空标签数组不发起请求", async () => {
      const { result } = renderHook(() => useBatchTags());

      await act(async () => {
        await result.current.batchAddTags([1], []);
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
