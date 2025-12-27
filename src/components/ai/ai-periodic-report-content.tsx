/**
 * AI 周期报告内容渲染组件
 *
 * 专门用于渲染 periodic_report Skill 生成的周报/月报/日报
 * 将结构化数据转换为可视化的卡片布局
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

"use client";

import { memo } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  BarChart3,
  Sparkles,
  ExternalLink,
  Trophy,
  Lightbulb,
  Target,
  Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AIMarkdown } from "./ai-markdown";

// ============================================
// 类型定义（从 periodic-report types 简化）
// ============================================

interface PeriodStats {
  newBookmarks: number;
  activeDays: number;
  dailyAverage: number;
  estimatedReadingTime: number;
  mostActiveDay: string;
  mostActiveHour: number;
}

interface PeriodComparison {
  currentPeriod: string;
  previousPeriod: string;
  bookmarksChange: {
    current: number;
    previous: number;
    changeRate: number;
    trend: "up" | "down" | "stable";
  };
  activityChange?: {
    current: number;
    previous: number;
    changeRate: number;
    trend: "up" | "down" | "stable";
  };
}

interface HighlightBookmark {
  id: number;
  title: string;
  url: string;
  platform: string;
  summary?: string;
  reason: string;
  createdAt: string;
}

interface PeriodInsight {
  type: "achievement" | "trend" | "suggestion" | "milestone";
  title: string;
  description: string;
  icon: string;
}

interface PeriodicReportData {
  title: string;
  period: string;
  periodLabel: string;
  dateRange: {
    start: string;
    end: string;
  };
  stats: PeriodStats;
  comparison?: PeriodComparison;
  highlights: HighlightBookmark[];
  insights: PeriodInsight[];
  summary: string;
  suggestions: string[];
  generatedAt: string;
}

interface AIPeriodicReportContentProps {
  content: unknown;
  className?: string;
}

// ============================================
// 辅助组件
// ============================================

/**
 * 统计卡片
 */
const StatCard = memo(function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  colorClass = "text-purple-600 bg-purple-100",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subValue?: string;
  colorClass?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-100 shadow-sm">
      <div className={cn("p-2 rounded-lg", colorClass)}>
        <Icon className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-sm font-semibold text-gray-800 truncate">
          {value}
        </div>
        {subValue && (
          <div className="text-xs text-gray-400 truncate">{subValue}</div>
        )}
      </div>
    </div>
  );
});

/**
 * 变化趋势指示器
 */
const TrendIndicator = memo(function TrendIndicator({
  trend,
  changeRate,
  current,
  previous,
}: {
  trend: "up" | "down" | "stable";
  changeRate: number;
  current: number;
  previous: number;
}) {
  const Icon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const colorClass =
    trend === "up"
      ? "text-green-600 bg-green-50"
      : trend === "down"
        ? "text-orange-600 bg-orange-50"
        : "text-gray-600 bg-gray-50";
  const symbol = trend === "up" ? "🔼" : trend === "down" ? "🔽" : "➡️";

  return (
    <div className={cn("flex items-center gap-2 p-3 rounded-lg", colorClass)}>
      <Icon className="size-4" />
      <div className="flex-1">
        <div className="text-sm font-medium">
          {symbol} {Math.abs(changeRate).toFixed(0)}%
        </div>
        <div className="text-xs opacity-75">
          本期 {current} 条 vs 上期 {previous} 条
        </div>
      </div>
    </div>
  );
});

/**
 * 亮点书签卡片
 */
const HighlightCard = memo(function HighlightCard({
  highlight,
}: {
  highlight: HighlightBookmark;
}) {
  return (
    <div className="p-3 rounded-lg border border-amber-100 bg-amber-50/50 hover:bg-amber-50 transition-colors">
      <div className="flex items-start gap-2">
        <Sparkles className="size-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <a
            href={highlight.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-gray-800 hover:text-purple-600 line-clamp-2 flex items-center gap-1"
          >
            {highlight.title}
            <ExternalLink className="size-3 flex-shrink-0 opacity-50" />
          </a>
          <div className="text-xs text-amber-600 mt-0.5">
            {highlight.reason}
          </div>
          {highlight.summary && (
            <AIMarkdown
              content={highlight.summary}
              className="text-xs text-gray-500 mt-1 line-clamp-2"
            />
          )}
        </div>
      </div>
    </div>
  );
});

/**
 * 洞察卡片
 */
const InsightCard = memo(function InsightCard({
  insight,
}: {
  insight: PeriodInsight;
}) {
  const typeConfig: Record<
    string,
    { icon: React.ElementType; colorClass: string }
  > = {
    achievement: { icon: Trophy, colorClass: "text-amber-500" },
    trend: { icon: TrendingUp, colorClass: "text-blue-500" },
    suggestion: { icon: Lightbulb, colorClass: "text-green-500" },
    milestone: { icon: Target, colorClass: "text-purple-500" },
  };

  const config = typeConfig[insight.type] || typeConfig.suggestion;
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-gray-50 border border-gray-100">
      <Icon className={cn("size-4 flex-shrink-0 mt-0.5", config.colorClass)} />
      <div>
        <div className="text-sm font-medium text-gray-800">{insight.title}</div>
        <AIMarkdown
          content={insight.description}
          className="text-xs text-gray-600 mt-0.5"
        />
      </div>
    </div>
  );
});

