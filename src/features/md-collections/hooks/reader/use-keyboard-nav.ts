/**
 * 键盘导航 Hook
 * Spec: md-reader-upgrade / REQ-9
 *
 * 管理阅读器的键盘快捷键，支持：
 * - J/K 或 ↑/↓：上下章节导航
 * - F：切换专注模式
 * - T：切换目录侧边栏
 * - Esc：退出当前模式
 * - ?：显示快捷键帮助
 * - 1-4：字体大小预设
 */

import { useEffect, useCallback, useRef } from "react";
import type { KeyboardShortcut, UseKeyboardNavOptions } from "../../types";

// ============================================
// 常量
// ============================================

/**
 * 需要忽略快捷键的元素标签
 */
const IGNORE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/**
 * 可编辑属性值
 */
const EDITABLE_CONTENT_VALUES = new Set(["true", "plaintext-only"]);

/**
 * 移动端检测的最大宽度
 */
const MOBILE_MAX_WIDTH = 768;

// ============================================
// 工具函数
// ============================================

/**
 * 检测是否为移动设备
 * 基于屏幕宽度和触摸能力
 */
function isMobileDevice(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  // 检查屏幕宽度
  const isNarrowScreen = window.innerWidth <= MOBILE_MAX_WIDTH;

  // 检查是否有触摸能力（但不是桌面触摸屏）
  const hasTouchOnly =
    "ontouchstart" in window && !window.matchMedia("(pointer: fine)").matches;

  return isNarrowScreen || hasTouchOnly;
}

/**
 * 检查当前焦点是否在输入元素上
 */
function isInputFocused(): boolean {
  const activeElement = document.activeElement;
  if (!activeElement) {
    return false;
  }

  // 检查标签名
  if (IGNORE_TAGS.has(activeElement.tagName)) {
    return true;
  }

  // 检查 contentEditable 属性
  const contentEditable = activeElement.getAttribute("contenteditable");
  if (contentEditable && EDITABLE_CONTENT_VALUES.has(contentEditable)) {
    return true;
  }

  return false;
}

/**
 * 检查快捷键修饰键是否匹配
 */
function matchModifiers(
  event: KeyboardEvent,
  modifiers?: KeyboardShortcut["modifiers"],
): boolean {
  if (!modifiers) {
    // 默认要求无修饰键（单纯按键）
    return !event.ctrlKey && !event.metaKey && !event.altKey;
  }

  const ctrlMatch = modifiers.ctrl ? event.ctrlKey : !event.ctrlKey;
  const shiftMatch = modifiers.shift ? event.shiftKey : true; // shift 不严格匹配
  const altMatch = modifiers.alt ? event.altKey : !event.altKey;
  const metaMatch = modifiers.meta ? event.metaKey : !event.metaKey;

  return ctrlMatch && shiftMatch && altMatch && metaMatch;
}

/**
 * 获取标准化的按键名称
 * 处理大小写和特殊键
 */
function normalizeKey(key: string): string {
  // 统一转小写
  return key.toLowerCase();
}

// ============================================
// Hook 实现
// ============================================

/**
 * 键盘导航 Hook
 *
 * @param options - 配置选项
 * @param options.shortcuts - 快捷键列表
 * @param options.enabled - 是否启用（默认 true）
 *
 * @example
 * ```tsx
 * useKeyboardNav({
 *   shortcuts: [
 *     { key: 'j', description: '下一章节', action: () => scrollNext() },
 *     { key: 'k', description: '上一章节', action: () => scrollPrev() },
 *     { key: 'f', description: '专注模式', action: () => toggleFocus() },
 *     { key: 'Escape', description: '退出', action: () => handleEscape() },
 *   ],
 *   enabled: true,
 * });
 * ```
 */
export function useKeyboardNav(options: UseKeyboardNavOptions): void {
  const { shortcuts, enabled = true } = options;

  // 使用 ref 存储快捷键列表，避免每次渲染重新注册事件
  const shortcutsRef = useRef(shortcuts);

  // 使用 ref 存储启用状态
  const enabledRef = useRef(enabled);

  // 更新 refs（在 useEffect 中避免渲染期间赋值）
  useEffect(() => {
    shortcutsRef.current = shortcuts;
    enabledRef.current = enabled;
  }, [shortcuts, enabled]);

  // 键盘事件处理器
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // 检查是否启用
    if (!enabledRef.current) {
      return;
    }

    // 移动端禁用
    if (isMobileDevice()) {
      return;
    }

    // 输入框聚焦时禁用
    if (isInputFocused()) {
      return;
    }

    const normalizedEventKey = normalizeKey(event.key);

    // 查找匹配的快捷键
    for (const shortcut of shortcutsRef.current) {
      const normalizedShortcutKey = normalizeKey(shortcut.key);

      // 匹配按键
      if (normalizedEventKey !== normalizedShortcutKey) {
        continue;
      }

      // 匹配修饰键
      if (!matchModifiers(event, shortcut.modifiers)) {
        continue;
      }

      // 找到匹配，阻止默认行为并执行动作
      event.preventDefault();
      event.stopPropagation();
      shortcut.action();
      return;
    }
  }, []);

  // 注册/注销事件监听器
  useEffect(() => {
    if (!enabled) {
      return;
    }

    // 移动端不注册
    if (isMobileDevice()) {
      return;
    }

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [enabled, handleKeyDown]);
}

// ============================================
// 默认快捷键配置
// ============================================

/**
 * 快捷键帮助列表（用于显示）
 * 不包含 action，仅用于 KeyboardNavHelp 组件
 */
export interface ShortcutHelpItem {
  /** 按键显示文本 */
  keys: string[];
  /** 功能描述 */
  description: string;
  /** 分类 */
  category: "navigation" | "mode" | "other";
}

/**
 * 默认快捷键帮助配置
 */
export const KEYBOARD_SHORTCUTS_HELP: ShortcutHelpItem[] = [
  // 导航类
  {
    keys: ["J", "↓"],
    description: "下一章节",
    category: "navigation",
  },
  {
    keys: ["K", "↑"],
    description: "上一章节",
    category: "navigation",
  },
  {
    keys: ["T"],
    description: "切换目录",
    category: "navigation",
  },
  // 模式类
  {
    keys: ["F"],
    description: "切换专注模式",
    category: "mode",
  },
  {
    keys: ["Esc"],
    description: "退出当前模式",
    category: "mode",
  },
  // 其他
  {
    keys: ["?"],
    description: "显示快捷键帮助",
    category: "other",
  },
  {
    keys: ["1", "2", "3", "4"],
    description: "字体大小预设",
    category: "other",
  },
];

/**
 * 分类标签映射
 */
export const SHORTCUT_CATEGORY_LABELS: Record<
  ShortcutHelpItem["category"],
  string
> = {
  navigation: "导航",
  mode: "模式",
  other: "其他",
};
