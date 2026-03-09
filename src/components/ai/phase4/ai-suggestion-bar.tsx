"use client";

/**
 * AI 快捷建议栏组件
 *
 * 在消息列表下方显示的快捷操作建议
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import type { LucideIcon } from "lucide-react";
// =============================================================================
// 类型定义
// =============================================================================

export interface AISuggestionBarProps {
  /** 设置输入内容的回调 */
  onSetInput: (input: string) => void;
  /** 是否显示（有消息且不在加载中时显示） */
  visible: boolean;
}

interface SuggestionItem {
  id: string;
  label: string;
  input: string;
  icon?: LucideIcon;
  colorClass: string;
}

// =============================================================================
// 快捷建议配置
// =============================================================================

const SUGGESTIONS: SuggestionItem[] = [
  {
    id: "continue",
    label: "继续 →",
    input: "继续",
    colorClass:
      "text-pink-600 border-pink-200 hover:bg-pink-50 hover:border-pink-300",
  },
  {
    id: "search",
    label: "🔍 搜索相关",
    input: "搜索相关内容",
    colorClass:
      "text-purple-600 border-purple-200 hover:bg-purple-50 hover:border-purple-300",
  },
  {
    id: "details",
    label: "📋 更多详情",
    input: "给我更多详情",
    colorClass:
      "text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300",
  },
];

// =============================================================================
// 组件实现
// =============================================================================

export function AISuggestionBar({ onSetInput, visible }: AISuggestionBarProps) {
  if (!visible) return null;

  return (
    <div className="px-4 py-2 border-t border-pink-100 bg-gradient-to-r from-pink-50/50 to-purple-50/50 flex-shrink-0">
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {SUGGESTIONS.map((suggestion) => {
          const Icon = suggestion.icon;
          return (
            <button
              key={suggestion.id}
              onClick={() => onSetInput(suggestion.input)}
              className={`flex-shrink-0 px-3 py-1.5 bg-white border rounded-full text-xs transition-colors shadow-sm flex items-center gap-1 ${suggestion.colorClass}`}
            >
              {Icon && <Icon className="size-3" />}
              {suggestion.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
