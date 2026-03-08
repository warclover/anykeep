/**
 * 指标卡片组件
 *
 * 展示单个指标值及其状态
 *
 * @version 1.0.0
 * @since 2026-01-02
 */

import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: number;
  unit: string;
  icon: LucideIcon;
  loading?: boolean;
  trend?: "good" | "warning" | "critical";
  description?: string;
}

export function MetricCard({
  title,
  value,
  unit,
  icon: Icon,
  loading = false,
  trend = "good",
  description,
}: MetricCardProps) {
  const trendColors = {
    good: "text-green-500 bg-green-50 dark:bg-green-900/20",
    warning: "text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20",
    critical: "text-red-500 bg-red-50 dark:bg-red-900/20",
  };

  const iconColors = {
    good: "text-green-500",
    warning: "text-yellow-500",
    critical: "text-red-500",
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-4 rounded-full" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-24 mb-1" />
          <Skeleton className="h-3 w-32" />
        </CardContent>
      </Card>
    );
  }

  const formatValue = (val: number) => {
    if (unit === "¥") {
      return val.toFixed(2);
    }
    if (unit === "%") {
      return val.toFixed(1);
    }
    return Math.round(val).toString();
  };

  return (
    <Card className={cn("transition-colors", trendColors[trend])}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={cn("size-4", iconColors[trend])} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {unit === "¥" ? "¥" : ""}
          {formatValue(value)}
          {unit !== "¥" ? unit : ""}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
