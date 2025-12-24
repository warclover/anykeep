/**
 * ReviewCard - 知识复习卡片组件
 *
 * 用于显示 KnowledgeReviewSkill 生成的复习内容，
 * 支持艾宾浩斯记忆曲线展示和复习状态管理。
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

"use client";

import { memo, useState } from "react";
import {
  BookOpen,
  Clock,
  Folder,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Star,
  Calendar,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type {
  KnowledgeReviewOutput,
  ReviewBookmark,
  ReviewGroup,
  ReviewPriority,
} from "@/lib/ai-skills/skills/knowledge-review";

// ============================================
// 类型定义
// ============================================

interface ReviewCardProps {
  /** 复习数据 */
  data: KnowledgeReviewOutput;
  /** 标记复习完成回调 */
  onMarkReviewed?: (bookmarkId: number) => void;
  /** 打开书签详情回调 */
  onOpenBookmark?: (bookmarkId: number, url: string) => void;
  /** 自定义类名 */
  className?: string;
}

interface ReviewBookmarkCardProps {
  /** 书签数据 */
  bookmark: ReviewBookmark;
  /** 标记复习完成回调 */
  onMarkReviewed?: (bookmarkId: number) => void;
  /** 打开书签详情回调 */
  onOpenBookmark?: (bookmarkId: number, url: string) => void;
  /** 是否显示简洁模式 */
  compact?: boolean;
}

// ============================================
// 辅助函数
// ============================================

/**
 * 获取优先级配置
 */
function getPriorityConfig(priority: ReviewPriority) {
  const configs = {
    high: {
      label: "高",
      color: "text-red-600",
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
      icon: AlertCircle,
    },
    medium: {
      label: "中",
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
      icon: Clock,
    },
    low: {
      label: "低",
      color: "text-green-600",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
      icon: CheckCircle2,
    },
  };
  return configs[priority];
}

/**
 * 格式化天数
 */
function formatDays(days: number): string {
  if (days === 0) return "今天";
  if (days === 1) return "1 天前";
  if (days < 7) return `${days} 天前`;
  if (days < 30) return `${Math.floor(days / 7)} 周前`;
  if (days < 365) return `${Math.floor(days / 30)} 个月前`;
  return `${Math.floor(days / 365)} 年前`;
}

// ============================================
// 子组件
// ============================================

/**
 * 复习统计卡片
 */
const ReviewStats = memo(function ReviewStats({
  stats,
}: {
  stats: KnowledgeReviewOutput["stats"];
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-100">
      <div className="text-center">
        <div className="text-2xl font-bold text-purple-600">
          {stats.needsReviewCount}
        </div>
        <div className="text-xs text-gray-500">待复习</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-orange-500">
          {stats.todayCount}
        </div>
        <div className="text-xs text-gray-500">今日推荐</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-blue-500">
          {stats.weekCount}
        </div>
        <div className="text-xs text-gray-500">本周计划</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-gray-600">
          {stats.avgReviewInterval.toFixed(0)}天
        </div>
        <div className="text-xs text-gray-500">平均间隔</div>
      </div>
    </div>
  );
});

/**
 * 优先级分布条
 */
const PriorityDistribution = memo(function PriorityDistribution({
  distribution,
}: {
  distribution: { high: number; medium: number; low: number };
}) {
  const total = distribution.high + distribution.medium + distribution.low;
  if (total === 0) return null;

  const highPercent = (distribution.high / total) * 100;
  const mediumPercent = (distribution.medium / total) * 100;
  const lowPercent = (distribution.low / total) * 100;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>优先级分布</span>
        <span>{total} 项</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-gray-100">
        {highPercent > 0 && (
          <div
            className="bg-red-400 transition-all"
            style={{ width: `${highPercent}%` }}
            title={`高优先级: ${distribution.high}`}
          />
        )}
        {mediumPercent > 0 && (
          <div
            className="bg-amber-400 transition-all"
            style={{ width: `${mediumPercent}%` }}
            title={`中优先级: ${distribution.medium}`}
          />
        )}
        {lowPercent > 0 && (
          <div
            className="bg-green-400 transition-all"
            style={{ width: `${lowPercent}%` }}
            title={`低优先级: ${distribution.low}`}
          />
        )}
      </div>
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Circle className="size-2 fill-red-400 text-red-400" />
            <span className="text-gray-500">高 {distribution.high}</span>
          </span>
          <span className="flex items-center gap-1">
            <Circle className="size-2 fill-amber-400 text-amber-400" />
            <span className="text-gray-500">中 {distribution.medium}</span>
          </span>
          <span className="flex items-center gap-1">
            <Circle className="size-2 fill-green-400 text-green-400" />
            <span className="text-gray-500">低 {distribution.low}</span>
          </span>
        </div>
      </div>
    </div>
  );
});

/**
 * 单个复习书签卡片
 */
