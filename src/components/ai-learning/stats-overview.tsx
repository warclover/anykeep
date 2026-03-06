/**
 * AI 学习洞察页面 - 统计概览卡片
 */

import { Card, CardContent } from "@/components/ui/card";
import { Activity, TrendingUp, ShieldBan } from "lucide-react";
import { cn } from "@/lib/utils";
import { TEXT } from "./constants";
import type { LearningStats } from "./types";

export function StatsOverview({
  stats,
  exclusionCount,
  healthScore,
}: {
  stats: LearningStats;
  exclusionCount: number;
  healthScore?: number;
}) {
  const items = [
    {
      label: TEXT.stats.totalEvents,
      value: stats.totalEvents,
      icon: Activity,
      color: "text-blue-500",
    },
    {
      label: TEXT.stats.accuracy,
      value: `${Math.round(stats.accuracy)}%`,
      icon: TrendingUp,
      color: stats.accuracy >= 70 ? "text-emerald-500" : "text-amber-500",
    },
    {
      label: TEXT.stats.healthScore,
      value: healthScore != null ? `${healthScore}分` : "—",
      icon: Activity,
      color:
        (healthScore ?? 0) >= 70
          ? "text-emerald-500"
          : (healthScore ?? 0) >= 40
            ? "text-amber-500"
            : "text-red-500",
    },
    {
      label: TEXT.stats.exclusionCount,
      value: exclusionCount,
      icon: ShieldBan,
      color: "text-violet-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <item.icon className={cn("size-4", item.color)} />
              {item.label}
            </div>
            <p className="text-2xl font-bold">{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
