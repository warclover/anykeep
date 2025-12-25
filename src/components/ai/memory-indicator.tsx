/**
 * AI 记忆指示器组件
 *
 * 显示 AI 成功解析指代词的提示
 * 例如：用户说"把刚才的保存下来"，显示"AI 记住了「刚才的」→ 上一次输出"
 *
 * @version 1.1.0
 * @since 2025-12-25
 * @updated 2025-12-25 - 修复 Medium 优先级问题
 */

"use client";

import { memo, useState, useEffect } from "react";
import { Brain, Sparkles, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MemoryInfo } from "./types";

// ============================================
// 常量配置
// ============================================

/** 指代词预览最大长度 */
const MAX_REFERENCE_PREVIEW_LENGTH = 10;

/** Toast 默认显示时长（毫秒） */
const DEFAULT_TOAST_DURATION = 3000;

/**
 * UI 文本常量 - 集中管理所有显示文本
 * 便于将来接入 i18n 框架（如 next-intl, react-i18next）
 */
const UI_TEXT = {
  /** 指示器标题 */
  title: "AI 记住了",
  /** 展开版标题 */
  expandedTitle: "AI 理解了上下文",
  /** 解析计数模板 */
  resolvedCount: (count: number) => `已解析 ${count} 个指代词`,
  /** Toast 消息模板 */
  toastMessage: (types: string) => `AI 记住了「${types}」`,
  /** 无障碍标签 */
  aria: {
    indicatorLabel: (count: number) => `AI 成功解析了 ${count} 个指代词`,
    expandedLabel: "AI 理解了上下文",
  },
  /** 指代类型映射 */
  referenceTypes: {
    last_output: "上一次输出",
    these_results: "这些搜索结果",
    that_folder: "那个文件夹",
    that_bookmark: "那篇文章",
    previous: "上一个操作对象",
    mentioned: "提到的内容",
  } as Record<string, string>,
} as const;

/** 预编译的指代词正则表达式 */
const REFERENCE_PATTERNS: readonly RegExp[] = [
  /刚才的?/,
  /刚刚的?/,
  /这些/,
  /这几个/,
  /那个文件夹/,
  /那篇文章/,
  /那个链接/,
  /上一个/,
] as const;

// ============================================
// 类型定义
// ============================================

/** 基础记忆指示器属性 */
interface BaseMemoryIndicatorProps {
  /** 记忆信息 */
  memory: MemoryInfo;
  /** 自定义类名 */
  className?: string;
}

/** 紧凑版记忆指示器属性 */
export interface MemoryIndicatorProps extends BaseMemoryIndicatorProps {
  /** 是否显示详情 */
  showDetails?: boolean;
}

/** Toast 版记忆指示器属性 */
export interface MemoryToastProps extends BaseMemoryIndicatorProps {
  /** 显示时长（毫秒），默认 3000ms */
  duration?: number;
  /** 自动消失后的回调 */
  onDismiss?: () => void;
}

// ============================================
// 辅助函数
// ============================================

/**
 * 获取指代类型的中文显示
 */
function getReferenceTypeLabel(type: string): string {
  return UI_TEXT.referenceTypes[type] || type;
}

/**
 * 从输入中提取可能的指代词
 */
function extractReference(input: string): string {
  for (const pattern of REFERENCE_PATTERNS) {
    const match = input.match(pattern);
    if (match) {
      return match[0];
    }
  }

  // 如果没找到，返回前 N 个字符
  return (
    input.slice(0, MAX_REFERENCE_PREVIEW_LENGTH) +
    (input.length > MAX_REFERENCE_PREVIEW_LENGTH ? "..." : "")
  );
}

// ============================================
// 组件
// ============================================

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
      role="status"
      aria-label={UI_TEXT.aria.indicatorLabel(memory.referenceCount)}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        "bg-gradient-to-r from-violet-100 to-purple-100 text-violet-700 border border-violet-200",
        "shadow-sm",
        className,
      )}
    >
      <Brain className="size-3" aria-hidden="true" />
      <span>{UI_TEXT.title}</span>
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
}: BaseMemoryIndicatorProps) {
  // 没有成功解析的指代，不显示
  if (!memory.resolved || memory.referenceCount === 0) {
    return null;
  }

  return (
    <div
      role="status"
      aria-label={UI_TEXT.aria.expandedLabel}
      className={cn(
        "rounded-lg bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-100 p-3",
        className,
      )}
    >
      {/* 头部 */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center justify-center size-6 rounded-lg bg-gradient-to-br from-violet-400 to-purple-400 shadow-sm">
          <Brain className="size-3.5 text-white" aria-hidden="true" />
        </div>
        <h4 className="text-sm font-medium text-violet-800">
          {UI_TEXT.expandedTitle}
        </h4>
        <CheckCircle
          className="size-4 text-emerald-500 ml-auto"
          aria-hidden="true"
        />
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
              <Sparkles className="size-3 text-amber-500" aria-hidden="true" />
              <span className="text-gray-700">
                {memory.referenceTypes.map(getReferenceTypeLabel).join("、")}
              </span>
            </div>
          </div>
        )}

        {/* 解析数量 */}
        <div className="text-xs text-gray-500">
          {UI_TEXT.resolvedCount(memory.referenceCount)}
        </div>
      </div>
    </div>
  );
});

/**
 * AI 记忆状态提示 - Toast 样式
 *
 * 用于短暂显示"AI 记住了"的提示，支持自动消失
 *
 * 注意：当需要重新显示 Toast 时，父组件应通过更改 key 属性来重置组件
 * 例如：<MemoryToast key={memory.referenceCount} memory={memory} />
 */
export const MemoryToast = memo(function MemoryToast({
  memory,
  className,
  duration = DEFAULT_TOAST_DURATION,
  onDismiss,
}: MemoryToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  // 自动消失逻辑
  useEffect(() => {
    if (!memory.resolved || memory.referenceCount === 0) return;

    const timer = setTimeout(() => {
      setIsVisible(false);
      onDismiss?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [memory.resolved, memory.referenceCount, duration, onDismiss]);

  if (!memory.resolved || memory.referenceCount === 0 || !isVisible) {
    return null;
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg",
        "bg-violet-600 text-white shadow-lg",
        "animate-in slide-in-from-bottom-2 fade-in duration-300",
        className,
      )}
    >
      <Brain className="size-4" aria-hidden="true" />
      <span className="text-sm font-medium">
        {UI_TEXT.toastMessage(
          memory.referenceTypes.map(getReferenceTypeLabel).join("、"),
        )}
      </span>
    </div>
  );
});
