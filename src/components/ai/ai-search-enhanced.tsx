/**
 * AI 搜索增强组件
 *
 * 为搜索结果提供 AI 增强功能，包括结果解释、摘要、相关性说明
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Sparkles,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  BookOpen,
  Target,
  Filter,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ============================================
// 类型定义
// ============================================

export interface AISearchEnhancedProps {
  /** 搜索查询 */
  query: string;
  /** 搜索结果数量 */
  resultCount: number;
  /** 搜索模式 */
  searchMode: "keyword" | "semantic";
  /** 是否自动生成洞察 */
  autoGenerateInsights?: boolean;
  /** 自定义类名 */
  className?: string;
}

interface SearchInsight {
  type: "summary" | "suggestion" | "filter" | "related";
  title: string;
  content: string;
  action?: {
    label: string;
    query?: string;
  };
}

// ============================================
// 组件
// ============================================

export function AISearchEnhanced({
  query,
  resultCount,
  searchMode,
  autoGenerateInsights = true,
  className,
}: AISearchEnhancedProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [insights, setInsights] = useState<SearchInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"helpful" | "not-helpful" | null>(
    null,
  );

  /**
   * 生成搜索洞察
   */
  const generateInsights = useCallback(async () => {
    if (!query.trim()) {
      setInsights([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // TODO(@backlog): 接入真实 AI 洞察 API，替换 mock 数据
      const mockInsights: SearchInsight[] = [
        {
          type: "summary",
          title: "搜索理解",
          content: `我理解你在查找与「${query}」相关的内容。${
            searchMode === "semantic"
              ? "已启用语义搜索，将找到含义相近的内容。"
              : "使用关键词精确匹配。"
          }`,
        },
        {
          type: "suggestion",
          title: "搜索建议",
          content:
            resultCount === 0
              ? `未找到结果，试试更换关键词或使用语义搜索`
              : `找到 ${resultCount} 条结果，可以尝试添加筛选条件缩小范围`,
        },
      ];

      // 添加相关搜索建议
      if (query.length > 2) {
        mockInsights.push({
          type: "related",
          title: "相关搜索",
          content: "你可能还想搜索：",
          action: {
            label: `${query} 教程`,
            query: `${query} 教程`,
          },
        });
      }

      setInsights(mockInsights);
    } catch (err) {
      const message = err instanceof Error ? err.message : "生成失败";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [query, resultCount, searchMode]);

  // 自动生成洞察
  useEffect(() => {
    if (autoGenerateInsights && query.trim()) {
      const debounce = setTimeout(generateInsights, 500);
      return () => clearTimeout(debounce);
    }
  }, [query, autoGenerateInsights, generateInsights]);

  /**
   * 处理反馈
   */
  const handleFeedback = useCallback((type: "helpful" | "not-helpful") => {
    setFeedback(type);
    // TODO: 搜索洞察反馈端点尚未实现
    // 当前仅记录本地状态，后续可接入 /api/ai/feedback 或新建专用端点
  }, []);

  // 不显示条件
  if (!query.trim()) {
    return null;
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center size-8 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                  <Sparkles className="size-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium">
                    AI 搜索洞察
                  </CardTitle>
                  <CardDescription className="text-xs">
                    智能分析搜索结果
                  </CardDescription>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!loading && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      generateInsights();
                    }}
                  >
                    <RefreshCw className="size-4" />
                  </Button>
                )}
                {isExpanded ? (
                  <ChevronUp className="size-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="size-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {error && (
              <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            {loading ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Skeleton className="size-6 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Skeleton className="size-6 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                </div>
              </div>
            ) : insights.length > 0 ? (
              <div className="space-y-3">
                {insights.map((insight, index) => (
                  <InsightItem key={index} insight={insight} />
                ))}

                {/* 反馈 */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-xs text-muted-foreground">
                    这个分析有帮助吗？
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant={feedback === "helpful" ? "default" : "ghost"}
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => handleFeedback("helpful")}
                    >
                      <ThumbsUp
                        className={cn(
                          "size-3",
                          feedback === "helpful" && "text-green-500",
                        )}
                      />
                    </Button>
                    <Button
                      variant={feedback === "not-helpful" ? "default" : "ghost"}
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => handleFeedback("not-helpful")}
                    >
                      <ThumbsDown
                        className={cn(
                          "size-3",
                          feedback === "not-helpful" && "text-red-500",
                        )}
                      />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-sm text-muted-foreground">
                <Lightbulb className="size-8 mx-auto mb-2 opacity-30" />
                <p>输入搜索词后将显示 AI 洞察</p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

/**
 * 洞察项组件
 */
function InsightItem({ insight }: { insight: SearchInsight }) {
  const icons: Record<string, React.ElementType> = {
    summary: BookOpen,
    suggestion: Lightbulb,
    filter: Filter,
    related: Target,
  };

  const colors: Record<string, string> = {
    summary: "text-blue-600 bg-blue-100 dark:bg-blue-900/30",
    suggestion: "text-amber-600 bg-amber-100 dark:bg-amber-900/30",
    filter: "text-green-600 bg-green-100 dark:bg-green-900/30",
    related: "text-purple-600 bg-purple-100 dark:bg-purple-900/30",
  };

  const Icon = icons[insight.type] || Lightbulb;
  const colorClass = colors[insight.type] || colors.suggestion;

  return (
    <div className="flex gap-2">
      <div
        className={cn(
          "flex-shrink-0 flex items-center justify-center size-6 rounded",
          colorClass,
        )}
      >
        <Icon className="size-3" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-muted-foreground">
          {insight.title}
        </p>
        <p className="text-sm mt-0.5">{insight.content}</p>
        {insight.action && (
          <Button variant="link" size="sm" className="h-auto p-0 mt-1 text-xs">
            {insight.action.label} →
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * 搜索结果解释组件（简化版，用于结果列表）
 */
export function AISearchExplanation({
  query: _query,
  matchReason,
  similarity,
  className,
}: {
  query: string;
  matchReason?: string;
  similarity?: number;
  className?: string;
}) {
  if (!matchReason && !similarity) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-xs text-muted-foreground",
        className,
      )}
    >
      <Sparkles className="size-3 text-purple-500" />
      {similarity !== undefined && (
        <Badge variant="secondary" className="text-xs">
          相似度 {Math.round(similarity * 100)}%
        </Badge>
      )}
      {matchReason && <span>{matchReason}</span>}
    </div>
  );
}

export default AISearchEnhanced;
