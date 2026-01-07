/**
 * 搜索快捷键提示组件
 *
 * 显示可用的键盘快捷键列表
 *
 * @version 1.0.0
 * @since 2026-01-07
 */

"use client";

import { memo } from "react";
import { Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// 类型定义
// ============================================

export interface SearchKeyboardHintsProps {
  /** 快捷键列表 */
  shortcuts: { key: string; description: string }[];
  /** 是否显示 */
  visible?: boolean;
  /** 自定义类名 */
  className?: string;
}

// ============================================
// 组件
// ============================================

/**
 * 搜索快捷键提示
 */
export const SearchKeyboardHints = memo(function SearchKeyboardHints({
  shortcuts,
  visible = true,
  className,
}: SearchKeyboardHintsProps) {
  if (!visible || shortcuts.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500",
        className,
      )}
    >
      <div className="flex items-center gap-1">
        <Keyboard className="size-3.5" />
        <span>快捷键:</span>
      </div>
      {shortcuts.map((shortcut) => (
        <div key={shortcut.key} className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-[10px] font-mono">
            {shortcut.key}
          </kbd>
          <span>{shortcut.description}</span>
        </div>
      ))}
    </div>
  );
});

export default SearchKeyboardHints;