const ReviewBookmarkCard = memo(function ReviewBookmarkCard({
  bookmark,
  onMarkReviewed,
  onOpenBookmark,
  compact = false,
}: ReviewBookmarkCardProps) {
  const priorityConfig = getPriorityConfig(bookmark.priority);
  const PriorityIcon = priorityConfig.icon;

  return (
    <div
      className={cn(
        "group rounded-lg border bg-white p-3 transition-all hover:shadow-md",
        priorityConfig.borderColor,
      )}
    >
      <div className="flex items-start gap-3">
        {/* 优先级指示 */}
        <div
          className={cn(
            "flex-shrink-0 size-8 rounded-lg flex items-center justify-center",
            priorityConfig.bgColor,
          )}
        >
          <PriorityIcon className={cn("size-4", priorityConfig.color)} />
        </div>

        {/* 主要内容 */}
        <div className="flex-1 min-w-0">
          {/* 标题行 */}
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-medium text-gray-800 line-clamp-1">
              {bookmark.title}
            </h4>
            <Badge variant="outline" className="flex-shrink-0 text-xs">
              {bookmark.platform}
            </Badge>
          </div>

          {/* 摘要 */}
          {!compact && bookmark.aiSummary && (
            <p className="mt-1 text-sm text-gray-500 line-clamp-2">
              {bookmark.aiSummary}
            </p>
          )}

          {/* 元信息 */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Calendar className="size-3" />
              {formatDays(bookmark.daysSinceCreated)}
            </span>
            {bookmark.folderName && (
              <span className="flex items-center gap-1">
                <Folder className="size-3" />
                {bookmark.folderName}
              </span>
            )}
            <span className="flex items-center gap-1">
              <TrendingUp className="size-3" />
              下次间隔: {bookmark.nextInterval}天
            </span>
          </div>

          {/* 标签 */}
          {!compact && bookmark.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {bookmark.tags.slice(0, 4).map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-xs px-1.5 py-0"
                >
                  {tag}
                </Badge>
              ))}
              {bookmark.tags.length > 4 && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0">
                  +{bookmark.tags.length - 4}
                </Badge>
              )}
            </div>
          )}

          {/* 复习原因 */}
          {!compact && (
            <div className="mt-2 text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded">
              💡 {bookmark.reviewReason}
            </div>
          )}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="mt-3 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => onOpenBookmark?.(bookmark.id, bookmark.url)}
        >
          <ExternalLink className="size-3 mr-1" />
          查看
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs text-green-600 border-green-200 hover:bg-green-50"
          onClick={() => onMarkReviewed?.(bookmark.id)}
        >
          <CheckCircle2 className="size-3 mr-1" />
          已复习
        </Button>
      </div>
    </div>
  );
});

/**
 * 复习分组
 */
const ReviewGroupSection = memo(function ReviewGroupSection({
  group,
  onMarkReviewed,
  onOpenBookmark,
  defaultExpanded = true,
}: {
  group: ReviewGroup;
  onMarkReviewed?: (bookmarkId: number) => void;
  onOpenBookmark?: (bookmarkId: number, url: string) => void;
  defaultExpanded?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const priorityConfig = getPriorityConfig(group.priority);

  return (
    <div className="space-y-3">
      {/* 分组头部 */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "size-6 rounded flex items-center justify-center",
              priorityConfig.bgColor,
            )}
          >
            <Star className={cn("size-3", priorityConfig.color)} />
          </div>
          <div>
            <h3 className="font-medium text-gray-800">{group.name}</h3>
            <p className="text-xs text-gray-500">{group.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {group.items.length} 项
          </Badge>
          <span className="text-xs text-gray-400">{group.suggestedTime}</span>
          {isExpanded ? (
            <ChevronUp className="size-4 text-gray-400" />
          ) : (
            <ChevronDown className="size-4 text-gray-400" />
          )}
        </div>
      </div>

      {/* 分组内容 */}
      {isExpanded && (
        <div className="space-y-2 pl-8">
          {group.items.map((bookmark) => (
            <ReviewBookmarkCard
              key={bookmark.id}
              bookmark={bookmark}
              onMarkReviewed={onMarkReviewed}
              onOpenBookmark={onOpenBookmark}
              compact={group.items.length > 5}
            />
          ))}
        </div>
      )}
    </div>
  );
});

// ============================================
// 主组件
// ============================================

/**
 * 知识复习卡片组件
 */
export const ReviewCard = memo(function ReviewCard({
  data,
  onMarkReviewed,
  onOpenBookmark,
  className,
}: ReviewCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-purple-100 bg-white shadow-sm overflow-hidden",
        className,
      )}
    >
      {/* 头部 */}
      <div className="px-4 py-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white">
        <div className="flex items-center gap-2">
          <BookOpen className="size-5" />
          <h2 className="font-semibold">知识复习计划</h2>
        </div>
        <p className="mt-1 text-sm text-purple-100">{data.summary}</p>
      </div>

      {/* 统计信息 */}
      <div className="p-4 border-b border-gray-100">
        <ReviewStats stats={data.stats} />
      </div>

      {/* 优先级分布 */}
      <div className="px-4 py-3 border-b border-gray-100">
        <PriorityDistribution distribution={data.stats.byPriority} />
      </div>

      {/* 复习分组 */}
      <div className="p-4 space-y-6">
        {data.groups.map((group, index) => (
          <ReviewGroupSection
            key={group.name}
            group={group}
            onMarkReviewed={onMarkReviewed}
            onOpenBookmark={onOpenBookmark}
            defaultExpanded={index === 0}
          />
        ))}
      </div>

      {/* 建议 */}
      {data.suggestions.length > 0 && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
          <h4 className="text-sm font-medium text-gray-700 mb-2">💡 建议</h4>
          <ul className="space-y-1">
            {data.suggestions.map((suggestion, index) => (
              <li key={index} className="text-sm text-gray-600">
                • {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
});

export default ReviewCard;
