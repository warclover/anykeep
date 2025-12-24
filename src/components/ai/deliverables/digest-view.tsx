/**
 * DigestView - 快速摘要视图组件
 *
 * 用于显示 QuickDigestSkill 生成的摘要内容，
 * 支持多种格式展示和主题分组浏览。
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

"use client";

import { memo, useState, useMemo } from "react";
import {
  FileText,
  Tag,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Lightbulb,
  TrendingUp,
  AlertCircle,
  Copy,
  Check,
  Calendar,
  Globe,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type {
  QuickDigestOutput,
  TopicGroup,
  TopicBookmark,
  DigestInsight,
  DigestStats,
  InsightType,
  DigestOutputFormat,
} from "@/lib/ai-skills/skills/quick-digest/types";

// ============================================
// 类型定义
// ============================================

interface DigestViewProps {
  /** 摘要数据 */
  data: QuickDigestOutput;
  /** 打开书签详情回调 */
  onOpenBookmark?: (bookmarkId: number, url: string) => void;
  /** 复制内容回调 */
  onCopyContent?: (content: string) => void;
  /** 自定义类名 */
  className?: string;
}

interface TopicGroupCardProps {
  /** 主题分组数据 */
  group: TopicGroup;
  /** 打开书签详情回调 */
  onOpenBookmark?: (bookmarkId: number, url: string) => void;
  /** 是否默认展开 */
  defaultExpanded?: boolean;
}

// ============================================
// 常量配置
// ============================================

const FORMAT_LABELS: Record<DigestOutputFormat, string> = {
  markdown: "Markdown",
  mindmap: "思维导图",
  cards: "卡片",
  outline: "大纲",
};

const INSIGHT_TYPE_CONFIG: Record<
  InsightType,
  { label: string; color: string; bgColor: string; icon: typeof TrendingUp }
> = {
  trend: {
    label: "趋势",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    icon: TrendingUp,
  },
  gap: {
    label: "空白",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    icon: AlertCircle,
  },
  recommendation: {
    label: "推荐",
    color: "text-green-600",
    bgColor: "bg-green-50",
    icon: Lightbulb,
  },
};

// ============================================
// 辅助函数
// ============================================

/**
 * 格式化日期
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}

/**
 * 格式化日期范围
 */
function formatDateRange(start: string, end: string): string {
  const startDate = formatDate(start);
  const endDate = formatDate(end);
  if (startDate === endDate) {
    return startDate;
  }
  return `${startDate} ~ ${endDate}`;
}

// ============================================
// 子组件
// ============================================

/**
 * 摘要统计卡片
 */
const DigestStatsCard = memo(function DigestStatsCard({
  stats,
}: {
  stats: DigestStats;
}) {
  const platformEntries = Object.entries(stats.platformDistribution);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
      <div className="text-center">
        <div className="text-2xl font-bold text-emerald-600">
          {stats.totalProcessed}
        </div>
        <div className="text-xs text-gray-500">处理总数</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-teal-500">
          {stats.topicsIdentified}
        </div>
        <div className="text-xs text-gray-500">识别主题</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-blue-500">
          {platformEntries.length}
        </div>
        <div className="text-xs text-gray-500">来源平台</div>
      </div>
      <div className="text-center">
        <div className="text-lg font-medium text-gray-600 leading-tight">
          {formatDateRange(stats.dateRange.start, stats.dateRange.end)}
        </div>
        <div className="text-xs text-gray-500">时间范围</div>
      </div>
    </div>
  );
});

/**
 * 平台分布条
 */
