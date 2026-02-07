/**
 * 收件箱智能统计卡片
 *
 * 显示收件箱关键统计指标：
 * - 待分类书签数量
 * - 高价值内容数量
 * - AI 处理中数量
 *
 * @version 1.0.0
 * @since 2026-02-07
 */

"use client";

import { Inbox, Star, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { InboxExtendedStats } from "@/hooks/data/use-inbox-counts";

// ==================== 类型定义 ====================

interface InboxStatsCardsProps {
  stats: InboxExtendedStats;
  isLoading: boolean;
  className?: string;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  iconClassName?: string;
  isLoading?: boolean;
}

// ==================== 常量 ====================

const STATS_CONFIG = {
  uncategorized: {
    label: "待分类",
    iconClassName: "text-muted-foreground",
  },
  highValue: {
    label: "高价值内容",
    iconClassName: "text-yellow-500",
  },
  processing: {
    label: "AI 处理中",
    iconClassName: "text-blue-500",
  },
} as const;

// ==================== 子组件 ====================

function StatCard({
  icon,
  label,
  value,
  iconClassName,
  isLoading,
}: StatCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={cn("flex-shrink-0", iconClassName)}>{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground truncate">{label}</p>
          {isLoading ? (
            <Skeleton className="h-8 w-12 mt-1" />
          ) : (
            <p className="text-2xl font-bold tabular-nums">
              {value > 999 ? "999+" : value}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

// ==================== 主组件 ====================

export function InboxStatsCards({
  stats,
  isLoading,
  className,
}: InboxStatsCardsProps) {
  // 如果所有统计都为 0 且不在加载中，不显示卡片
  const hasData =
    stats.uncategorized > 0 || stats.highValue > 0 || stats.processing > 0;
  if (!isLoading && !hasData) {
    return null;
  }

  return (
    <div className={cn("grid grid-cols-3 gap-4", className)}>
      <StatCard
        icon={<Inbox className="h-5 w-5" />}
        label={STATS_CONFIG.uncategorized.label}
        value={stats.uncategorized}
        iconClassName={STATS_CONFIG.uncategorized.iconClassName}
        isLoading={isLoading}
      />

      <StatCard
        icon={<Star className="h-5 w-5" />}
        label={STATS_CONFIG.highValue.label}
        value={stats.highValue}
        iconClassName={STATS_CONFIG.highValue.iconClassName}
        isLoading={isLoading}
      />

      <StatCard
        icon={
          <Loader2
            className={cn("h-5 w-5", stats.processing > 0 && "animate-spin")}
          />
        }
        label={STATS_CONFIG.processing.label}
        value={stats.processing}
        iconClassName={STATS_CONFIG.processing.iconClassName}
        isLoading={isLoading}
      />
    </div>
  );
}

// ==================== 骨架屏 ====================

export function InboxStatsCardsSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-5 rounded" />
            <div className="flex-1">
              <Skeleton className="h-4 w-16 mb-1" />
              <Skeleton className="h-8 w-12" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export default InboxStatsCards;
