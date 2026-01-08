/**
 * useSaveToNote Hook 单元测试
 * @description 测试保存到笔记功能的核心 Hook
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useSaveToNote } from "../use-save-to-note";

// Configure React 18 act environment
(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock toast
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    custom: jest.fn(),
    dismiss: jest.fn(),
  },
}));

describe("useSaveToNote", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("初始状态", () => {
    it("state 初始为 idle", () => {
      const { result } = renderHook(() => useSaveToNote());

      expect(result.current.state).toBe("idle");
    });

    it("duplicateInfo 初始为 null", () => {
      const { result } = renderHook(() => useSaveToNote());

      expect(result.current.duplicateInfo).toBeNull();
    });

    it("savedNote 初始为 null", () => {
      const { result } = renderHook(() => useSaveToNote());

      expect(result.current.savedNote).toBeNull();
    });

    it("error 初始为 null", () => {
      const { result } = renderHook(() => useSaveToNote());

      expect(result.current.error).toBeNull();
    });

    it("提供 save 方法", () => {
      const { result } = renderHook(() => useSaveToNote());

      expect(typeof result.current.save).toBe("function");
    });

    it("提供 saveAnyway 方法", () => {
      const { result } = renderHook(() => useSaveToNote());

      expect(typeof result.current.saveAnyway).toBe("function");
    });

    it("提供 reset 方法", () => {
      const { result } = renderHook(() => useSaveToNote());

      expect(typeof result.current.reset).toBe("function");
    });
  });

  describe("save 操作 - 成功流程", () => {
    it("成功保存时返回 noteId 和 title", async () => {
      // Mock 重复检测 - 无重复
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ isDuplicate: false }),
      });

      // Mock 标题生成
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ title: "AI 生成的标题" }),
      });

      // Mock 保存
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 123 }),
      });

      const onSuccess = jest.fn();
      const { result } = renderHook(() => useSaveToNote({ onSuccess }));

      let returnValue: {
        isDuplicate: boolean;
        noteId?: number;
        title?: string;
      };
      await act(async () => {
        returnValue = await result.current.save({
          content: "测试内容",
          sourceType: "ai_response",
        });
      });

      expect(returnValue!.isDuplicate).toBe(false);
      expect(returnValue!.noteId).toBe(123);
      expect(returnValue!.title).toContain("AI 生成的标题");
      expect(onSuccess).toHaveBeenCalled();
    });

    it("状态经历 checking -> generating -> saving -> success", async () => {
      const stateHistory: string[] = [];

      // 创建延迟的 Promise 来捕获中间状态
      let resolveCheckDuplicate: (value: unknown) => void;
      let resolveGenerateTitle: (value: unknown) => void;
      let resolveSave: (value: unknown) => void;

      mockFetch
        .mockImplementationOnce(
          () =>
            new Promise((r) => {
              resolveCheckDuplicate = r;
            }),
        )
        .mockImplementationOnce(
          () =>
            new Promise((r) => {
              resolveGenerateTitle = r;
            }),
        )
        .mockImplementationOnce(
          () =>
            new Promise((r) => {
              resolveSave = r;
            }),
        );

      const { result } = renderHook(() => useSaveToNote());

      // 启动保存操作
      let savePromise: Promise<unknown>;
      act(() => {
        savePromise = result.current.save({
          content: "测试内容",
          sourceType: "ai_response",
        });
      });

      // 等待 checking 状态
      await waitFor(() => {
        expect(result.current.state).toBe("checking");
      });
      stateHistory.push(result.current.state);

      // 完成重复检测
      await act(async () => {
        resolveCheckDuplicate!({
          ok: true,
          json: () => Promise.resolve({ isDuplicate: false }),
        });
      });

      // 等待 generating 状态
      await waitFor(() => {
        expect(result.current.state).toBe("generating");
      });
      stateHistory.push(result.current.state);

      // 完成标题生成
      await act(async () => {
        resolveGenerateTitle!({
          ok: true,
          json: () => Promise.resolve({ title: "标题" }),
        });
      });

      // 等待 saving 状态
      await waitFor(() => {
        expect(result.current.state).toBe("saving");
      });
      stateHistory.push(result.current.state);

      // 完成保存
      await act(async () => {
        resolveSave!({
          ok: true,
          json: () => Promise.resolve({ id: 1 }),
        });
        await savePromise;
      });

      // 最终状态应该是 success
      expect(result.current.state).toBe("success");
      stateHistory.push(result.current.state);

      expect(stateHistory).toEqual([
        "checking",
        "generating",
        "saving",
        "success",
      ]);
    });

    it("使用自定义标题时跳过标题生成", async () => {
      // Mock 重复检测
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ isDuplicate: false }),
      });

      // Mock 保存（注意：没有标题生成的 mock）
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 123 }),
      });

      const { result } = renderHook(() => useSaveToNote());

      await act(async () => {
        await result.current.save({
          content: "测试内容",
          sourceType: "ai_response",
          customTitle: "自定义标题",
        });
      });

      // 只调用了 2 次 fetch（重复检测 + 保存），没有标题生成
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("重复检测", () => {
    it("检测到重复时设置 duplicateInfo 并返回 isDuplicate: true", async () => {
      const existingNote = {
        id: 456,
        title: "已存在的笔记",
        created_at: "2025-01-08T00:00:00Z",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            isDuplicate: true,
            existingNote,
          }),
      });

      const { result } = renderHook(() => useSaveToNote());

      let returnValue: { isDuplicate: boolean };
      await act(async () => {
        returnValue = await result.current.save({
          content: "重复内容",
          sourceType: "ai_response",
        });
      });

      expect(returnValue!.isDuplicate).toBe(true);
      expect(result.current.duplicateInfo).toEqual({
        id: 456,
        title: "已存在的笔记",
        savedAt: "2025-01-08T00:00:00Z",
      });
      expect(result.current.state).toBe("idle");
    });

    it("skipDuplicateCheck 跳过重复检测", async () => {
      // Mock 标题生成
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ title: "标题" }),
      });

      // Mock 保存
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 789 }),
      });

      const { result } = renderHook(() => useSaveToNote());

      await act(async () => {
        await result.current.save({
          content: "内容",
          sourceType: "ai_response",
          skipDuplicateCheck: true,
        });
      });

      // 第一次调用应该是标题生成，不是重复检测
      expect(mockFetch.mock.calls[0][0]).toBe("/api/ai/generate-title");
    });
  });

  describe("saveAnyway 操作", () => {
    it("saveAnyway 清除 duplicateInfo 并强制保存", async () => {
      // 首先触发重复检测
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            isDuplicate: true,
            existingNote: { id: 1, title: "已存在", created_at: "2025-01-08" },
          }),
      });

      const { result } = renderHook(() => useSaveToNote());

      await act(async () => {
        await result.current.save({
          content: "重复内容",
          sourceType: "ai_response",
        });
      });

      expect(result.current.duplicateInfo).not.toBeNull();

      // 现在调用 saveAnyway
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ title: "标题" }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 999 }),
      });

      await act(async () => {
        await result.current.saveAnyway({
          content: "重复内容",
          sourceType: "ai_response",
        });
      });

      expect(result.current.duplicateInfo).toBeNull();
      expect(result.current.savedNote?.id).toBe(999);
    });
  });

  describe("错误处理", () => {
    it("保存失败时设置 error 状态", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ isDuplicate: false }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ title: "标题" }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "保存失败" }),
      });

      const onError = jest.fn();
      const { result } = renderHook(() => useSaveToNote({ onError }));

      await act(async () => {
        try {
          await result.current.save({
            content: "内容",
            sourceType: "ai_response",
          });
        } catch {
          // 预期抛出错误
        }
      });

      expect(result.current.state).toBe("error");
      expect(result.current.error).not.toBeNull();
      expect(onError).toHaveBeenCalled();
    });

    it("网络错误时设置 error 状态", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const onError = jest.fn();
      const { result } = renderHook(() => useSaveToNote({ onError }));

      await act(async () => {
        try {
          await result.current.save({
            content: "内容",
            sourceType: "ai_response",
          });
        } catch {
          // 预期抛出错误
        }
      });

      expect(result.current.state).toBe("error");
      expect(onError).toHaveBeenCalled();
    });

    it("标题生成失败时使用回退标题", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ isDuplicate: false }),
      });
      // 标题生成失败
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "生成失败" }),
      });
      // 保存成功
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 123 }),
      });

      const { result } = renderHook(() => useSaveToNote());

      let returnValue: { title?: string };
      await act(async () => {
        returnValue = await result.current.save({
          content: "# 测试标题\n这是内容",
          sourceType: "ai_response",
        });
      });

      // 应该从内容提取回退标题
      expect(returnValue!.title).toBeDefined();
      expect(result.current.state).toBe("success");
    });
  });

  describe("reset 操作", () => {
    it("reset 清除所有状态", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            isDuplicate: true,
            existingNote: { id: 1, title: "已存在", created_at: "2025-01-08" },
          }),
      });

      const { result } = renderHook(() => useSaveToNote());

      await act(async () => {
        await result.current.save({
          content: "内容",
          sourceType: "ai_response",
        });
      });

      expect(result.current.duplicateInfo).not.toBeNull();

      act(() => {
        result.current.reset();
      });

      expect(result.current.state).toBe("idle");
      expect(result.current.duplicateInfo).toBeNull();
      expect(result.current.savedNote).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe("API 调用验证", () => {
    it("正确调用重复检测 API", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ isDuplicate: false }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ title: "标题" }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 1 }),
      });

      const { result } = renderHook(() => useSaveToNote());

      await act(async () => {
        await result.current.save({
          content: "测试内容",
          sourceType: "ai_response",
        });
      });

      expect(mockFetch.mock.calls[0]).toEqual([
        "/api/md-collections/check-duplicate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: "测试内容" }),
        },
      ]);
    });

    it("正确调用标题生成 API（截断超长内容）", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ isDuplicate: false }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ title: "标题" }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 1 }),
      });

      const longContent = "x".repeat(5000);
      const { result } = renderHook(() => useSaveToNote());

      await act(async () => {
        await result.current.save({
          content: longContent,
          sourceType: "ai_response",
        });
      });

      const titleGenCall = mockFetch.mock.calls[1];
      const body = JSON.parse(titleGenCall[1].body);
      // 应该截断到 2000 字符
      expect(body.content.length).toBeLessThanOrEqual(2000);
    });

    it("正确调用保存 API", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ isDuplicate: false }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ title: "生成的标题" }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 1 }),
      });

      const { result } = renderHook(() => useSaveToNote());

      await act(async () => {
        await result.current.save({
          content: "测试内容",
          sourceType: "deliverable",
          sourceId: "msg-123",
        });
      });

      const saveCall = mockFetch.mock.calls[2];
      expect(saveCall[0]).toBe("/api/md-collections");
      const body = JSON.parse(saveCall[1].body);
      expect(body.rawContent).toBe("测试内容");
      expect(body.sourceType).toBe("deliverable");
      expect(body.title).toContain("生成的标题");
    });
  });
});
