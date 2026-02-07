/**
 * 聚类待处理卡片组件
 *
 * 显示待聚类书签数量，引导用户进入聚类操作
 *
 * @version 1.0.0
 * @since 2026-02-07
 */

"use client";

import { useRouter } from "next/navigation";
import { Layers, Clock, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { useClusterStats } from "@/hooks/domain/organize/use-cluster-stats";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

// ============================================================================
// 常量
// ============================================================================

const LABELS = {
  title: "智能聚类",
  description: "基��内容相似度自动分组",
  emptyState: "暂无待聚类内容",
  pendingPrefix: "待处理",
  oldestPendingPrefix: "最早",
  actionButton: "开始聚类",
} as const;

// ============================================================================
// 组件
// ============================================================================

interface ClusterPendingCardProps {
  /** 是否禁用交互 */
  disabled?: boolean;
  /** 点击回调（可选，默认跳转到聚类页面） */
  onClick?: () => void;
}

/**
 * 聚类待处理卡片
 *
 * 功能：
 * - 显示待聚类书签数量徽章
 * - 显示最早待聚类时间
 * - 点击进入聚类操作页面
 * - 空状态时隐藏卡片
 */
export function ClusterPendingCard({
  disabled,
  onClick,
}: ClusterPendingCardProps) {
  const router = useRouter();
  const { pendingCount, stats, isLoading, error } = useClusterStats();

  // 加载状态
  if (isLoading) {
    return (
      <Card className="cursor-default">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-9 w-9 rounded" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-36" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 错误状态 - 静默处理，不显示卡片
  if (error) {
    return null;
  }

  // 空状态 - 隐藏卡片
  if (pendingCount === 0) {
    return null;
  }

  // 格式化最早待聚类时间
  const oldestPendingText = stats?.oldestPending
    ? formatDistanceToNow(new Date(stats.oldestPending), {
        addSuffix: true,
        locale: zhCN,
      })
    : null;

  const handleClick = () => {
    if (disabled) return;
    if (onClick) {
      onClick();
    } else {
      router.push("/organize/clustering");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === " ") && !disabled) {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <Card
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={`${LABELS.title}: ${pendingCount} 个待处理`}
      aria-disabled={disabled}
      className="cursor-pointer hover:border-primary/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* 图标与徽章 */}
          <div className="relative p-2 bg-violet-100 dark:bg-violet-900/30 rounded">
            <Layers className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            {pendingCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-2 -right-2 h-5 min-w-5 p-0 flex items-center justify-center text-xs"
              >
                {pendingCount > 99 ? "99+" : pendingCount}
              </Badge>
            )}
          </div>

          {/* 文本内容 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium">{LABELS.title}</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              {LABELS.description}
            </p>

            {/* 待处理详情 */}
            {oldestPendingText && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>
                      {LABELS.oldestPendingPrefix} {oldestPendingText}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>最早的待聚类书签</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* 箭头指示 */}
          <ArrowRight className="h-4 w-4 text-muted-foreground self-center" />
        </div>
      </CardContent>
    </Card>
  );
}
