/**
 * AI 学习洞察页面 - 概览选项卡
 *
 * 包含：反馈分布、系统健康 + 建议、时间偏好热力图
 */

"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Pencil,
  Lightbulb,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TEXT } from "./constants";
import type { LearningStats, HealthReport, TimePreference } from "./types";

export function OverviewTab({
  stats,
  health,
  timePreferences,
}: {
  stats: LearningStats;
  health: HealthReport | null;
  timePreferences?: TimePreference[];
}) {
  const feedbackTotal =
    stats.confirmations + stats.rejections + stats.modifications;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* 反馈分布 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="size-4 text-blue-500" />
            反馈分布
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {feedbackTotal === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              暂无反馈数据
            </p>
          ) : (
            <>
              <FeedbackBar
                icon={<CheckCircle2 className="size-4 text-emerald-500" />}
                label={TEXT.stats.confirmations}
                count={stats.confirmations}
                total={feedbackTotal}
                color="bg-emerald-500"
              />
              <FeedbackBar
                icon={<XCircle className="size-4 text-red-500" />}
                label={TEXT.stats.rejections}
                count={stats.rejections}
                total={feedbackTotal}
                color="bg-red-500"
              />
              <FeedbackBar
                icon={<Pencil className="size-4 text-amber-500" />}
                label={TEXT.stats.modifications}
                count={stats.modifications}
                total={feedbackTotal}
                color="bg-amber-500"
              />
            </>
          )}
          {stats.lastLearningTime && (
            <p className="text-xs text-muted-foreground pt-2 border-t">
              最后学习：
              {new Date(stats.lastLearningTime).toLocaleString("zh-CN")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* 系统健康 + 建议 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="size-4 text-amber-500" />
            {TEXT.health.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {health ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <MetricItem
                  label={TEXT.health.accuracy}
                  value={health.metrics.classificationAccuracy}
                />
                <MetricItem
                  label={TEXT.health.confirmation}
                  value={health.metrics.confirmationRate}
                />
                <MetricItem
                  label={TEXT.health.fastPath}
                  value={health.metrics.fastPathHitRate}
                />
                <MetricItem
                  label={TEXT.health.satisfaction}
                  value={health.metrics.userSatisfaction}
                />
              </div>

              {health.trends && (
                <div className="flex gap-3 text-xs">
                  <span className="text-muted-foreground">
                    准确率趋势：
                    <TrendBadge trend={health.trends.accuracyTrend} />
                  </span>
                  <span className="text-muted-foreground">
                    活跃度：
                    <TrendBadge trend={health.trends.activityTrend} />
                  </span>
                </div>
              )}

              {health.recommendations.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t">
                  {health.recommendations.map((r, i) => (
                    <p
                      key={i}
                      className="text-xs text-muted-foreground flex items-start gap-1.5"
                    >
                      <Lightbulb className="size-3 mt-0.5 shrink-0 text-amber-400" />
                      {r}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              数据不足，暂无系统建议
            </p>
          )}
        </CardContent>
      </Card>

      {/* 时间偏好热力图 */}
      {timePreferences && timePreferences.length > 0 && (
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="size-4 text-cyan-500" />
              时间段偏好
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TimeHeatmap data={timePreferences} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FeedbackBar({
  icon,
  label,
  count,
  total,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5">
          {icon}
          {label}
        </span>
        <span className="text-muted-foreground">
          {count} ({pct}%)
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function MetricItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <Progress value={value} className="h-2 flex-1" />
        <span className="text-xs font-medium w-9 text-right">
          {Math.round(value)}%
        </span>
      </div>
    </div>
  );
}

function TrendBadge({ trend }: { trend: string }) {
  const label = TEXT.trends[trend] || trend;
  const isGood = trend === "improving" || trend === "increasing";
  const isBad = trend === "declining" || trend === "decreasing";

  return (
    <Badge
      variant="outline"
      className={cn(
        "ml-1 text-[10px] px-1.5 py-0",
        isGood && "border-emerald-300 text-emerald-600 dark:text-emerald-400",
        isBad && "border-red-300 text-red-600 dark:text-red-400",
      )}
    >
      {label}
    </Badge>
  );
}

function TimeHeatmap({ data }: { data: TimePreference[] }) {
  const maxCount = useMemo(() => {
    let max = 0;
    for (const tp of data) {
      for (const f of tp.topFolders) {
        if (f.count > max) max = f.count;
      }
    }
    return max || 1;
  }, [data]);

  return (
    <div className="flex flex-wrap gap-1.5">
      {Array.from({ length: 24 }).map((_, hour) => {
        const tp = data.find((d) => d.hour === hour);
        const total = tp?.topFolders.reduce((s, f) => s + f.count, 0) ?? 0;
        const intensity = total / maxCount;

        return (
          <div
            key={hour}
            className="flex flex-col items-center gap-0.5"
            title={`${hour}:00 — ${total} 条收藏`}
          >
            <div
              className="w-7 h-7 rounded-md border transition-colors"
              style={{
                backgroundColor:
                  total === 0
                    ? "var(--muted)"
                    : `rgba(139, 92, 246, ${0.15 + intensity * 0.75})`,
              }}
            />
            <span className="text-[10px] text-muted-foreground">{hour}</span>
          </div>
        );
      })}
    </div>
  );
}
