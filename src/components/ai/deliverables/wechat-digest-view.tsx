/**
 * WechatDigestView - 微信阅读摘要视图组件
 *
 * 用于显示 WechatDigestSkill 生成的摘要内容，
 * 支持分组展示、统计概览和阅读洞察。
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

"use client";

import { memo, useState } from "react";
import {
  FileText,
  BookOpen,
  Users,
  TrendingUp,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Calendar,
  Hash,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AIMarkdown } from "../ai-markdown";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { WechatDigestOutput } from "@/lib/ai-skills/skills/wechat-digest/types";

// ============================================
// 类型定义
// ============================================

interface WechatDigestViewProps {
  /** 摘要数据 */
  data: WechatDigestOutput;
  /** 打开文章链接回调 */
  onOpenArticle?: (url: string) => void;
  /** 自定义类名 */
  className?: string;
}

interface GroupCardProps {
  /** 分组数据 */
  group: WechatDigestOutput["data"]["groups"][0];
  /** 打开文章链接回调 */
  onOpenArticle?: (url: string) => void;
  /** 是否默认展开 */
  defaultExpanded?: boolean;
}

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

/**
 * 格式化数字
 */
function formatNumber(num: number): string {
  if (num >= 10000) {
    return `${(num / 10000).toFixed(1)}万`;
  }
  return num.toLocaleString();
}

// ============================================
// 子组件
// ============================================

/**
 * 概览统计卡片
 */
const OverviewCard = memo(function OverviewCard({
  overview,
}: {
  overview: WechatDigestOutput["data"]["overview"];
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-100">
      <div className="text-center">
        <div className="text-2xl font-bold text-green-600">
          {overview.totalArticles}
        </div>
        <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
          <FileText className="size-3" />
          文章数
        </div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-emerald-500">
          {overview.totalAccounts}
        </div>
        <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
          <Users className="size-3" />
          公众号
        </div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-teal-500">
          {formatNumber(overview.totalWordCount)}
        </div>
        <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
          <BookOpen className="size-3" />
          总字数
        </div>
      </div>
      <div className="text-center">
        <div className="text-sm font-medium text-gray-600 leading-tight">
          {formatDateRange(overview.dateRange.start, overview.dateRange.end)}
        </div>
        <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
          <Calendar className="size-3" />
          时间范围
        </div>
      </div>
    </div>
  );
});

/**
 * 热门话题标签
 */
const TopTopics = memo(function TopTopics({ topics }: { topics: string[] }) {
  if (topics.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Hash className="size-4 text-green-500" />
        <span className="font-medium">热门话题</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {topics.map((topic, index) => (
          <Badge
            key={index}
            variant="secondary"
            className="bg-green-50 text-green-700 border-green-200"
          >
            {topic}
          </Badge>
        ))}
      </div>
    </div>
  );
});

/**
 * 单篇文章条目
 */
