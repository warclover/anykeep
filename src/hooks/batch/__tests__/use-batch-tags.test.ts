/**
 * useBatchTags Hook 单元测试
 * @description 测试批量标签操作 Hook 的核心功能
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useBatchTags } from "../use-batch-tags";

// Configure React 18 act environment
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

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

      let returnValue: unknown;
      await act(async () => {
        returnValue = await result.current.batchAddTags(
          [1, 2, 3],
          ["tag1", "tag2"],
        );
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/v1/bookmarks/batch/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          ids: [1, 2, 3],
          tags: ["tag1", "tag2"],
        }),
        credentials: "include",
      });

      expect(onSuccess).toHaveBeenCalledWith(mockResponse.data);
      expect(returnValue).toEqual(mockResponse.data);
    });

    it("处理中状态正确更新", async () => {
      // 使用延迟 promise 来测试中间状态
      let resolvePromise: (value: unknown) => void;
      const delayedPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockImplementationOnce(() => delayedPromise);

      const { result } = renderHook(() => useBatchTags());

      expect(result.current.isProcessing).toBe(false);

      // 启动异步操作但不等待完成
      let batchPromise: Promise<unknown>;
      act(() => {
        batchPromise = result.current.batchAddTags([1], ["tag"]);
      });

      // 等待 isProcessing 变为 true
      await waitFor(() => {
        expect(result.current.isProcessing).toBe(true);
      });

      // 完成 fetch 请求
      await act(async () => {
        resolvePromise!({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                affectedCount: 1,
                affectedIds: [1],
                tags: ["tag"],
                message: "已为 1 个书签添加 1 个标签",
              },
            }),
        });
        await batchPromise!;
      });

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

      expect(mockFetch).toHaveBeenCalledWith("/api/v1/bookmarks/batch/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove",
          ids: [1, 2],
          tags: ["oldTag"],
        }),
        credentials: "include",
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
            error: "部分书签不存在或无权操作",
          }),
      });

      const onError = jest.fn();
      const { result } = renderHook(() => useBatchTags({ onError }));

      await act(async () => {
        await result.current.batchAddTags([999], ["tag"]);
      });

      expect(onError).toHaveBeenCalled();
      expect(result.current.error).not.toBeNull();
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
