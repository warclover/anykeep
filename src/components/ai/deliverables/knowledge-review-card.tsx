/**
 * 知识复习计划卡片组件
 *
 * 用于美观地展示 KnowledgeReviewSkill 的输出结果
 * 包含统计数据、分组列表、摘要和建议
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

"use client";

import { memo, useState } from "react";
import {
  BookOpen,
  Clock,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  BarChart3,
  Lightbulb,
  Calendar,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ============================================
// 类型定义
// ============================================

interface ReviewStats {
  totalBookmarks: number;
  needsReviewCount: number;
  todayCount: number;
  weekCount: number;
  byPriority: {
    high: number;
    medium: number;
    low: number;
  };
  byPlatform: Record<string, number>;
  avgReviewInterval: number;
}

interface ReviewBookmark {
  id: number;
  title: string;
  url: string;
  aiSummary: string | null;
  tags: string[];
  platform: string;
  folderName: string | null;
  createdAt: string;
  daysSinceCreated: number;
  priority: "high" | "medium" | "low";
  reviewReason: string;
  nextInterval: number;
}

interface ReviewGroup {
  name: string;
  description: string;
  items: ReviewBookmark[];
  priority: "high" | "medium" | "low";
  suggestedTime: string;
}

interface KnowledgeReviewOutput {
  stats: ReviewStats;
  groups: ReviewGroup[];
  summary: string;
  suggestions: string[];
  generatedAt: string;
}

interface KnowledgeReviewCardProps {
  data: KnowledgeReviewOutput;
  className?: string;
}

// ============================================
// 类型守卫
// ============================================

export function isKnowledgeReviewOutput(
  content: unknown,
): content is KnowledgeReviewOutput {
  if (typeof content !== "object" || content === null) {
    return false;
  }
  const obj = content as Record<string, unknown>;
  return (
    typeof obj.stats === "object" &&
    obj.stats !== null &&
    Array.isArray(obj.groups) &&
    typeof obj.summary === "string" &&
    Array.isArray(obj.suggestions) &&
    typeof obj.generatedAt === "string"
  );
}

// ============================================
// 子组件
// ============================================

/**
 * 统计概览卡片
 */
const StatsOverview = memo(function StatsOverview({
  stats,
}: {
  stats: ReviewStats;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <StatCard
        icon={<BookOpen className="size-4" />}
        label="总收藏"
        value={stats.totalBookmarks}
        color="blue"
      />
      <StatCard
        icon={<Target className="size-4" />}
        label="需复习"
        value={stats.needsReviewCount}
        color="purple"
      />
      <StatCard
        icon={<Clock className="size-4" />}
        label="今日紧急"
        value={stats.todayCount}
        color="red"
        highlight={stats.todayCount > 0}
      />
      <StatCard
        icon={<Calendar className="size-4" />}
        label="本周计划"
        value={stats.weekCount}
        color="amber"
      />
    </div>
  );
});

/**
 * 单个统计卡片
 */
const StatCard = memo(function StatCard({
  icon,
  label,
  value,
  color,
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: "blue" | "purple" | "red" | "amber";
  highlight?: boolean;
}) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
    red: "bg-red-50 text-red-600 border-red-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-3 rounded-lg border transition-all",
        colorClasses[color],
        highlight && "ring-2 ring-red-200 animate-pulse",
      )}
    >
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-xs font-medium opacity-80">{label}</span>
      </div>
      <span className="text-2xl font-bold">{value}</span>
    </div>
  );
});

/**
 * 优先级分布条
 */
const PriorityDistribution = memo(function PriorityDistribution({
  stats,
}: {
  stats: ReviewStats;
}) {
  const total =
    stats.byPriority.high + stats.byPriority.medium + stats.byPriority.low;
  if (total === 0) return null;

  const highPercent = (stats.byPriority.high / total) * 100;
  const mediumPercent = (stats.byPriority.medium / total) * 100;
  const lowPercent = (stats.byPriority.low / total) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>优先级分布</span>
        <span>共 {total} 项</span>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
        {stats.byPriority.high > 0 && (
          <div
            className="bg-red-400 transition-all"
            style={{ width: `${highPercent}%` }}
            title={`紧急: ${stats.byPriority.high}`}
          />
        )}
        {stats.byPriority.medium > 0 && (
          <div
            className="bg-amber-400 transition-all"
            style={{ width: `${mediumPercent}%` }}
            title={`本周: ${stats.byPriority.medium}`}
          />
        )}
        {stats.byPriority.low > 0 && (
          <div
            className="bg-green-400 transition-all"
            style={{ width: `${lowPercent}%` }}
            title={`巩固: ${stats.byPriority.low}`}
          />
        )}
      </div>
      <div className="flex items-center justify-center gap-4 text-xs">
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-red-400" />
          紧急 {stats.byPriority.high}
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-amber-400" />
          本周 {stats.byPriority.medium}
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-green-400" />
          巩固 {stats.byPriority.low}
        </span>
      </div>
    </div>
  );
});

/**
 * 复习分组
 */
