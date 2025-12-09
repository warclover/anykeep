/**
 * V3.0 文件夹 AI 画像可视化组件
 *
 * 展示 AI 对文件夹内容的理解：
 * - 主要标签/关键词
 * - 内容类型分布
 * - 创建来源（用户创建 vs AI 自动创建）
 * - 画像健康度
 */

"use client";

import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Brain,
  Sparkles,
  RefreshCw,
  Clock,
  FileText,
  Tag,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useFolderProfile,
  type FolderProfile,
} from "@/hooks/use-folder-profile";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

// ============================================================================
// 类型定义
// ============================================================================

interface FolderAIProfileProps {
  folderId: number;
  folderName?: string;
  className?: string;
  /** 是否默认展开 */
  defaultExpanded?: boolean;
  /** 紧凑模式 */
  compact?: boolean;
}

// ============================================================================
// 辅助组件
// ============================================================================

/**
 * 画像健康度指示器
 */
function ProfileHealthIndicator({ profile }: { profile: FolderProfile }) {
  // 根据画像数据计算健康度（使用 useMemo 避免每次渲染都计算）
  const health = useMemo(() => {
    let score = 0;
    // eslint-disable-next-line react-hooks/purity -- Date.now() is needed for freshness calculation
    const now = Date.now();

    // 有标签 +30
    if (profile.topTags.length >= 3) {
      score += 30;
    } else if (profile.topTags.length >= 1) {
      score += 15;
    }

    // 有足够书签 +30
    if (profile.bookmarkCount >= 5) {
      score += 30;
    } else if (profile.bookmarkCount >= 2) {
      score += 15;
    }

    // 最近有活跃 +20
    if (profile.lastBookmarkAt) {
      const daysSinceLastBookmark = Math.floor(
        (now - profile.lastBookmarkAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysSinceLastBookmark < 7) {
        score += 20;
      } else if (daysSinceLastBookmark < 30) {
        score += 10;
      }
    }

    // 内部相似度好 +20
    if (profile.internalSimilarity !== null) {
      if (profile.internalSimilarity >= 0.6) {
        score += 20;
      } else if (profile.internalSimilarity >= 0.4) {
        score += 10;
      }
    } else {
      score += 10; // 没有相似度数据给基础分
    }

    if (score >= 80) {
      return { score, label: "优秀", color: "text-green-600" };
    } else if (score >= 60) {
      return { score, label: "良好", color: "text-blue-600" };
    } else if (score >= 40) {
      return { score, label: "一般", color: "text-yellow-600" };
    } else {
      return { score, label: "需优化", color: "text-orange-600" };
    }
  }, [
    profile.topTags.length,
    profile.bookmarkCount,
    profile.lastBookmarkAt,
    profile.internalSimilarity,
  ]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5">
            {health.score >= 60 ? (
              <CheckCircle className={cn("size-4", health.color)} />
            ) : (
              <AlertCircle className={cn("size-4", health.color)} />
            )}
            <span className={cn("text-xs font-medium", health.color)}>
              {health.label}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>画像健康度: {health.score}%</p>
          <p className="text-xs text-muted-foreground mt-1">
            基于标签数量、内容量、活跃度评估
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * 标签云组件
 */
function TagCloud({ tags, maxTags = 8 }: { tags: string[]; maxTags?: number }) {
  const displayTags = tags.slice(0, maxTags);
  const hiddenCount = tags.length - maxTags;

  if (tags.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        暂无标签数据，继续添加内容后 AI 将自动学习
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {displayTags.map((tag, index) => (
        <Badge
          key={tag}
          variant="secondary"
          className={cn(
            "text-xs transition-all hover:scale-105",
            index === 0 && "bg-primary/10 text-primary border-primary/20",
            index === 1 &&
              "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
            index === 2 &&
              "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
          )}
        >
          {tag}
        </Badge>
      ))}
      {hiddenCount > 0 && (
        <Badge variant="outline" className="text-xs text-muted-foreground">
          +{hiddenCount}
        </Badge>
      )}
    </div>
  );
}

/**
 * 统计项组件
 */
function StatItem({
  icon: Icon,
  label,
  value,
  subValue,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subValue?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-4 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-medium text-sm">{value}</span>
          <span className="text-xs text-muted-foreground truncate">
            {label}
          </span>
        </div>
        {subValue && (
          <p className="text-xs text-muted-foreground">{subValue}</p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 主组件
// ============================================================================

export function FolderAIProfile({
  folderId,
  folderName,
  className,
  defaultExpanded = true,
  compact = false,
}: FolderAIProfileProps) {
  const { profile, isLoading, error, refresh, recompute } =
    useFolderProfile(folderId);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isRecomputing, setIsRecomputing] = useState(false);

  // 处理重新计算
  const handleRecompute = async () => {
    setIsRecomputing(true);
    try {
      await recompute();
    } finally {
      setIsRecomputing(false);
    }
  };

  // 加载状态
  if (isLoading) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-5 w-32" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-14" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // 错误状态
  if (error) {
    return (
      <Card
        className={cn("w-full border-red-200 dark:border-red-800", className)}
      >
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertCircle className="size-4" />
            <span className="text-sm">{error}</span>
            <Button variant="ghost" size="sm" onClick={refresh}>
              重试
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 无画像数据
  if (!profile) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="py-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <Brain className="size-8 text-muted-foreground/50" />
            <div>
              <p className="text-sm font-medium">暂无 AI 画像</p>
              <p className="text-xs text-muted-foreground mt-1">
                添加更多内容后，AI 将自动生成文件夹画像
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleRecompute}>
              <RefreshCw className="size-3.5 mr-1.5" />
              生成画像
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 紧凑模式
  if (compact) {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center gap-2 text-sm">
          <Brain className="size-4 text-purple-500" />
          <span className="text-muted-foreground">AI 理解:</span>
          <TagCloud tags={profile.topTags} maxTags={3} />
        </div>
      </div>
    );
  }

  // 完整展示
  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="size-5 text-purple-500" />
            AI 对此文件夹的理解
            {profile.source === "ai_auto_created" && (
              <Badge
                variant="outline"
                className="ml-1 bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700 text-purple-600 dark:text-purple-300 text-xs"
              >
                <Sparkles className="size-3 mr-1" />
                AI 创建
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <ProfileHealthIndicator profile={profile} />
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
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
        {folderName && (
          <CardDescription className="mt-1">
            「{folderName}」的内容特征分析
          </CardDescription>
        )}
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* 主要标签 */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <Tag className="size-4 text-muted-foreground" />
              主要内容标签
            </div>
            <TagCloud tags={profile.topTags} maxTags={8} />
          </div>

          {/* 统计信息 */}
          <div className="grid grid-cols-2 gap-3">
            <StatItem
              icon={FileText}
              label="条收藏"
              value={profile.bookmarkCount}
            />
            <StatItem
              icon={Clock}
              label="最近更新"
              value={
                profile.lastBookmarkAt
                  ? formatDistanceToNow(profile.lastBookmarkAt, {
                      addSuffix: true,
                      locale: zhCN,
                    })
                  : "暂无"
              }
            />
          </div>

          {/* 内部一致性 */}
          {profile.internalSimilarity !== null && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">内容一致性:</span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    profile.internalSimilarity >= 0.6
                      ? "bg-green-500"
                      : profile.internalSimilarity >= 0.4
                        ? "bg-yellow-500"
                        : "bg-orange-500",
                  )}
                  style={{ width: `${profile.internalSimilarity * 100}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {Math.round(profile.internalSimilarity * 100)}%
              </span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>衡量文件夹内内容的相似程度</p>
                    <p className="text-xs text-muted-foreground">
                      一致性越高，AI 分类越准确
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}

          {/* 示例内容 */}
          {profile.sampleTitles.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">
                典型内容
              </div>
              <div className="space-y-1">
                {profile.sampleTitles.slice(0, 3).map((title, index) => (
                  <p
                    key={index}
                    className="text-xs text-muted-foreground truncate"
                  >
                    • {title}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex items-center justify-between pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              更新于{" "}
              {formatDistanceToNow(profile.updatedAt, {
                addSuffix: true,
                locale: zhCN,
              })}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRecompute}
              disabled={isRecomputing}
              className="h-7 text-xs"
            >
              {isRecomputing ? (
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5 mr-1.5" />
              )}
              重新分析
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default FolderAIProfile;
