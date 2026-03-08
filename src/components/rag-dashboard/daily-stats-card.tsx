/**
 * 每日统计卡片组件
 *
 * 展示今日的 RAG 使用统计
 *
 * @version 1.0.0
 * @since 2026-01-02
 */

import { Users, Search, Clock, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface DailyStats {
  date: string;
  totalSearches: number;
  uniqueUsers: number;
  avgLatencyMs: number;
  zeroResultRate: number;
  totalCostCNY: number;
}

interface DailyStatsCardProps {
  stats: DailyStats | null;
  loading?: boolean;
}

export function DailyStatsCard({
  stats,
  loading = false,
}: DailyStatsCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-8 w-24" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const statItems = [
    {
      label: "搜索次数",
      value: stats?.totalSearches ?? 0,
      unit: "次",
      icon: Search,
      color: "text-blue-500",
    },
    {
      label: "活跃用户",
      value: stats?.uniqueUsers ?? 0,
      unit: "人",
      icon: Users,
      color: "text-green-500",
    },
    {
      label: "平均延迟",
      value: Math.round(stats?.avgLatencyMs ?? 0),
      unit: "ms",
      icon: Clock,
      color:
        stats?.avgLatencyMs && stats.avgLatencyMs > 500
          ? "text-yellow-500"
          : "text-purple-500",
    },
    {
      label: "搜索成功率",
      value: ((1 - (stats?.zeroResultRate ?? 0)) * 100).toFixed(1),
      unit: "%",
      icon: Target,
      color:
        stats?.zeroResultRate && stats.zeroResultRate > 0.1
          ? "text-yellow-500"
          : "text-emerald-500",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          今日统计
          {stats?.date && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {stats.date}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {statItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
              >
                <div className={cn("p-2 rounded-lg bg-background", item.color)}>
                  <Icon className="size-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {item.value}
                    <span className="text-sm font-normal text-muted-foreground ml-0.5">
                      {item.unit}
                    </span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* 成本信息 */}
        {stats && stats.totalCostCNY > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">今日 API 成本</span>
              <span
                className={cn(
                  "font-medium",
                  stats.totalCostCNY > 80
                    ? "text-red-500"
                    : stats.totalCostCNY > 50
                      ? "text-yellow-500"
                      : "text-green-500",
                )}
              >
                ¥{stats.totalCostCNY.toFixed(2)}
              </span>
            </div>
            <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  stats.totalCostCNY > 80
                    ? "bg-red-500"
                    : stats.totalCostCNY > 50
                      ? "bg-yellow-500"
                      : "bg-green-500",
                )}
                style={{
                  width: `${Math.min((stats.totalCostCNY / 100) * 100, 100)}%`,
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              预算：¥100.00 / 天
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