const ReviewGroupCard = memo(function ReviewGroupCard({
  group,
  defaultExpanded = false,
}: {
  group: ReviewGroup;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const priorityStyles = {
    high: {
      bg: "bg-red-50",
      border: "border-red-200",
      badge: "bg-red-100 text-red-700",
      icon: "🔴",
    },
    medium: {
      bg: "bg-amber-50",
      border: "border-amber-200",
      badge: "bg-amber-100 text-amber-700",
      icon: "🟡",
    },
    low: {
      bg: "bg-green-50",
      border: "border-green-200",
      badge: "bg-green-100 text-green-700",
      icon: "🟢",
    },
  };

  const style = priorityStyles[group.priority];

  return (
    <div className={cn("rounded-lg border", style.border, style.bg)}>
      <button
        className="w-full flex items-center justify-between p-3 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{style.icon}</span>
          <div>
            <h4 className="font-medium text-gray-800">{group.name}</h4>
            <p className="text-xs text-gray-500">
              {group.items.length} 条 · {group.suggestedTime}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronDown className="size-5 text-gray-400" />
        ) : (
          <ChevronRight className="size-5 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          <p className="text-xs text-gray-600 pl-7">{group.description}</p>

          <div className="space-y-2 mt-3">
            {group.items.slice(0, 10).map((item) => (
              <ReviewItemCard key={item.id} item={item} />
            ))}

            {group.items.length > 10 && (
              <p className="text-xs text-gray-400 text-center py-2">
                还有 {group.items.length - 10} 条...
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

/**
 * 单个复习项
 */
const ReviewItemCard = memo(function ReviewItemCard({
  item,
}: {
  item: ReviewBookmark;
}) {
  return (
    <div className="flex items-start gap-2 p-2 rounded-md bg-white/60 border border-white/80">
      <div className="flex-1 min-w-0">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-gray-800 hover:text-purple-600 transition-colors line-clamp-1 flex items-center gap-1"
        >
          {item.title}
          <ExternalLink className="size-3 flex-shrink-0 opacity-50" />
        </a>
        <p className="text-xs text-gray-500 mt-0.5">{item.reviewReason}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-gray-400">{item.platform}</span>
          <span className="text-xs text-gray-400">·</span>
          <span className="text-xs text-gray-400">
            {item.daysSinceCreated} 天前
          </span>
        </div>
      </div>
    </div>
  );
});

/**
 * 建议列表
 */
const SuggestionsList = memo(function SuggestionsList({
  suggestions,
}: {
  suggestions: string[];
}) {
  if (suggestions.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <Lightbulb className="size-4 text-amber-500" />
        <span>复习建议</span>
      </div>
      <ul className="space-y-1.5 pl-6">
        {suggestions.map((suggestion, index) => (
          <li
            key={index}
            className="text-sm text-gray-600 list-disc marker:text-amber-400"
          >
            {suggestion}
          </li>
        ))}
      </ul>
    </div>
  );
});

/**
 * 平台分布
 */
const PlatformDistribution = memo(function PlatformDistribution({
  byPlatform,
}: {
  byPlatform: Record<string, number>;
}) {
  const platforms = Object.entries(byPlatform).sort(([, a], [, b]) => b - a);
  if (platforms.length === 0) return null;

  const maxValue = Math.max(...platforms.map(([, count]) => count));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <BarChart3 className="size-4 text-purple-500" />
        <span>平台分布</span>
      </div>
      <div className="space-y-1.5">
        {platforms.slice(0, 5).map(([platform, count]) => (
          <div key={platform} className="flex items-center gap-2">
            <span className="w-16 text-xs text-gray-500 truncate">
              {platform}
            </span>
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-400 to-indigo-400 rounded-full"
                style={{ width: `${(count / maxValue) * 100}%` }}
              />
            </div>
            <span className="w-8 text-xs text-gray-500 text-right">
              {count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});

// ============================================
// 主组件
// ============================================

/**
 * 知识复习计划卡片
 */
export const KnowledgeReviewCard = memo(function KnowledgeReviewCard({
  data,
  className,
}: KnowledgeReviewCardProps) {
  const [showDetails, setShowDetails] = useState(true);

  return (
    <div className={cn("space-y-4", className)}>
      {/* 统计概览 */}
      <StatsOverview stats={data.stats} />

      {/* 优先级分布 */}
      <PriorityDistribution stats={data.stats} />

      {/* 摘要 */}
      <div className="p-3 rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100">
        <div className="prose prose-sm prose-purple max-w-none">
          <div className="text-sm text-gray-700 whitespace-pre-line">
            {data.summary}
          </div>
        </div>
      </div>

      {/* 复习分组 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-700">复习计划</h4>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? "收起详情" : "展开详情"}
          </Button>
        </div>

        {showDetails && (
          <div className="space-y-2">
            {data.groups.map((group, index) => (
              <ReviewGroupCard
                key={group.name}
                group={group}
                defaultExpanded={index === 0}
              />
            ))}
          </div>
        )}
      </div>

      {/* 平台分布 */}
      <PlatformDistribution byPlatform={data.stats.byPlatform} />

      {/* 建议列表 */}
      <SuggestionsList suggestions={data.suggestions} />

      {/* 生成时间 */}
      <div className="text-xs text-gray-400 text-right">
        生成于 {new Date(data.generatedAt).toLocaleString("zh-CN")}
      </div>
    </div>
  );
});
