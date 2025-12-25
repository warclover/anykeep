/**
 * AI 记忆指示器组件
 *
 * 显示 AI 成功解析指代词的提示
 * 例如：用户说"把刚才的保存下来"，显示"AI 记住了「刚才的」→ 上一次输出"
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

"use client";

import { memo } from "react";
import { Brain, Sparkles, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MemoryInfo } from "./types";

/**
 * 指代类型的中文映射
 */
const REFERENCE_TYPE_LABELS: Record<string, string> = {
  last_output: "上一次输出",
  these_results: "这些搜索结果",
  that_folder: "那个文件夹",
  that_bookmark: "那篇文章",
  previous: "上一个操作对象",
  mentioned: "提到的内容",
};

/**
 * 获取指代类型的中文显示
 */
function getReferenceTypeLabel(type: string): string {
  return REFERENCE_TYPE_LABELS[type] || type;
}

export interface MemoryIndicatorProps {
  /** 记忆信息 */
  memory: MemoryInfo;
  /** 自定义类名 */
  className?: string;
  /** 是否显示详情 */
  showDetails?: boolean;
}

/**
 * AI 记忆指示器 - 内联紧凑版
 *
 * 显示为一个小标签，表示 AI 理解了上下文
 */
export const MemoryIndicator = memo(function MemoryIndicator({
  memory,
  className,
  showDetails = false,
}: MemoryIndicatorProps) {
  // 没有成功解析的指代，不显示
  if (!memory.resolved || memory.referenceCount === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        "bg-gradient-to-r from-violet-100 to-purple-100 text-violet-700 border border-violet-200",
        "shadow-sm",
        className,
      )}
    >
      <Brain className="size-3" />
      <span>AI 记住了</span>
      {showDetails && memory.referenceTypes.length > 0 && (
        <span className="text-violet-500">
          · {memory.referenceTypes.map(getReferenceTypeLabel).join("、")}
        </span>
      )}
    </div>
  );
});

/**
 * AI 记忆指示器 - 展开详情版
 *
 * 显示完整的指代解析信息
 */
export const MemoryIndicatorExpanded = memo(function MemoryIndicatorExpanded({
  memory,
  className,
}: MemoryIndicatorProps) {
  // 没有成功解析的指代，不显示
  if (!memory.resolved || memory.referenceCount === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-lg bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-100 p-3",
        className,
      )}
    >
      {/* 头部 */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center justify-center size-6 rounded-lg bg-gradient-to-br from-violet-400 to-purple-400 shadow-sm">
          <Brain className="size-3.5 text-white" />
        </div>
        <h4 className="text-sm font-medium text-violet-800">AI 理解了上下文</h4>
        <CheckCircle className="size-4 text-emerald-500 ml-auto" />
      </div>

      {/* 解析详情 */}
      <div className="space-y-1.5">
        {/* 原始输入 → 解析后输入 */}
        {memory.originalInput !== memory.resolvedInput && (
          <div className="text-xs text-gray-600 bg-white/60 rounded-md px-2.5 py-1.5">
            <div className="flex items-center gap-2">
              <span className="text-violet-600 font-medium">
                「{extractReference(memory.originalInput)}」
              </span>
              <Sparkles className="size-3 text-amber-500" />
              <span className="text-gray-700">
                {memory.referenceTypes.map(getReferenceTypeLabel).join("、")}
              </span>
            </div>
          </div>
        )}

        {/* 解析数量 */}
        <div className="text-xs text-gray-500">
          已解析 {memory.referenceCount} 个指代词
        </div>
      </div>
    </div>
  );
});

/**
 * 从输入中提取可能的指代词
 */
function extractReference(input: string): string {
  // 常见指代词模式
  const patterns = [
    /刚才的?/,
    /刚刚的?/,
    /这些/,
    /这几个/,
    /那个文件夹/,
    /那篇文章/,
    /那个链接/,
    /上一个/,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      return match[0];
    }
  }

  // 如果没找到，返回前 10 个字符
  return input.slice(0, 10) + (input.length > 10 ? "..." : "");
}

/**
 * AI 记忆状态提示 - Toast 样式
 *
 * 用于短暂显示"AI 记住了"的提示
 */
export const MemoryToast = memo(function MemoryToast({
  memory,
  className,
}: MemoryIndicatorProps) {
  if (!memory.resolved || memory.referenceCount === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg",
        "bg-violet-600 text-white shadow-lg",
        "animate-in slide-in-from-bottom-2 fade-in duration-300",
        className,
      )}
    >
      <Brain className="size-4" />
      <span className="text-sm font-medium">
        AI 记住了「{memory.referenceTypes.map(getReferenceTypeLabel).join("、")}
        」
      </span>
    </div>
  );
});
