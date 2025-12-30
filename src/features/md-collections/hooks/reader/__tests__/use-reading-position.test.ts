/**
 * useReadingPosition Hook 单元测试
 * Spec: md-reader-upgrade / REQ-4, REQ-5
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useReadingPosition } from "../use-reading-position";
import type { ReadingPosition } from "../../../types/reader";

// Configure React 18 act environment

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

Object.defineProperty(window, "localStorage", {
  value: mockLocalStorage,
  writable: true,
});

describe("useReadingPosition", () => {
  const mockContentRef = { current: null as HTMLDivElement | null };
  const defaultOptions = {
    collectionId: 1,
    contentRef: mockContentRef,
    readingTimeMinutes: 10,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.clear();

    // Create mock content element
    const mockElement = document.createElement("div");
    Object.defineProperties(mockElement, {
      offsetTop: { value: 0, configurable: true },
      offsetHeight: { value: 1000, configurable: true },
    });
    mockContentRef.current = mockElement;
  });

  describe("基础功能", () => {
    it("初始化时返回进度值", () => {
      const { result } = renderHook(() => useReadingPosition(defaultOptions));

      // 进度值应该是一个数字 (0-100)
      expect(typeof result.current.progress).toBe("number");
      expect(result.current.progress).toBeGreaterThanOrEqual(0);
      expect(result.current.progress).toBeLessThanOrEqual(100);
    });

    it("计算剩余阅读时间", () => {
      const { result } = renderHook(() => useReadingPosition(defaultOptions));

      // 剩余时间应该是一个非负整数
      expect(typeof result.current.remainingMinutes).toBe("number");
      expect(result.current.remainingMinutes).toBeGreaterThanOrEqual(0);
      expect(result.current.remainingMinutes).toBeLessThanOrEqual(10);
    });
  });

  describe("位置保存与恢复", () => {
    it("初始时 savedPosition 为 null", () => {
      const { result } = renderHook(() => useReadingPosition(defaultOptions));

      expect(result.current.savedPosition).toBeNull();
    });

    it("从 localStorage 加载保存的位置", async () => {
      const savedPosition: ReadingPosition = {
        scrollTop: 500,
        progress: 50,
        timestamp: Date.now() - 1000,
      };
      mockLocalStorage.setItem(
        "md-reader-position-1",
        JSON.stringify(savedPosition),
      );

      const { result } = renderHook(() => useReadingPosition(defaultOptions));

      // Hook 使用 requestAnimationFrame 异步设置 savedPosition，需要等待
      await waitFor(() => {
        expect(result.current.savedPosition).toEqual(savedPosition);
      });
    });

    it("clearPosition 清除保存位置", async () => {
      const savedPosition: ReadingPosition = {
        scrollTop: 500,
        progress: 50,
        timestamp: Date.now(),
      };
      mockLocalStorage.setItem(
        "md-reader-position-1",
        JSON.stringify(savedPosition),
      );

      const { result } = renderHook(() => useReadingPosition(defaultOptions));

      // 等待 localStorage 数据加载完成
      await waitFor(() => {
        expect(result.current.savedPosition).not.toBeNull();
      });

      act(() => {
        result.current.clearPosition();
      });

      expect(result.current.savedPosition).toBeNull();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
        "md-reader-position-1",
      );
    });

    it("savePosition 保存当前位置", () => {
      const { result } = renderHook(() => useReadingPosition(defaultOptions));

      act(() => {
        result.current.savePosition();
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });
  });

  describe("边界情况", () => {
    it("contentRef 为 null 时不报错", () => {
      const nullRef = { current: null };

      expect(() => {
        renderHook(() =>
          useReadingPosition({
            collectionId: 1,
            contentRef: nullRef,
            readingTimeMinutes: 10,
          }),
        );
      }).not.toThrow();
    });

    it("localStorage 数据无效时返回 null", () => {
      mockLocalStorage.setItem("md-reader-position-1", "invalid json");

      const { result } = renderHook(() => useReadingPosition(defaultOptions));

      expect(result.current.savedPosition).toBeNull();
    });

    it("过期数据被清除", () => {
      const expiredPosition: ReadingPosition = {
        scrollTop: 500,
        progress: 50,
        // 超过 30 天
        timestamp: Date.now() - 31 * 24 * 60 * 60 * 1000,
      };
      mockLocalStorage.setItem(
        "md-reader-position-1",
        JSON.stringify(expiredPosition),
      );

      const { result } = renderHook(() => useReadingPosition(defaultOptions));

      expect(result.current.savedPosition).toBeNull();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
        "md-reader-position-1",
      );
    });
  });

  describe("返回值类型", () => {
    it("返回所有必需的属性和方法", () => {
      const { result } = renderHook(() => useReadingPosition(defaultOptions));

      expect(result.current).toHaveProperty("progress");
      expect(result.current).toHaveProperty("remainingMinutes");
      expect(result.current).toHaveProperty("savedPosition");
      expect(result.current).toHaveProperty("savePosition");
      expect(result.current).toHaveProperty("restorePosition");
      expect(result.current).toHaveProperty("clearPosition");

      expect(typeof result.current.progress).toBe("number");
      expect(typeof result.current.remainingMinutes).toBe("number");
      expect(typeof result.current.savePosition).toBe("function");
      expect(typeof result.current.restorePosition).toBe("function");
      expect(typeof result.current.clearPosition).toBe("function");
    });
  });

  describe("剩余时间计算", () => {
    it("剩余时间不为负数", () => {
      const { result } = renderHook(() => useReadingPosition(defaultOptions));

      // 无论进度如何，剩余时间应该 >= 0
      expect(result.current.remainingMinutes).toBeGreaterThanOrEqual(0);
    });
  });
});
