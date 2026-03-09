/**
 * 洞察项组件
 *
 * 展示单条主动洞察，支持点击交互
 *
 * @version 1.0.0
 * @since 2025-12-30
 */

"use client";

import React from "react";
import {
  Sparkles,
  TrendingUp,
  Lightbulb,
  AlertCircle,
  RefreshCw,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProactiveInsight } from "@/lib/ai-agent/proactive-briefing";

// ============================================
// 类型定义
// ============================================

export interface InsightItemProps {
  /** 洞察数据 */
  insight: ProactiveInsight;
  /** 点击回调 */
  onClick?: (insight: ProactiveInsight) => void;
  /** 是否紧凑模式 */
  compact?: boolean;
  /** 自定义类名 */
  className?: string;
}

// ============================================
// 图标映射
// ============================================

const insightIcons: Record<ProactiveInsight["type"], React.ElementType> = {
  topic_emergence: Sparkles,
  pattern_detected: TrendingUp,
  recommendation: Lightbulb,
  knowledge_gap: AlertCircle,
  content_update: RefreshCw,
};

const insightColors: Record<
  ProactiveInsight["type"],
  { icon: string; bg: string; border: string }
> = {
  topic_emergence: {
    icon: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-950/30",
    border: "border-purple-200 dark:border-purple-800",
  },
  pattern_detected: {
    icon: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
  },
  recommendation: {
    icon: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800",
  },
  knowledge_gap: {
    icon: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    border: "border-orange-200 dark:border-orange-800",
  },
  content_update: {
    icon: "text-green-600 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-950/30",
    border: "border-green-200 dark:border-green-800",
  },
};

const insightLabels: Record<ProactiveInsight["type"], string> = {
  topic_emergence: "新主题发现",
  pattern_detected: "模式检测",
  recommendation: "推荐内容",
  knowledge_gap: "知识盲区",
  content_update: "内容更新",
};

// ============================================
// 组件实现
// ============================================

/**
 * 洞察项组件
 *
 * @example
 * ```tsx
 * <InsightItem
 *   insight={insight}
 *   onClick={(i) => handleClick(i)}
 * />
 * ```
 */
export function InsightItem({
  insight,
  onClick,
  compact = false,
  className,
}: InsightItemProps) {
  const Icon = insightIcons[insight.type];
  const colors = insightColors[insight.type];
  const label = insightLabels[insight.type];

  const handleClick = () => {
    onClick?.(insight);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "group relative flex items-start gap-3 rounded-lg border p-3 transition-all",
        "cursor-pointer hover:shadow-sm",
        colors.bg,
        colors.border,
        insight.isRead && "opacity-70",
        className,
      )}
      data-testid="insight-item"
    >
      {/* 图标 */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          "bg-white dark:bg-gray-800",
          colors.border,
          "border",
        )}
      >
        <Icon className={cn("h-4 w-4", colors.icon)} />
      </div>

      {/* 内容 */}
      <div className="min-w-0 flex-1">
        {/* 标题行 */}
        <div className="flex items-center gap-2">
          <span className={cn("text-xs font-medium", colors.icon)}>
            {label}
          </span>
          {insight.isRead && (
            <Check className="h-3 w-3 text-muted-foreground" />
          )}
        </div>

        {/* 标题 */}
        <h4 className="mt-0.5 text-sm font-medium text-foreground line-clamp-1">
          {insight.title}
        </h4>

        {/* 摘要 */}
        {!compact && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
            {insight.summary}
          </p>
        )}

        {/* 关联数量 */}
        {insight.relatedBookmarkIds.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            关联 {insight.relatedBookmarkIds.length} 条收藏
          </p>
        )}
      </div>

      {/* 优先级指示器 */}
      {insight.priority >= 8 && (
        <div className="absolute right-2 top-2">
          <span className="flex h-2 w-2 rounded-full bg-red-500" />
        </div>
      )}
    </div>
  );
}
