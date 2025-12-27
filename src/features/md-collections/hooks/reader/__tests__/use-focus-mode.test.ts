/**
 * useFocusMode Hook 单元测试
 * Spec: md-reader-upgrade / REQ-6
 */

import { renderHook, act } from "@testing-library/react";
import { useFocusMode } from "../use-focus-mode";

describe("useFocusMode", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe("基础状态", () => {
    it("初始状态：未进入专注模式", () => {
      const { result } = renderHook(() => useFocusMode());

      expect(result.current.isFocusMode).toBe(false);
    });

    it("初始状态：工具栏可见", () => {
      const { result } = renderHook(() => useFocusMode());

      expect(result.current.isToolbarVisible).toBe(true);
    });

    it("自定义初始状态", () => {
      const { result } = renderHook(() =>
        useFocusMode({ initialFocusMode: true }),
      );

      expect(result.current.isFocusMode).toBe(true);
    });
  });

  describe("模式切换", () => {
    it("toggleFocusMode 切换专注模式", () => {
      const { result } = renderHook(() => useFocusMode());

      act(() => {
        result.current.toggleFocusMode();
      });

      expect(result.current.isFocusMode).toBe(true);

      act(() => {
        result.current.toggleFocusMode();
      });

      expect(result.current.isFocusMode).toBe(false);
    });

    it("exitFocusMode 退出专注模式", () => {
      const { result } = renderHook(() => useFocusMode());

      // 先进入
      act(() => {
        result.current.toggleFocusMode();
      });

      expect(result.current.isFocusMode).toBe(true);

      // 再退出
      act(() => {
        result.current.exitFocusMode();
      });

      expect(result.current.isFocusMode).toBe(false);
    });
  });

  describe("工具栏自动隐藏", () => {
    it("进入专注模式后工具栏自动隐藏", () => {
      const { result } = renderHook(() => useFocusMode({ hideDelay: 1000 }));

      act(() => {
        result.current.toggleFocusMode();
      });

      // 初始时工具栏可见
      expect(result.current.isToolbarVisible).toBe(true);

      // 等待自动隐藏
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(result.current.isToolbarVisible).toBe(false);
    });

    it("showToolbar 显示工具栏", () => {
      const { result } = renderHook(() => useFocusMode({ hideDelay: 1000 }));

      act(() => {
        result.current.toggleFocusMode();
      });

      // 等待自动隐藏
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(result.current.isToolbarVisible).toBe(false);

      // 显示工具栏
      act(() => {
        result.current.showToolbar();
      });

      expect(result.current.isToolbarVisible).toBe(true);
    });

    it("showToolbar 后重新计时自动隐藏", () => {
      const { result } = renderHook(() => useFocusMode({ hideDelay: 1000 }));

      act(() => {
        result.current.toggleFocusMode();
      });

      // 等待自动隐藏
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(result.current.isToolbarVisible).toBe(false);

      // 显示工具栏
      act(() => {
        result.current.showToolbar();
      });

      expect(result.current.isToolbarVisible).toBe(true);

      // 再次等待自动隐藏
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(result.current.isToolbarVisible).toBe(false);
    });
  });

  describe("非专注模式行为", () => {
    it("非专注模式时工具栏始终可见", () => {
      const { result } = renderHook(() => useFocusMode({ hideDelay: 1000 }));

      // 不进入专注模式
      expect(result.current.isFocusMode).toBe(false);
      expect(result.current.isToolbarVisible).toBe(true);

      // 等待超时
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      // 工具栏仍然可见
      expect(result.current.isToolbarVisible).toBe(true);
    });
  });

  describe("自定义配置", () => {
    it("使用自定义 hideDelay", () => {
      const { result } = renderHook(() => useFocusMode({ hideDelay: 5000 }));

      act(() => {
        result.current.toggleFocusMode();
      });

      // 3 秒后工具栏仍然可见
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(result.current.isToolbarVisible).toBe(true);

      // 5 秒后工具栏隐藏
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      expect(result.current.isToolbarVisible).toBe(false);
    });
  });

  describe("重复操作", () => {
    it("重复退出不会出错", () => {
      const { result } = renderHook(() => useFocusMode());

      act(() => {
        result.current.toggleFocusMode();
      });

      act(() => {
        result.current.exitFocusMode();
        result.current.exitFocusMode();
        result.current.exitFocusMode();
      });

      expect(result.current.isFocusMode).toBe(false);
    });
  });

  describe("返回值类型", () => {
    it("返回所有必需的属性和方法", () => {
      const { result } = renderHook(() => useFocusMode());

      expect(result.current).toHaveProperty("isFocusMode");
      expect(result.current).toHaveProperty("toggleFocusMode");
      expect(result.current).toHaveProperty("exitFocusMode");
      expect(result.current).toHaveProperty("isToolbarVisible");
      expect(result.current).toHaveProperty("showToolbar");

      expect(typeof result.current.isFocusMode).toBe("boolean");
      expect(typeof result.current.toggleFocusMode).toBe("function");
      expect(typeof result.current.exitFocusMode).toBe("function");
      expect(typeof result.current.isToolbarVisible).toBe("boolean");
      expect(typeof result.current.showToolbar).toBe("function");
    });
  });
});
