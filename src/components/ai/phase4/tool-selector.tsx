/**
 * Phase 4: 工具选择器组件
 *
 * 功能：
 * - 工具选择 UI（糖果色风格）
 * - Tooltip 显示工具描述和快捷键
 * - 键盘快捷键支持（数字键 0-4）
 * - 选中状态动画
 *
 * @version 1.1.0
 * @since 2025-12-25
 */

"use client";

import { memo, useCallback, useEffect } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ToolType, ToolDefinition } from "./types";

// =============================================================================
// 常量定义
// =============================================================================

export const TOOLS: ToolDefinition[] = [
  {
    id: "auto",
    name: "智能",
    icon: "✨",
    description: "AI 自动选择最佳工具",
    shortcut: "0",
  },
  {
    id: "search",
    name: "搜索",
    icon: "🔍",
    description: "搜索收藏内容",
    shortcut: "1",
  },
  {
    id: "organize",
    name: "整理",
    icon: "📂",
    description: "整理和分类书签",
    shortcut: "2",
  },
  {
    id: "create",
    name: "创作",
    icon: "✍️",
    description: "生成内容和摘要",
    shortcut: "3",
  },
  {
    id: "export",
    name: "导出",
    icon: "📤",
    description: "导出数据到多种格式",
    shortcut: "4",
  },
];

// =============================================================================
// Props 类型
// =============================================================================

export interface ToolSelectorProps {
  value: ToolType;
  onChange: (tool: ToolType) => void;
  disabled?: boolean;
  className?: string;
  /** 是否显示工具名称（默认 false，仅显示图标） */
  showLabel?: boolean;
  /** 是否显示快捷键提示（默认 true） */
  showShortcut?: boolean;
}

// =============================================================================
// Hook: 工具快捷键
// =============================================================================

export function useToolShortcuts(
  onToolChange: (tool: ToolType) => void,
  enabled: boolean = true,
): void {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;
      // 忽略组合键
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      // 忽略输入框内的按键
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const tool = TOOLS.find((t) => t.shortcut === event.key);
      if (tool) {
        event.preventDefault();
        onToolChange(tool.id);
      }
    },
    [onToolChange, enabled],
  );

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener(
      "keydown",
      handleKeyDown as unknown as EventListener,
    );
    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown as unknown as EventListener,
      );
    };
  }, [handleKeyDown, enabled]);
}

// =============================================================================
// 组件
// =============================================================================

/**
 * 工具选择器组件
 *
 * 糖果色风格的工具选择器，支持：
 * - Tooltip 显示描述和快捷键
 * - 数字键快捷切换
 * - 选中状态动画效果
 */
export const ToolSelector = memo(function ToolSelector({
  value,
  onChange,
  disabled = false,
  className,
  showLabel = false,
  showShortcut = true,
}: ToolSelectorProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          "flex items-center gap-1 rounded-xl bg-gray-50/80 p-1",
          "border border-gray-100",
          className,
        )}
      >
        {TOOLS.map((tool) => {
          const isSelected = value === tool.id;

          return (
            <Tooltip key={tool.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(tool.id)}
                  className={cn(
                    "relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5",
                    "text-sm font-medium transition-all duration-200",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300",
                    isSelected
                      ? "bg-gradient-to-r from-pink-100 to-rose-100 text-pink-600 shadow-sm"
                      : "text-gray-500 hover:bg-white hover:text-gray-700 hover:shadow-sm",
                    disabled && "opacity-50 cursor-not-allowed",
                  )}
                  aria-pressed={isSelected}
                  aria-label={`${tool.name}: ${tool.description}`}
                >
                  {/* 图标 */}
                  <span className="text-base" role="img" aria-hidden="true">
                    {tool.icon}
                  </span>

                  {/* 名称（可选） */}
                  {showLabel && <span className="text-xs">{tool.name}</span>}

                  {/* 选中指示器 */}
                  {isSelected && (
                    <span
                      className={cn(
                        "absolute -bottom-0.5 left-1/2 -translate-x-1/2",
                        "h-0.5 w-4 rounded-full bg-pink-400",
                      )}
                    />
                  )}
                </button>
              </TooltipTrigger>

              <TooltipContent
                side="bottom"
                sideOffset={8}
                className="bg-gray-900 text-white border-0"
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{tool.name}</span>
                    {showShortcut && (
                      <kbd className="px-1.5 py-0.5 text-[10px] bg-gray-700 rounded">
                        {tool.shortcut}
                      </kbd>
                    )}
                  </div>
                  <span className="text-xs text-gray-300">
                    {tool.description}
                  </span>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
});

// =============================================================================
// 紧凑版本（仅图标）
// =============================================================================

/**
 * 紧凑版工具选择器
 *
 * 用于空间受限的场景，仅显示图标
 */
export const ToolSelectorCompact = memo(function ToolSelectorCompact({
  value,
  onChange,
  disabled = false,
  className,
}: Omit<ToolSelectorProps, "showLabel" | "showShortcut">) {
  return (
    <ToolSelector
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={className}
      showLabel={false}
      showShortcut={true}
    />
  );
});

// =============================================================================
// 完整版本（带名称）
// =============================================================================

/**
 * 完整版工具选择器
 *
 * 显示图标和名称，适合有足够空间的场景
 */
export const ToolSelectorFull = memo(function ToolSelectorFull({
  value,
  onChange,
  disabled = false,
  className,
}: Omit<ToolSelectorProps, "showLabel" | "showShortcut">) {
  return (
    <ToolSelector
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={className}
      showLabel={true}
      showShortcut={true}
    />
  );
});

export default ToolSelector;