// ============================================
// 类型守卫
// ============================================

/**
 * 类型守卫：检查是否为周期报告数据
 */
function isPeriodicReportData(content: unknown): content is PeriodicReportData {
  if (typeof content !== "object" || content === null) {
    return false;
  }
  const obj = content as Record<string, unknown>;
  return (
    typeof obj.title === "string" &&
    typeof obj.period === "string" &&
    typeof obj.stats === "object" &&
    Array.isArray(obj.highlights) &&
    Array.isArray(obj.insights)
  );
}

// ============================================
// 主组件
// ============================================

/**
 * AI 周期报告内容渲染组件
 */
export const AIPeriodicReportContent = memo(function AIPeriodicReportContent({
  content,
  className,
}: AIPeriodicReportContentProps) {
  // 验证数据格式
  if (!isPeriodicReportData(content)) {
    return (
      <div className="text-sm text-gray-500 italic">无法解析周期报告数据</div>
    );
  }

  const { stats, comparison, highlights, insights, suggestions } = content;

  // 格式化日期
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("zh-CN", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* 统计概览 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard
          icon={BarChart3}
          label="新增收藏"
          value={stats.newBookmarks}
          subValue="条"
          colorClass="text-purple-600 bg-purple-100"
        />
        <StatCard
          icon={Flame}
          label="活跃天数"
          value={stats.activeDays}
          subValue="天"
          colorClass="text-orange-600 bg-orange-100"
        />
        <StatCard
          icon={TrendingUp}
          label="日均收藏"
          value={stats.dailyAverage.toFixed(1)}
          subValue="条/天"
          colorClass="text-blue-600 bg-blue-100"
        />
        <StatCard
          icon={Calendar}
          label="最活跃日"
          value={formatDate(stats.mostActiveDay)}
          colorClass="text-green-600 bg-green-100"
        />
      </div>

      {/* 历史对比 */}
      {comparison && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
            <BarChart3 className="size-3.5" />
            <span>与上期对比</span>
          </div>
          <TrendIndicator
            trend={comparison.bookmarksChange.trend}
            changeRate={comparison.bookmarksChange.changeRate}
            current={comparison.bookmarksChange.current}
            previous={comparison.bookmarksChange.previous}
          />
        </div>
      )}

      {/* 亮点书签 */}
      {highlights && highlights.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
            <Sparkles className="size-3.5" />
            <span>本期亮点</span>
            <span className="text-gray-400">({highlights.length})</span>
          </div>
          <div className="space-y-2">
            {highlights.slice(0, 3).map((highlight) => (
              <HighlightCard key={highlight.id} highlight={highlight} />
            ))}
            {highlights.length > 3 && (
              <div className="text-xs text-gray-400 text-center">
                还有 {highlights.length - 3} 条亮点内容...
              </div>
            )}
          </div>
        </div>
      )}

      {/* 洞察 */}
      {insights && insights.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
            <Lightbulb className="size-3.5" />
            <span>洞察</span>
          </div>
          <div className="space-y-2">
            {insights.map((insight, index) => (
              <InsightCard key={index} insight={insight} />
            ))}
          </div>
        </div>
      )}

      {/* 建议 */}
      {suggestions && suggestions.length > 0 && (
        <div className="text-xs text-gray-500 pt-2 border-t border-gray-100 space-y-1">
          {suggestions.slice(0, 2).map((suggestion, index) => (
            <div key={index}>💡 {suggestion}</div>
          ))}
        </div>
      )}
    </div>
  );
});

export default AIPeriodicReportContent;
