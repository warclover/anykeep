/**
 * AI 报告内容渲染组件
 *
 * 专门用于渲染 insight_report Skill 生成的趋势分析报告
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
  Calendar,
  BarChart3,
  Tag,
  Folder,
  Globe,
  Lightbulb,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// 类型定义
// ============================================

interface PlatformDistribution {
  name: string;
  count: number;
  percentage: number;
}

interface FolderDistribution {
  name: string;
  count: number;
  percentage: number;
}

interface TagItem {
  name: string;
  count: number;
  rank: number;
}

interface ActivityData {
  totalBookmarks: number;
  newBookmarks: number;
  dailyAverage: number;
  mostActiveDay: string;
  mostActiveHour?: number;
  activeDays: number;
}

interface TrendItem {
  label: string;
  value: number;
  changeRate: number;
}

interface TrendsData {
  bookmarkTrend: TrendItem[];
  platformTrend: Record<string, unknown>;
  tagTrend: {
    rising: unknown[];
    declining: unknown[];
  };
  summary: string;
}

interface InsightItem {
  type: string;
  title: string;
  description: string;
  priority: string;
}

interface ReportData {
  title: string;
  reportType: string;
  timeRangeDescription: string;
  activity: ActivityData;
  content: {
    byPlatform: PlatformDistribution[];
    byFolder: FolderDistribution[];
    topTags: TagItem[];
    topAiTags: TagItem[];
    summaryRate?: number;
    ratedRate?: number;
    averageRating?: number;
  };
  trends: TrendsData;
  insights: InsightItem[];
  summary: string;
  suggestions: string[];
  generatedAt: string;
}

interface AIReportContentProps {
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
 * 分布条形图
 */
const DistributionBar = memo(function DistributionBar({
  items,
  maxItems = 5,
  colorClass = "bg-purple-500",
}: {
  items: { name: string; count: number; percentage: number }[];
  maxItems?: number;
  colorClass?: string;
}) {
  const displayItems = items.slice(0, maxItems);

  return (
    <div className="space-y-2">
      {displayItems.map((item, index) => (
        <div key={item.name} className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-gray-700 truncate flex-1 mr-2">
              {item.name}
            </span>
            <span className="text-gray-500 flex-shrink-0">
              {item.count} ({item.percentage.toFixed(1)}%)
            </span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", colorClass)}
              style={{
                width: `${Math.min(item.percentage, 100)}%`,
                opacity: 1 - index * 0.15,
              }}
            />
          </div>
        </div>
      ))}
      {items.length > maxItems && (
        <div className="text-xs text-gray-400 text-center pt-1">
          还有 {items.length - maxItems} 项...
        </div>
      )}
    </div>
  );
});

/**
 * 标签云
 */
const TagCloud = memo(function TagCloud({
  tags,
  maxTags = 6,
}: {
  tags: TagItem[];
  maxTags?: number;
}) {
  const displayTags = tags.slice(0, maxTags);

  return (
    <div className="flex flex-wrap gap-1.5">
      {displayTags.map((tag) => (
        <span
          key={tag.name}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700"
        >
          <span className="truncate max-w-[120px]">{tag.name}</span>
          <span className="text-purple-400">{tag.count}</span>
        </span>
      ))}
      {tags.length > maxTags && (
        <span className="text-xs text-gray-400 px-2 py-0.5">
          +{tags.length - maxTags}
        </span>
      )}
    </div>
  );
});

/**
 * 洞察卡片
 */
const InsightCard = memo(function InsightCard({
  insight,
}: {
  insight: InsightItem;
}) {
  const priorityColor =
    insight.priority === "high"
      ? "border-amber-200 bg-amber-50"
      : "border-gray-200 bg-gray-50";

  return (
    <div className={cn("p-3 rounded-lg border", priorityColor)}>
      <div className="flex items-start gap-2">
        <Sparkles className="size-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-medium text-gray-800">
            {insight.title}
          </div>
          <div className="text-xs text-gray-600 mt-0.5">
            {insight.description}
          </div>
        </div>
      </div>
    </div>
  );
});

// ============================================
// 主组件
// ============================================

/**
 * 类型守卫：检查是否为报告数据
 */
function isReportData(content: unknown): content is ReportData {
  if (typeof content !== "object" || content === null) {
    return false;
  }
  const obj = content as Record<string, unknown>;
  return (
    typeof obj.title === "string" &&
    typeof obj.reportType === "string" &&
    typeof obj.activity === "object" &&
    typeof obj.content === "object"
  );
}

/**
 * AI 报告内容渲染组件
 */
export const AIReportContent = memo(function AIReportContent({
  content,
  className,
}: AIReportContentProps) {
  // 验证数据格式
  if (!isReportData(content)) {
    return <div className="text-sm text-gray-500 italic">无法解析报告数据</div>;
  }

  const {
    activity,
    content: reportContent,
    trends,
    insights,
    suggestions,
  } = content;

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
      {/* 活跃度概览 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <StatCard
          icon={BarChart3}
          label="总收藏"
          value={activity.totalBookmarks.toLocaleString()}
          colorClass="text-purple-600 bg-purple-100"
        />
        <StatCard
          icon={TrendingUp}
          label="日均收藏"
          value={activity.dailyAverage.toFixed(1)}
          subValue="条/天"
          colorClass="text-blue-600 bg-blue-100"
        />
        <StatCard
          icon={Calendar}
          label="最活跃日"
          value={formatDate(activity.mostActiveDay)}
          subValue={`活跃 ${activity.activeDays} 天`}
          colorClass="text-green-600 bg-green-100"
        />
      </div>

      {/* 平台分布 */}
      {reportContent.byPlatform && reportContent.byPlatform.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
            <Globe className="size-3.5" />
            <span>平台分布</span>
          </div>
          <DistributionBar
            items={reportContent.byPlatform}
            maxItems={4}
            colorClass="bg-gradient-to-r from-purple-500 to-indigo-500"
          />
        </div>
      )}

      {/* 文件夹分布 */}
      {reportContent.byFolder && reportContent.byFolder.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
            <Folder className="size-3.5" />
            <span>文件夹分布</span>
          </div>
          <DistributionBar
            items={reportContent.byFolder}
            maxItems={5}
            colorClass="bg-gradient-to-r from-blue-500 to-cyan-500"
          />
        </div>
      )}

      {/* 热门标签 */}
      {reportContent.topTags && reportContent.topTags.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
            <Tag className="size-3.5" />
            <span>热门标签</span>
          </div>
          <TagCloud tags={reportContent.topTags} maxTags={8} />
        </div>
      )}

      {/* AI 标签 */}
      {reportContent.topAiTags && reportContent.topAiTags.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
            <Sparkles className="size-3.5" />
            <span>AI 智能标签</span>
          </div>
          <TagCloud tags={reportContent.topAiTags} maxTags={10} />
        </div>
      )}

      {/* 趋势摘要 */}
      {trends?.summary && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-gray-50 border border-gray-100">
          {trends.summary.includes("下降") ? (
            <TrendingDown className="size-4 text-orange-500 flex-shrink-0 mt-0.5" />
          ) : (
            <TrendingUp className="size-4 text-green-500 flex-shrink-0 mt-0.5" />
          )}
          <span className="text-sm text-gray-700">{trends.summary}</span>
        </div>
      )}

      {/* 洞察建议 */}
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
        <div className="text-xs text-gray-500 pt-2 border-t border-gray-100">
          💡 {suggestions[0]}
        </div>
      )}
    </div>
  );
});

export default AIReportContent;
