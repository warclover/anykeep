/**
 * useKeyboardNav Hook 单元测试
 * Spec: md-reader-upgrade / REQ-9
 */

import { renderHook, act } from "@testing-library/react";
import {
  useKeyboardNav,
  KEYBOARD_SHORTCUTS_HELP,
  SHORTCUT_CATEGORY_LABELS,
} from "../use-keyboard-nav";
import type { KeyboardShortcut } from "../../../types/reader";

// Mock matchMedia for mobile detection
const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
};

// Mock window.innerWidth
const mockInnerWidth = (width: number) => {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  });
};

describe("useKeyboardNav", () => {
  // Store original values
  const originalInnerWidth = window.innerWidth;
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    // Reset to desktop defaults
    mockInnerWidth(1024);
    mockMatchMedia(true); // pointer: fine = desktop
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original values
    Object.defineProperty(window, "innerWidth", {
      value: originalInnerWidth,
      writable: true,
      configurable: true,
    });
    window.matchMedia = originalMatchMedia;
  });

  describe("基础功能", () => {
    it("注册键盘事件监听器", () => {
      const addEventListenerSpy = jest.spyOn(document, "addEventListener");
      const shortcuts: KeyboardShortcut[] = [
        { key: "j", description: "下一章节", action: jest.fn() },
      ];

      renderHook(() => useKeyboardNav({ shortcuts }));

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "keydown",
        expect.any(Function),
        true,
      );
    });

    it("卸载时移除事件监听器", () => {
      const removeEventListenerSpy = jest.spyOn(
        document,
        "removeEventListener",
      );
      const shortcuts: KeyboardShortcut[] = [
        { key: "j", description: "下一章节", action: jest.fn() },
      ];

      const { unmount } = renderHook(() => useKeyboardNav({ shortcuts }));
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "keydown",
        expect.any(Function),
        true,
      );
    });

    it("禁用时不注册事件监听器", () => {
      const addEventListenerSpy = jest.spyOn(document, "addEventListener");
      const shortcuts: KeyboardShortcut[] = [
        { key: "j", description: "下一章节", action: jest.fn() },
      ];

      renderHook(() => useKeyboardNav({ shortcuts, enabled: false }));

      expect(addEventListenerSpy).not.toHaveBeenCalledWith(
        "keydown",
        expect.any(Function),
        true,
      );
    });
  });

  describe("快捷键触发", () => {
    it("触发匹配的快捷键 action", () => {
      const mockAction = jest.fn();
      const shortcuts: KeyboardShortcut[] = [
        { key: "j", description: "下一章节", action: mockAction },
      ];

      renderHook(() => useKeyboardNav({ shortcuts }));

      act(() => {
        const event = new KeyboardEvent("keydown", { key: "j" });
        document.dispatchEvent(event);
      });

      expect(mockAction).toHaveBeenCalledTimes(1);
    });

    it("忽略大小写匹配按键", () => {
      const mockAction = jest.fn();
      const shortcuts: KeyboardShortcut[] = [
        { key: "J", description: "下一章节", action: mockAction },
      ];

      renderHook(() => useKeyboardNav({ shortcuts }));

      act(() => {
        const event = new KeyboardEvent("keydown", { key: "j" });
        document.dispatchEvent(event);
      });

      expect(mockAction).toHaveBeenCalledTimes(1);
    });

    it("不匹配的按键不触发 action", () => {
      const mockAction = jest.fn();
      const shortcuts: KeyboardShortcut[] = [
        { key: "j", description: "下一章节", action: mockAction },
      ];

      renderHook(() => useKeyboardNav({ shortcuts }));

      act(() => {
        const event = new KeyboardEvent("keydown", { key: "k" });
        document.dispatchEvent(event);
      });

      expect(mockAction).not.toHaveBeenCalled();
    });

    it("阻止事件默认行为和冒泡", () => {
      const mockAction = jest.fn();
      const shortcuts: KeyboardShortcut[] = [
        { key: "j", description: "下一章节", action: mockAction },
      ];

      renderHook(() => useKeyboardNav({ shortcuts }));

      const event = new KeyboardEvent("keydown", { key: "j" });
      const preventDefaultSpy = jest.spyOn(event, "preventDefault");
      const stopPropagationSpy = jest.spyOn(event, "stopPropagation");

      act(() => {
        document.dispatchEvent(event);
      });

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(stopPropagationSpy).toHaveBeenCalled();
    });
  });

  describe("修饰键支持", () => {
    it("匹配带 Shift 修饰键的快捷键", () => {
      const mockAction = jest.fn();
      const shortcuts: KeyboardShortcut[] = [
        {
          key: "?",
          description: "帮助",
          modifiers: { shift: true },
          action: mockAction,
        },
      ];

      renderHook(() => useKeyboardNav({ shortcuts }));

      act(() => {
        const event = new KeyboardEvent("keydown", {
          key: "?",
          shiftKey: true,
        });
        document.dispatchEvent(event);
      });

      expect(mockAction).toHaveBeenCalledTimes(1);
    });

    it("不带修饰键时拒绝带 Ctrl 的事件", () => {
      const mockAction = jest.fn();
      const shortcuts: KeyboardShortcut[] = [
        { key: "j", description: "下一章节", action: mockAction },
      ];

      renderHook(() => useKeyboardNav({ shortcuts }));

      act(() => {
        const event = new KeyboardEvent("keydown", { key: "j", ctrlKey: true });
        document.dispatchEvent(event);
      });

      expect(mockAction).not.toHaveBeenCalled();
    });
  });

  describe("输入元素焦点检测", () => {
    it("焦点在 input 上时不触发快捷键", () => {
      const mockAction = jest.fn();
      const shortcuts: KeyboardShortcut[] = [
        { key: "j", description: "下一章节", action: mockAction },
      ];

      const input = document.createElement("input");
      document.body.appendChild(input);
      input.focus();

      renderHook(() => useKeyboardNav({ shortcuts }));

      act(() => {
        const event = new KeyboardEvent("keydown", { key: "j" });
        document.dispatchEvent(event);
      });

      expect(mockAction).not.toHaveBeenCalled();

      document.body.removeChild(input);
    });

    it("焦点在 textarea 上时不触发快捷键", () => {
      const mockAction = jest.fn();
      const shortcuts: KeyboardShortcut[] = [
        { key: "j", description: "下一章节", action: mockAction },
      ];

      const textarea = document.createElement("textarea");
      document.body.appendChild(textarea);
      textarea.focus();

      renderHook(() => useKeyboardNav({ shortcuts }));

      act(() => {
        const event = new KeyboardEvent("keydown", { key: "j" });
        document.dispatchEvent(event);
      });

      expect(mockAction).not.toHaveBeenCalled();

      document.body.removeChild(textarea);
    });

    it("焦点在 contenteditable 元素上时不触发快捷键", () => {
      const mockAction = jest.fn();
      const shortcuts: KeyboardShortcut[] = [
        { key: "j", description: "下一章节", action: mockAction },
      ];

      const div = document.createElement("div");
      div.setAttribute("contenteditable", "true");
      document.body.appendChild(div);
      div.focus();

      renderHook(() => useKeyboardNav({ shortcuts }));

      act(() => {
        const event = new KeyboardEvent("keydown", { key: "j" });
        document.dispatchEvent(event);
      });

      expect(mockAction).not.toHaveBeenCalled();

      document.body.removeChild(div);
    });
  });

  describe("移动端检测", () => {
    it("移动端（窄屏幕）不注册事件监听器", () => {
      mockInnerWidth(320);
      const addEventListenerSpy = jest.spyOn(document, "addEventListener");
      const shortcuts: KeyboardShortcut[] = [
        { key: "j", description: "下一章节", action: jest.fn() },
      ];

      renderHook(() => useKeyboardNav({ shortcuts }));

      // 应该没有调用 addEventListener
      expect(addEventListenerSpy).not.toHaveBeenCalledWith(
        "keydown",
        expect.any(Function),
        true,
      );
    });
  });
});