const ArticleItem = memo(function ArticleItem({
  article,
  onOpenArticle,
}: {
  article: { title: string; url: string; excerpt: string };
  onOpenArticle?: (url: string) => void;
}) {
  return (
    <div className="group flex items-start gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors">
      <div className="flex-shrink-0 size-8 rounded-lg bg-green-100 flex items-center justify-center">
        <FileText className="size-4 text-green-500" />
      </div>
      <div className="flex-1 min-w-0">
        <h5 className="font-medium text-gray-700 text-sm line-clamp-1">
          {article.title}
        </h5>
        {article.excerpt && (
          <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">
            {article.excerpt}
          </p>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => onOpenArticle?.(article.url)}
      >
        <ExternalLink className="size-3.5" />
      </Button>
    </div>
  );
});

/**
 * 分组卡片
 */
const GroupCard = memo(function GroupCard({
  group,
  onOpenArticle,
  defaultExpanded = false,
}: GroupCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* 分组头部 */}
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white font-bold">
            {group.name.charAt(0)}
          </div>
          <div>
            <h4 className="font-medium text-gray-800">{group.name}</h4>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{group.articleCount} 篇</span>
              <span>·</span>
              <span>{formatNumber(group.wordCount)} 字</span>
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
          {/* 摘要 */}
          <div className="p-3 bg-gray-50 border-b border-gray-100">
            <AIMarkdown
              content={group.summary}
              className="text-sm text-gray-600"
            />
          </div>

          {/* 要点列表 */}
          {group.keyPoints.length > 0 && (
            <div className="p-3 border-b border-gray-100">
              <h5 className="text-xs font-medium text-gray-500 mb-2">
                核心要点
              </h5>
              <ul className="space-y-1">
                {group.keyPoints.map((point, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-sm text-gray-600"
                  >
                    <span className="flex-shrink-0 size-4 flex items-center justify-center rounded-full bg-green-100 text-green-600 text-xs font-medium">
                      {index + 1}
                    </span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 文章列表 */}
          <div className="p-2 space-y-1 max-h-60 overflow-y-auto">
            {group.articles.map((article, index) => (
              <ArticleItem
                key={index}
                article={article}
                onOpenArticle={onOpenArticle}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

/**
 * 洞察建议卡片
 */
const InsightsCard = memo(function InsightsCard({
  insights,
}: {
  insights: WechatDigestOutput["data"]["insights"];
}) {
  return (
    <div className="space-y-4">
      {/* 阅读趋势 */}
      <div className="rounded-lg bg-blue-50 border border-blue-100 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-blue-700 mb-2">
          <TrendingUp className="size-4" />
          阅读趋势
        </div>
        <AIMarkdown
          content={insights.readingTrends}
          className="text-sm text-gray-600"
        />
      </div>

      {/* 推荐阅读 */}
      {insights.topRecommendations.length > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-100 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-700 mb-2">
            <Lightbulb className="size-4" />
            推荐阅读
          </div>
          <ul className="space-y-1">
            {insights.topRecommendations.map((rec, index) => (
              <li key={index} className="text-sm text-gray-600">
                • {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 建议 */}
      {insights.suggestions.length > 0 && (
        <div className="rounded-lg bg-green-50 border border-green-100 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-green-700 mb-2">
            <Sparkles className="size-4" />
            优化建议
          </div>
          <ul className="space-y-1">
            {insights.suggestions.map((suggestion, index) => (
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

// ============================================
// 主组件
// ============================================

/**
 * 微信阅读摘要视图组件
 */
export const WechatDigestView = memo(function WechatDigestView({
  data,
  onOpenArticle,
  className,
}: WechatDigestViewProps) {
  const handleOpenArticle = (url: string) => {
    if (onOpenArticle) {
      onOpenArticle(url);
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-green-100 bg-white shadow-sm overflow-hidden",
        className,
      )}
    >
      {/* 头部 */}
      <div className="px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white">
        <div className="flex items-center gap-2">
          <BookOpen className="size-5" />
          <h2 className="font-semibold">微信阅读摘要</h2>
        </div>
        <p className="mt-1 text-sm text-green-100">
          共 {data.data.overview.totalArticles} 篇文章 ·{" "}
          {data.data.overview.totalAccounts} 个公众号
        </p>
      </div>

      {/* 概览统计 */}
      <div className="p-4 border-b border-gray-100">
        <OverviewCard overview={data.data.overview} />
      </div>

      {/* 热门话题 */}
      {data.data.overview.topTopics.length > 0 && (
        <div className="px-4 py-3 border-b border-gray-100">
          <TopTopics topics={data.data.overview.topTopics} />
        </div>
      )}

      {/* 分组内容 */}
      {data.data.groups.length > 0 && (
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
            <Users className="size-4 text-green-500" />
            分组摘要 ({data.data.groups.length})
          </h3>
          <div className="space-y-3">
            {data.data.groups.map((group, index) => (
              <GroupCard
                key={group.name}
                group={group}
                onOpenArticle={handleOpenArticle}
                defaultExpanded={index === 0}
              />
            ))}
          </div>
        </div>
      )}

      {/* 洞察建议 */}
      <div className="p-4 border-b border-gray-100">
        <h3 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
          <Lightbulb className="size-4 text-amber-500" />
          阅读洞察
        </h3>
        <InsightsCard insights={data.data.insights} />
      </div>

      {/* 页脚 */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-center">
        <span className="text-xs text-gray-400">由 AnyKeep AI 生成</span>
      </div>
    </div>
  );
});

/**
 * 类型守卫：检查内容是否为 WechatDigestOutput 数据
 */
export function isWechatDigestOutput(
  content: unknown,
): content is WechatDigestOutput {
  if (typeof content !== "object" || content === null) {
    return false;
  }
  const obj = content as Record<string, unknown>;
  return (
    typeof obj.report === "string" &&
    typeof obj.data === "object" &&
    obj.data !== null &&
    typeof (obj.data as Record<string, unknown>).overview === "object" &&
    Array.isArray((obj.data as Record<string, unknown>).groups) &&
    typeof (obj.data as Record<string, unknown>).insights === "object"
  );
}

export default WechatDigestView;
