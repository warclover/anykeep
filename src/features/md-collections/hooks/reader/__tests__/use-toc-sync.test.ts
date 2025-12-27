/**
 * useTOCSync Hook 单元测试
 * Spec: md-reader-upgrade / REQ-3
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useTOCSync } from "../use-toc-sync";
import type { TOCItem } from "../../../types/reader";

// Mock IntersectionObserver
const mockObserve = jest.fn();
const mockUnobserve = jest.fn();
const mockDisconnect = jest.fn();

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: ReadonlyArray<number> = [];

  constructor(
    public callback: IntersectionObserverCallback,
    public options?: IntersectionObserverInit,
  ) {}

  observe = mockObserve;
  unobserve = mockUnobserve;
  disconnect = mockDisconnect;
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
});

Object.defineProperty(global, "IntersectionObserver", {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
});

// Mock window.scrollTo
const mockScrollTo = jest.fn();
Object.defineProperty(window, "scrollTo", {
  writable: true,
  configurable: true,
  value: mockScrollTo,
});

describe("useTOCSync", () => {
  const mockContainerRef = { current: null as HTMLDivElement | null };

  const mockTOCItems: TOCItem[] = [
    { id: "section-1", text: "章节一", level: 1 },
    { id: "section-2", text: "章节二", level: 1 },
    { id: "section-2-1", text: "章节二点一", level: 2 },
    { id: "section-3", text: "章节三", level: 1 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock container element
    const mockElement = document.createElement("div");
    mockContainerRef.current = mockElement;
    document.body.appendChild(mockElement);

    // Create mock heading elements
    mockTOCItems.forEach((item) => {
      const heading = document.createElement(`h${item.level}`);
      heading.id = item.id;
      heading.textContent = item.text;
      mockElement.appendChild(heading);
    });
  });

  afterEach(() => {
    if (mockContainerRef.current) {
      document.body.removeChild(mockContainerRef.current);
    }
    mockContainerRef.current = null;
  });

  describe("基础功能", () => {
    it("有目录项时初始化 activeId 为第一项", async () => {
      const { result } = renderHook(() =>
        useTOCSync({
          containerRef: mockContainerRef,
          tocItems: mockTOCItems,
        }),
      );

      // Hook 初始化后会自动设置第一个 TOC 项为 activeId
      await waitFor(() => {
        expect(result.current.activeId).toBe("section-1");
      });
    });

    it("返回 scrollToHeading 函数", () => {
      const { result } = renderHook(() =>
        useTOCSync({
          containerRef: mockContainerRef,
          tocItems: mockTOCItems,
        }),
      );

      expect(typeof result.current.scrollToHeading).toBe("function");
    });

    it("空目录时 activeId 为 null", () => {
      const { result } = renderHook(() =>
        useTOCSync({
          containerRef: mockContainerRef,
          tocItems: [],
        }),
      );

      expect(result.current.activeId).toBeNull();
    });
  });

  describe("scrollToHeading", () => {
    it("滚动到指定章节使用 window.scrollTo", async () => {
      const { result } = renderHook(() =>
        useTOCSync({
          containerRef: mockContainerRef,
          tocItems: mockTOCItems,
        }),
      );

      act(() => {
        result.current.scrollToHeading("section-2");
      });

      expect(mockScrollTo).toHaveBeenCalledWith({
        top: expect.any(Number),
        behavior: "smooth",
      });
    });

    it("滚动后更新 activeId", async () => {
      const { result } = renderHook(() =>
        useTOCSync({
          containerRef: mockContainerRef,
          tocItems: mockTOCItems,
        }),
      );

      act(() => {
        result.current.scrollToHeading("section-2");
      });

      expect(result.current.activeId).toBe("section-2");
    });

    it("目标不存在时不报错也不调用 scrollTo", () => {
      const { result } = renderHook(() =>
        useTOCSync({
          containerRef: mockContainerRef,
          tocItems: mockTOCItems,
        }),
      );

      expect(() => {
        act(() => {
          result.current.scrollToHeading("non-existent-id");
        });
      }).not.toThrow();

      // scrollTo 不应该被调用，因为目标元素不存在
      expect(mockScrollTo).not.toHaveBeenCalled();
    });
  });

  describe("边界情况", () => {
    it("containerRef 为 null 时正常工作", () => {
      const nullRef = { current: null };

      const { result } = renderHook(() =>
        useTOCSync({
          containerRef: nullRef,
          tocItems: mockTOCItems,
        }),
      );

      // 即使 containerRef 为 null，仍应设置第一个 TOC 项
      expect(result.current.activeId).toBe("section-1");
      expect(typeof result.current.scrollToHeading).toBe("function");
    });

    it("多次调用 scrollToHeading 只保留最后一个", () => {
      const { result } = renderHook(() =>
        useTOCSync({
          containerRef: mockContainerRef,
          tocItems: mockTOCItems,
        }),
      );

      act(() => {
        result.current.scrollToHeading("section-1");
        result.current.scrollToHeading("section-2");
        result.current.scrollToHeading("section-3");
      });

      expect(result.current.activeId).toBe("section-3");
    });
  });

  describe("IntersectionObserver 集成", () => {
    it("有目录项时创建 IntersectionObserver", () => {
      renderHook(() =>
        useTOCSync({
          containerRef: mockContainerRef,
          tocItems: mockTOCItems,
        }),
      );

      // 应该为每个 TOC 项调用 observe
      expect(mockObserve).toHaveBeenCalledTimes(mockTOCItems.length);
    });

    it("卸载时断开 IntersectionObserver", () => {
      const { unmount } = renderHook(() =>
        useTOCSync({
          containerRef: mockContainerRef,
          tocItems: mockTOCItems,
        }),
      );

      unmount();

      expect(mockDisconnect).toHaveBeenCalled();
    });

    it("空目录时不创建 IntersectionObserver", () => {
      renderHook(() =>
        useTOCSync({
          containerRef: mockContainerRef,
          tocItems: [],
        }),
      );

      expect(mockObserve).not.toHaveBeenCalled();
    });
  });

  describe("返回值类型", () => {
    it("返回所有必需的属性和方法", () => {
      const { result } = renderHook(() =>
        useTOCSync({
          containerRef: mockContainerRef,
          tocItems: mockTOCItems,
        }),
      );

      expect(result.current).toHaveProperty("activeId");
      expect(result.current).toHaveProperty("scrollToHeading");

      expect(typeof result.current.scrollToHeading).toBe("function");
    });
  });
});