describe("KEYBOARD_SHORTCUTS_HELP", () => {
  it("包含导航快捷键", () => {
    const navShortcuts = KEYBOARD_SHORTCUTS_HELP.filter(
      (s) => s.category === "navigation",
    );
    expect(navShortcuts.length).toBeGreaterThan(0);
    expect(navShortcuts.some((s) => s.keys.includes("J"))).toBe(true);
    expect(navShortcuts.some((s) => s.keys.includes("K"))).toBe(true);
  });

  it("包含模式快捷键", () => {
    const modeShortcuts = KEYBOARD_SHORTCUTS_HELP.filter(
      (s) => s.category === "mode",
    );
    expect(modeShortcuts.length).toBeGreaterThan(0);
    expect(modeShortcuts.some((s) => s.keys.includes("F"))).toBe(true);
    expect(modeShortcuts.some((s) => s.keys.includes("Esc"))).toBe(true);
  });

  it("包含其他快捷键", () => {
    const otherShortcuts = KEYBOARD_SHORTCUTS_HELP.filter(
      (s) => s.category === "other",
    );
    expect(otherShortcuts.length).toBeGreaterThan(0);
    expect(otherShortcuts.some((s) => s.keys.includes("?"))).toBe(true);
  });
});

describe("SHORTCUT_CATEGORY_LABELS", () => {
  it("包含所有分类标签", () => {
    expect(SHORTCUT_CATEGORY_LABELS.navigation).toBe("导航");
    expect(SHORTCUT_CATEGORY_LABELS.mode).toBe("模式");
    expect(SHORTCUT_CATEGORY_LABELS.other).toBe("其他");
  });
});
