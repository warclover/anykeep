/**
 * 延迟图表组件
 *
 * 展示 P50/P95/P99/Avg 延迟指标的条形图
 *
 * @version 1.0.0
 * @since 2026-01-02
 */

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface LatencyChartProps {
  p50: number;
  p95: number;
  p99: number;
  avg: number;
  loading?: boolean;
}

export function LatencyChart({
  p50,
  p95,
  p99,
  avg,
  loading = false,
}: LatencyChartProps) {
  const maxValue = Math.max(p50, p95, p99, avg, 100);

  const bars = [
    { label: "P50", value: p50, color: "bg-green-500" },
    { label: "平均", value: avg, color: "bg-blue-500" },
    { label: "P95", value: p95, color: "bg-yellow-500" },
    { label: "P99", value: p99, color: "bg-red-500" },
  ];

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-6 w-full rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">搜索延迟分布</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {bars.map((bar) => {
          const percentage = Math.min((bar.value / maxValue) * 100, 100);
          const isWarning = bar.value > 500;
          const isCritical = bar.value > 1000;

          return (
            <div key={bar.label} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{bar.label}</span>
                <span
                  className={cn(
                    "tabular-nums",
                    isCritical
                      ? "text-red-500"
                      : isWarning
                        ? "text-yellow-500"
                        : "text-muted-foreground",
                  )}
                >
                  {Math.round(bar.value)}ms
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    isCritical
                      ? "bg-red-500"
                      : isWarning
                        ? "bg-yellow-500"
                        : bar.color,
                  )}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}

        {/* 阈值说明 */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
          <div className="flex items-center gap-1">
            <div className="size-2 rounded-full bg-green-500" />
            <span>&lt; 500ms</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="size-2 rounded-full bg-yellow-500" />
            <span>500-1000ms</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="size-2 rounded-full bg-red-500" />
            <span>&gt; 1000ms</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
