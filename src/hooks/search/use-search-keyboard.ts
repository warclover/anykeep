/**
 * 搜索键盘快捷键 Hook
 *
 * 提供搜索页面的键盘导航功能
 * - / 聚焦搜索框
 * - Escape 清除搜索/关闭弹出框
 * - 上/下箭头 在结果间导航
 * - Enter 打开选中结果
 *
 * @version 1.0.0
 * @since 2026-01-07
 */

import { useEffect, useCallback, useState, useRef } from "react";

// ============================================
// 类型定义
// ============================================

export interface UseSearchKeyboardOptions {
  /** 搜索结果数量 */
  resultCount: number;
  /** 搜索框引用 */
  inputRef: React.RefObject<HTMLInputElement>;
  /** 搜索框是否聚焦 */
  isInputFocused: boolean;
  /** 是否启用快捷键 */
  enabled?: boolean;
  /** 打开结果回调 */
  onOpenResult?: (index: number) => void;
  /** 清除搜索回调 */
  onClearSearch?: () => void;
  /** 关闭弹出框回调 */
  onClosePopup?: () => void;
}

export interface UseSearchKeyboardResult {
  /** 当前选中的结果索引（-1 表示无选中） */
  selectedIndex: number;
  /** 设置选中索引 */
  setSelectedIndex: (index: number) => void;
  /** 重置选中状态 */
  resetSelection: () => void;
  /** 快捷键提示列表 */
  shortcuts: { key: string; description: string }[];
}

// ============================================
// 常量
// ============================================

const SHORTCUTS = [
  { key: "/", description: "聚焦搜索框" },
  { key: "↑/↓", description: "导航结果" },
  { key: "Enter", description: "打开选中" },
  { key: "Esc", description: "清除/关闭" },
];

// ============================================
// Hook 实现
// ============================================

export function useSearchKeyboard({
  resultCount,
  inputRef,
  isInputFocused,
  enabled = true,
  onOpenResult,
  onClearSearch,
  onClosePopup,
}: UseSearchKeyboardOptions): UseSearchKeyboardResult {
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const lastResultCountRef = useRef(resultCount);

  // 当结果数量变化时重置选中状态
  useEffect(() => {
    if (resultCount !== lastResultCountRef.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 需要在结果变化时重置选中状态
      setSelectedIndex(-1);
      lastResultCountRef.current = resultCount;
    }
  }, [resultCount]);

  /**
   * 重置选中状态
   */
  const resetSelection = useCallback(() => {
    setSelectedIndex(-1);
  }, []);

  /**
   * 处理键盘事件
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // 检查是否在输入框内
      const target = event.target as HTMLElement;
      const isInInput =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA";

      // / 键 - 聚焦搜索框（仅在非输入状态）
      if (event.key === "/" && !isInInput) {
        event.preventDefault();
        inputRef.current?.focus();
        return;
      }

      // Escape 键 - 清除搜索或关闭弹出框
      if (event.key === "Escape") {
        if (isInputFocused) {
          // 如果搜索框有内容，清除搜索
          if (inputRef.current?.value) {
            event.preventDefault();
            onClearSearch?.();
          } else {
            // 否则关闭弹出框
            event.preventDefault();
            onClosePopup?.();
            inputRef.current?.blur();
          }
        }
        // 重置选中状态
        setSelectedIndex(-1);
        return;
      }

      // 如果没有结果，不处理导航
      if (resultCount === 0) return;

      // 上箭头 - 向上导航
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((prev) => {
          if (prev <= 0) return resultCount - 1;
          return prev - 1;
        });
        return;
      }

      // 下箭头 - 向下导航
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((prev) => {
          if (prev >= resultCount - 1) return 0;
          return prev + 1;
        });
        return;
      }

      // Enter 键 - 打开选中的结果
      if (event.key === "Enter" && selectedIndex >= 0 && !isInInput) {
        event.preventDefault();
        onOpenResult?.(selectedIndex);
        return;
      }
    },
    [
      enabled,
      inputRef,
      isInputFocused,
      resultCount,
      selectedIndex,
      onClearSearch,
      onClosePopup,
      onOpenResult,
    ],
  );

  // 注册键盘事件监听
  useEffect(() => {
    if (!enabled) return;

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, handleKeyDown]);

  return {
    selectedIndex,
    setSelectedIndex,
    resetSelection,
    shortcuts: SHORTCUTS,
  };
}

export default useSearchKeyboard;
