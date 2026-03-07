/**
 * V2 结构化摘要渲染组件
 *
 * 从 summary-renderer.tsx 提取
 */

import {
  Lightbulb,
  List,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckSquare,
  Clock,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  StructuredSummary,
  Sentiment,
} from "@/lib/classification/types/ai-summary";

// =============================================================================
// 辅助函数
// =============================================================================

function getSentimentIcon(sentiment: Sentiment): {
  icon: React.ReactNode;
  colorClass: string;
  label: string;
} {
  switch (sentiment) {
    case "positive":
      return {
        icon: <TrendingUp className="size-3" />,
        colorClass: "text-green-500 bg-green-50 dark:bg-green-900/30",
        label: "积极",
      };
    case "negative":
      return {
        icon: <TrendingDown className="size-3" />,
        colorClass: "text-red-500 bg-red-50 dark:bg-red-900/30",
        label: "消极",
      };
    default:
      return {
        icon: <Minus className="size-3" />,
        colorClass: "text-gray-500 bg-gray-50 dark:bg-gray-800/50",
        label: "中性",
      };
  }
}

// =============================================================================
// 组件
// =============================================================================

interface StructuredSummaryRendererProps {
  data: StructuredSummary;
  className?: string;
}

export function StructuredSummaryRenderer({
  data,
  className,
}: StructuredSummaryRendererProps) {
  const sentimentData = getSentimentIcon(data.sentiment);

  return (
    <div
      className={cn(
        "rounded-xl p-5 bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/30 border border-slate-200/60 dark:border-slate-700/50 space-y-4",
        className,
      )}
    >
      {/* TL;DR - 核心主旨 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center size-6 rounded-full bg-white dark:bg-slate-800 shadow-sm text-blue-500">
            <Lightbulb className="size-4" />
          </span>
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            核心主旨
          </h4>
        </div>
        <div className="border-l-4 border-blue-500 dark:border-blue-400 pl-3 py-2 bg-white/60 dark:bg-slate-800/50 rounded-r-lg">
          <p className="text-sm text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
            {data.tldr}
          </p>
        </div>
      </div>

      {/* Key Points - 关键要点 */}
      {data.key_points.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 pt-1">
            <span className="flex items-center justify-center size-6 rounded-full bg-white dark:bg-slate-800 shadow-sm text-emerald-500">
              <List className="size-4" />
            </span>
            <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              关键价值点
            </h4>
          </div>
          <ul className="space-y-2 ml-1">
            {data.key_points.map((point, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="flex-shrink-0 flex items-center justify-center size-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-medium mt-0.5">
                  {i + 1}
                </span>
                <span className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {point}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Items - 行动项（仅教程类显示） */}
      {data.action_items && data.action_items.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 pt-1">
            <span className="flex items-center justify-center size-6 rounded-full bg-white dark:bg-slate-800 shadow-sm text-amber-500">
              <CheckSquare className="size-4" />
            </span>
            <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              行动步骤
            </h4>
          </div>
          <ul className="space-y-1.5 ml-1">
            {data.action_items.map((action, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-slate-600 dark:text-slate-400"
              >
                <span className="text-amber-500 mt-1">▸</span>
                <span className="text-sm leading-relaxed">{action}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Meta Info - 元信息栏 */}
      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/50">
        {/* 情感倾向 */}
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
            sentimentData.colorClass,
          )}
        >
          {sentimentData.icon}
          {sentimentData.label}
        </span>

        {/* 阅读时间 */}
        {data.reading_time > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <Clock className="size-3" />
            {data.reading_time} 分钟
          </span>
        )}

        {/* 关键词标签 */}
        {data.keywords.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Tag className="size-3 text-slate-400" />
            {data.keywords.slice(0, 5).map((keyword, i) => (
              <span
                key={i}
                className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              >
                {keyword}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
