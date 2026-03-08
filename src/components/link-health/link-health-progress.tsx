/**
 * 链接健康检测进度组件
 * 显示检测进度和实时统计
 */

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  Clock,
  ArrowRightLeft,
  XCircle,
  Loader2,
} from "lucide-react";
import type { HealthCheckStats } from "@/lib/ai-skills/skills/link-health-check/types";

interface LinkHealthProgressProps {
  /** 进度百分比 0-100 */
  progress: number;
  /** 当前步骤描述 */
  currentStep?: string;
  /** 统计结果 */
  stats: HealthCheckStats | null;
}

/** 统计标签配置 */
const STAT_ITEMS = [
  {
    key: "healthyCount" as const,
    label: "健康",
    icon: CheckCircle2,
    color: "text-green-500",
  },
  {
    key: "slowCount" as const,
    label: "缓慢",
    icon: Clock,
    color: "text-amber-500",
  },
  {
    key: "redirectCount" as const,
    label: "重定向",
    icon: ArrowRightLeft,
    color: "text-blue-500",
  },
  {
    key: "failedCount" as const,
    label: "失效",
    icon: XCircle,
    color: "text-red-500",
  },
];

export function LinkHealthProgress({
  progress,
  currentStep,
  stats,
}: LinkHealthProgressProps) {
  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        {/* 进度条 */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="size-3.5 animate-spin" />
              {currentStep || "正在检测..."}
            </span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        {/* 实时统计 */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {STAT_ITEMS.map((item) => {
              const Icon = item.icon;
              const value = stats[item.key] || 0;
              return (
                <div
                  key={item.key}
                  className="flex items-center gap-1.5 p-2 rounded-lg bg-muted/50"
                >
                  <Icon className={`size-4 ${item.color}`} />
                  <div>
                    <p className="text-[10px] text-muted-foreground">
                      {item.label}
                    </p>
                    <p className="text-sm font-semibold">{value}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 已检测总数 */}
        {stats && (
          <div className="text-center text-xs text-muted-foreground">
            已检测 <span className="font-medium">{stats.totalChecked}</span>{" "}
            个链接
          </div>
        )}
      </CardContent>
    </Card>
  );
}
