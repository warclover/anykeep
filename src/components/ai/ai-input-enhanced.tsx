"use client";

/**
 * Phase 4: AI 增强输入组件
 *
 * 在原有 AIInput 基础上增加：
 * - ToolSelector: 工具选择器
 * - ContextIndicator: 上下文引用指示器
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import { useRef, useCallback, type KeyboardEvent } from "react";
import { Send, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ToolSelector, useToolShortcuts } from "./phase4/tool-selector";
import { ContextIndicator } from "./phase4/context-panel";
import type { ToolType, ContextItem } from "./phase4/types";

// =============================================================================
// 类型定义
// =============================================================================

export interface AIInputEnhancedProps {
  /** 输入值 */
  value: string;
  /** 值变化回调 */
  onChange: (value: string) => void;
  /** 提交回调 */
  onSubmit: (tool: ToolType) => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 占位符文本 */
  placeholder?: string;
  /** 当前选中的工具 */
  selectedTool: ToolType;
  /** 工具变化回调 */
  onToolChange: (tool: ToolType) => void;
  /** 上下文项列表 */
  contextItems: ContextItem[];
  /** 展开上下文面板回调 */
  onExpandContext: () => void;
  /** 清除上下文回调 */
  onClearContext: () => void;
  /** 是否启用快捷键 */
  enableShortcuts?: boolean;
}

// =============================================================================
// 组件实现
// =============================================================================

export function AIInputEnhanced({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = "输入消息，按 Enter 发送...",
  selectedTool,
  onToolChange,
  contextItems,
  onExpandContext,
  onClearContext,
  enableShortcuts = true,
}: AIInputEnhancedProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 启用工具快捷键
  useToolShortcuts(enableShortcuts && !disabled ? onToolChange : undefined);

  // 处理键盘事件
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter 发送（Shift+Enter 换行）
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (value.trim() && !disabled) {
          onSubmit(selectedTool);
        }
      }
    },
    [value, disabled, onSubmit, selectedTool],
  );

  // 处理提交
  const handleSubmit = useCallback(() => {
    if (value.trim() && !disabled) {
      onSubmit(selectedTool);
    }
  }, [value, disabled, onSubmit, selectedTool]);

  const hasContext = contextItems.length > 0;

  return (
    <div className="border-t border-pink-100 bg-gradient-to-t from-pink-50/30 to-white">
      {/* 上下文引用指示器 */}
      {hasContext && (
        <ContextIndicator
          items={contextItems}
          onExpand={onExpandContext}
          onClear={onClearContext}
        />
      )}

      {/* 输入区域 */}
      <div className="p-4">
        <div className="flex items-end gap-3">
          {/* 工具选择器 */}
          <ToolSelector
            value={selectedTool}
            onChange={onToolChange}
            disabled={disabled}
            className="flex-shrink-0"
          />

          {/* 输入框容器 - 糖果色风格 */}
          <div
            className={cn(
              "flex-1 bg-white rounded-2xl px-4 py-3 transition-all duration-200",
              "border-2 border-pink-100",
              "focus-within:border-pink-300 focus-within:shadow-[0_0_0_3px_rgba(244,114,182,0.15)]",
            )}
          >
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              rows={1}
              className={cn(
                "w-full bg-transparent resize-none outline-none text-gray-700 placeholder-gray-400 text-sm",
                "min-h-[24px] max-h-[100px] border-0 p-0 focus-visible:ring-0",
              )}
              style={{
                height: "auto",
                overflow: "hidden",
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = `${Math.min(target.scrollHeight, 100)}px`;
              }}
            />
          </div>

          {/* 发送按钮 - 糖果色风格 */}
          <button
            onClick={handleSubmit}
            disabled={disabled || !value.trim()}
            className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200",
              "bg-gradient-to-r from-pink-400 to-rose-400 text-white",
              "shadow-lg shadow-pink-200 hover:shadow-pink-300 hover:scale-105",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none",
            )}
          >
            {disabled ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Send className="size-5" />
            )}
          </button>
        </div>

        {/* 工具提示 */}
        {selectedTool !== "auto" && (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-md">
              使用「{getToolLabel(selectedTool)}」工具
            </span>
            <span className="text-muted-foreground/60">
              按 ⌘A 切换回自动模式
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// 辅助函数
// =============================================================================

function getToolLabel(tool: ToolType): string {
  const labels: Record<ToolType, string> = {
    auto: "自动",
    search: "搜索",
    organize: "整理",
    summarize: "总结",
    export: "导出",
    extract: "萃取",
    review: "复习",
    stats: "统计",
    tag: "标签",
    dedupe: "去重",
    create: "创作",
  };
  return labels[tool] || tool;
}

export default AIInputEnhanced;