const PlatformDistribution = memo(function PlatformDistribution({
  distribution,
}: {
  distribution: Record<string, number>;
}) {
  const entries = Object.entries(distribution).sort(([, a], [, b]) => b - a);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);

  if (total === 0) return null;

  const colors = [
    "bg-emerald-400",
    "bg-teal-400",
    "bg-blue-400",
    "bg-purple-400",
    "bg-pink-400",
    "bg-orange-400",
    "bg-yellow-400",
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>平台分布</span>
        <span>{total} 条</span>
      </div>
      <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100">
        {entries.map(([platform, count], index) => {
          const percent = (count / total) * 100;
          return (
            <div
              key={platform}
              className={cn(colors[index % colors.length], "transition-all")}
              style={{ width: `${percent}%` }}
              title={`${platform}: ${count}`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {entries.slice(0, 5).map(([platform, count], index) => (
          <span key={platform} className="flex items-center gap-1">
            <span
              className={cn(
                "size-2 rounded-full",
                colors[index % colors.length],
              )}
            />
            <span className="text-gray-500">
              {platform} ({count})
            </span>
          </span>
        ))}
        {entries.length > 5 && (
          <span className="text-gray-400">+{entries.length - 5} 更多</span>
        )}
      </div>
    </div>
  );
});

/**
 * 单个书签条目
 */
const BookmarkItem = memo(function BookmarkItem({
  bookmark,
  onOpenBookmark,
}: {
  bookmark: TopicBookmark;
  onOpenBookmark?: (bookmarkId: number, url: string) => void;
}) {
  return (
    <div className="group flex items-start gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors">
      <div className="flex-shrink-0 size-8 rounded-lg bg-gray-100 flex items-center justify-center">
        <Globe className="size-4 text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h5 className="font-medium text-gray-700 text-sm line-clamp-1">
            {bookmark.title}
          </h5>
          {bookmark.platform && (
            <Badge variant="outline" className="flex-shrink-0 text-[10px]">
              {bookmark.platform}
            </Badge>
          )}
        </div>
        {bookmark.summary && (
          <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">
            {bookmark.summary}
          </p>
        )}
        <div className="mt-1 flex items-center gap-2 text-[10px] text-gray-400">
          <span className="flex items-center gap-0.5">
            <Calendar className="size-3" />
            {formatDate(bookmark.createdAt)}
          </span>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => onOpenBookmark?.(bookmark.id, bookmark.url)}
      >
        <ExternalLink className="size-3.5" />
      </Button>
    </div>
  );
});

/**
 * 主题分组卡片
 */
const TopicGroupCard = memo(function TopicGroupCard({
  group,
  onOpenBookmark,
  defaultExpanded = false,
}: TopicGroupCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* 分组头部 */}
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold">
            {group.name.charAt(0)}
          </div>
          <div>
            <h4 className="font-medium text-gray-800">{group.name}</h4>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{group.count} 篇</span>
              {group.keywords.length > 0 && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Tag className="size-3" />
                    {group.keywords.slice(0, 3).join(", ")}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronUp className="size-5 text-gray-400" />
          ) : (
            <ChevronDown className="size-5 text-gray-400" />
          )}
        </div>
      </div>

      {/* 分组内容 */}
      {isExpanded && (
        <div className="border-t border-gray-100">
          {/* 主题摘要 */}
          {group.summary && (
            <div className="p-3 bg-gray-50 border-b border-gray-100">
              <p className="text-sm text-gray-600">{group.summary}</p>
            </div>
          )}

          {/* 书签列表 */}
          <div className="p-2 space-y-1 max-h-80 overflow-y-auto">
            {group.bookmarks.map((bookmark) => (
              <BookmarkItem
                key={bookmark.id}
                bookmark={bookmark}
                onOpenBookmark={onOpenBookmark}
              />
            ))}
          </div>
        </div>
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
  insight: DigestInsight;
}) {
  const config = INSIGHT_TYPE_CONFIG[insight.type];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border",
        config.bgColor,
        `border-${insight.type === "trend" ? "blue" : insight.type === "gap" ? "amber" : "green"}-200`,
      )}
    >
      <div
        className={cn(
          "flex-shrink-0 size-8 rounded-lg flex items-center justify-center bg-white/80",
        )}
      >
        <Icon className={cn("size-4", config.color)} />
      </div>
      <div className="flex-1">
        <Badge variant="outline" className={cn("text-[10px]", config.color)}>
          {config.label}
        </Badge>
        <p className="mt-1 text-sm text-gray-700">{insight.content}</p>
      </div>
    </div>
  );
});

/**
 * 摘要内容卡片
 */
const DigestContentCard = memo(function DigestContentCard({
  title,
  content,
  format,
  generatedAt,
  onCopy,
}: {
  title: string;
  content: string;
  format: DigestOutputFormat;
  generatedAt: string;
  onCopy?: (content: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const handleCopy = () => {
    onCopy?.(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 预览内容（截取前500字符）
  const previewContent = useMemo(() => {
    if (content.length <= 500) return content;
    return content.slice(0, 500) + "...";
  }, [content]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-emerald-500" />
          <span className="font-medium text-gray-700">{title}</span>
          <Badge variant="secondary" className="text-[10px]">
            {FORMAT_LABELS[format]}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            {formatDate(generatedAt)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="size-3.5 text-green-500" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronUp className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
          </Button>
        </div>
      </div>

      {/* 内容 */}
      {isExpanded && (
        <div className="p-4">
          <pre className="whitespace-pre-wrap text-sm text-gray-600 font-sans leading-relaxed max-h-96 overflow-y-auto">
            {isExpanded && content.length > 500 ? content : previewContent}
          </pre>
        </div>
      )}
    </div>
  );
});

// ============================================
// 主组件
// ============================================

/**
 * 快速摘要视图组件
 */
export const DigestView = memo(function DigestView({
  data,
  onOpenBookmark,
  onCopyContent,
  className,
}: DigestViewProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-emerald-100 bg-white shadow-sm overflow-hidden",
        className,
      )}
    >
      {/* 头部 */}
      <div className="px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5" />
          <h2 className="font-semibold">内容摘要</h2>
        </div>
        <p className="mt-1 text-sm text-emerald-100">
          {data.digest.title} · 共 {data.stats.totalProcessed} 篇内容
        </p>
      </div>

      {/* 统计信息 */}
      <div className="p-4 border-b border-gray-100">
        <DigestStatsCard stats={data.stats} />
      </div>

      {/* 平台分布 */}
      <div className="px-4 py-3 border-b border-gray-100">
        <PlatformDistribution distribution={data.stats.platformDistribution} />
      </div>

      {/* 摘要内容 */}
      <div className="p-4 border-b border-gray-100">
        <DigestContentCard
          title={data.digest.title}
          content={data.digest.content}
          format={data.digest.format}
          generatedAt={data.digest.generatedAt}
          onCopy={onCopyContent}
        />
      </div>

      {/* 主题分组 */}
      {data.topics.length > 0 && (
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
            <BarChart3 className="size-4 text-emerald-500" />
            主题分组 ({data.topics.length})
          </h3>
          <div className="space-y-3">
            {data.topics.map((topic, index) => (
              <TopicGroupCard
                key={topic.name}
                group={topic}
                onOpenBookmark={onOpenBookmark}
                defaultExpanded={index === 0}
              />
            ))}
          </div>
        </div>
      )}

      {/* 洞察 */}
      {data.insights && data.insights.length > 0 && (
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
            <Lightbulb className="size-4 text-amber-500" />
            洞察 ({data.insights.length})
          </h3>
          <div className="space-y-2">
            {data.insights.map((insight, index) => (
              <InsightCard key={index} insight={insight} />
            ))}
          </div>
        </div>
      )}

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

      {/* 页脚 */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-center">
        <span className="text-xs text-gray-400">
          生成于 {formatDate(data.generatedAt)}
        </span>
      </div>
    </div>
  );
});

export default DigestView;
