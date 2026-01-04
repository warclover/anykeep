/**
 * 脚本时间线渲染器 (Story 3.6)
 * @module knowledge-studio/structured-output
 *
 * 视频脚本时间线渲染器，以垂直时间线形式展示分镜。
 *
 * 功能特性：
 * - 垂直时间线布局
 * - 时间标记与持续时间
 * - 分镜类型图标
 * - 画面描述与旁白
 * - 音乐提示
 * - 开场 Hook 和结尾 CTA
 */

"use client";

import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import {
  Film,
  Clock,
  Play,
  Video,
  RefreshCw,
  StopCircle,
  Image as ImageIcon,
  MessageSquare,
  Music,
  Sparkles,
  Target,
  Eye,
} from "lucide-react";
import type { ScriptTimelineRendererProps } from "./types";
import type { ScriptTimelineShot } from "@/lib/knowledge-studio/blueprint/structured-output";

// ============================================================
// Constants
// ============================================================

/**
 * 分镜类型配置
 */
const SHOT_TYPE_CONFIG: Record<
  NonNullable<ScriptTimelineShot["shotType"]>,
  {
    label: string;
    icon: React.ReactNode;
    colorClass: string;
    bgClass: string;
  }
> = {
  opening: {
    label: "开场",
    icon: <Play className="size-3" />,
    colorClass: "text-emerald-600 dark:text-emerald-400",
    bgClass: "bg-emerald-100 dark:bg-emerald-900/40",
  },
  content: {
    label: "内容",
    icon: <Video className="size-3" />,
    colorClass: "text-blue-600 dark:text-blue-400",
    bgClass: "bg-blue-100 dark:bg-blue-900/40",
  },
  transition: {
    label: "转场",
    icon: <RefreshCw className="size-3" />,
    colorClass: "text-purple-600 dark:text-purple-400",
    bgClass: "bg-purple-100 dark:bg-purple-900/40",
  },
  closing: {
    label: "结尾",
    icon: <StopCircle className="size-3" />,
    colorClass: "text-amber-600 dark:text-amber-400",
    bgClass: "bg-amber-100 dark:bg-amber-900/40",
  },
  "b-roll": {
    label: "B-Roll",
    icon: <ImageIcon className="size-3" />,
    colorClass: "text-rose-600 dark:text-rose-400",
    bgClass: "bg-rose-100 dark:bg-rose-900/40",
  },
};

// ============================================================
// Helper Functions
// ============================================================

/**
 * 格式化秒数为 MM:SS
 */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * 格式化时间范围
 */
function formatTimeRange(startTime: number, duration: number): string {
  const endTime = startTime + duration;
  return `${formatDuration(startTime)} - ${formatDuration(endTime)}`;
}

// ============================================================
// Helper Components
// ============================================================

/**
 * 分镜类型标签
 */
function ShotTypeBadge({
  shotType,
}: {
  shotType: ScriptTimelineShot["shotType"];
}) {
  if (!shotType) return null;

  const config = SHOT_TYPE_CONFIG[shotType];

  return (
    <Badge
      variant="secondary"
      className={cn(
        "text-xs h-5 px-1.5 gap-1",
        config.bgClass,
        config.colorClass,
      )}
    >
      {config.icon}
      {config.label}
    </Badge>
  );
}

/**
 * 单个分镜卡片
 */
function ShotCard({
  shot,
  isLast,
  totalDuration,
}: {
  shot: ScriptTimelineShot;
  isLast: boolean;
  totalDuration: number;
}) {
  const config = shot.shotType ? SHOT_TYPE_CONFIG[shot.shotType] : null;
  const progressPercent =
    totalDuration > 0
      ? ((shot.startTime + shot.duration) / totalDuration) * 100
      : 0;

  return (
    <div className="relative flex gap-3">
      {/* 时间线轴 */}
      <div className="flex flex-col items-center">
        {/* 时间节点 */}
        <div
          className={cn(
            "size-3 rounded-full border-2 shrink-0",
            config
              ? `${config.bgClass} border-current ${config.colorClass}`
              : "bg-muted border-muted-foreground/40",
          )}
        />
        {/* 连接线 */}
        {!isLast && <div className="w-0.5 flex-1 min-h-[40px] bg-border" />}
      </div>

      {/* 分镜内容 */}
      <div className="flex-1 pb-4">
        {/* 头部 */}
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="text-xs font-mono text-muted-foreground">
            #{shot.sequence}
          </span>
          <ShotTypeBadge shotType={shot.shotType} />
          <span className="text-xs text-muted-foreground">
            {formatTimeRange(shot.startTime, shot.duration)}
          </span>
          <Badge variant="outline" className="text-xs h-5 px-1.5 ml-auto">
            <Clock className="size-3 mr-1" />
            {formatDuration(shot.duration)}
          </Badge>
        </div>

        {/* 卡片主体 */}
        <div className="rounded-lg border bg-card p-3 space-y-2">
          {/* 画面描述 */}
          <div className="flex items-start gap-2">
            <Eye className="size-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-sm">{shot.visual}</p>
          </div>

          {/* 旁白/台词 */}
          {shot.narration && (
            <div className="flex items-start gap-2">
              <MessageSquare className="size-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground italic">
                &ldquo;{shot.narration}&rdquo;
              </p>
            </div>
          )}

          {/* 字幕 */}
          {shot.subtitle && (
            <div className="flex items-start gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="text-xs">
                      字幕: {shot.subtitle.substring(0, 20)}
                      {shot.subtitle.length > 20 && "..."}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>{shot.subtitle}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}

          {/* 音乐提示 */}
          {shot.musicCue && (
            <div className="flex items-center gap-2">
              <Music className="size-4 text-purple-500 shrink-0" />
              <span className="text-xs text-muted-foreground">
                {shot.musicCue}
              </span>
            </div>
          )}

          {/* B-Roll 建议 */}
          {shot.bRollSuggestion && (
            <div className="flex items-start gap-2 pt-2 border-t">
              <ImageIcon className="size-4 text-rose-500 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                B-Roll 建议: {shot.bRollSuggestion}
              </p>
            </div>
          )}
        </div>

        {/* 进度条（仅非最后一项显示） */}
        {!isLast && <Progress value={progressPercent} className="h-1 mt-2" />}
      </div>
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

/**
 * 脚本时间线渲染器
 *
 * 垂直时间线展示每个分镜的时间和内容。
 *
 * @example
 * ```tsx
 * <ScriptTimelineRenderer
 *   data={{
 *     meta: { type: 'script_timeline', ... },
 *     title: '产品介绍视频',
 *     videoType: '营销',
 *     targetDuration: 120,
 *     shots: [
 *       { id: '1', sequence: 1, startTime: 0, duration: 5, visual: '品牌 Logo', shotType: 'opening' },
 *       { id: '2', sequence: 2, startTime: 5, duration: 30, visual: '产品特性展示', shotType: 'content' },
 *     ],
 *     totalDuration: 120,
 *   }}
 * />
 * ```
 */
export const ScriptTimelineRenderer = memo(function ScriptTimelineRenderer({
  data,
  className,
  maxHeight,
}: ScriptTimelineRendererProps) {
  const {
    title,
    videoType,
    targetDuration,
    shots,
    openingHook,
    closingCta,
    totalDuration,
  } = data;

  // 计算时长差异
  const durationDiff = useMemo(() => {
    const diff = totalDuration - targetDuration;
    if (Math.abs(diff) < 1) return null;
    return diff;
  }, [totalDuration, targetDuration]);

  // 统计各类型分镜数量
  const shotTypeStats = useMemo(() => {
    const stats: Record<string, number> = {};
    for (const shot of shots) {
      const type = shot.shotType ?? "other";
      stats[type] = (stats[type] ?? 0) + 1;
    }
    return stats;
  }, [shots]);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Film className="size-5 text-primary" />
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>

        {/* 视频信息 */}
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {videoType && <Badge variant="secondary">{videoType}</Badge>}
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="size-3" />
            目标: {formatDuration(targetDuration)}
          </span>
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            实际: {formatDuration(totalDuration)}
            {durationDiff && (
              <span
                className={cn(
                  "text-xs ml-1",
                  durationDiff > 0 ? "text-amber-500" : "text-emerald-500",
                )}
              >
                ({durationDiff > 0 ? "+" : ""}
                {formatDuration(Math.abs(durationDiff))})
              </span>
            )}
          </span>
        </div>

        {/* 分镜统计 */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="text-sm text-muted-foreground">
            共 {shots.length} 个分镜
          </span>
          {Object.entries(shotTypeStats).map(([type, count]) => {
            const config =
              SHOT_TYPE_CONFIG[type as keyof typeof SHOT_TYPE_CONFIG];
            if (!config) return null;
            return (
              <Badge
                key={type}
                variant="outline"
                className={cn("text-xs gap-1", config.colorClass)}
              >
                {config.icon}
                {count}
              </Badge>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 开场 Hook */}
        {openingHook && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
            <Sparkles className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-1">
                开场 Hook
              </p>
              <p className="text-sm">{openingHook}</p>
            </div>
          </div>
        )}

        {/* 时间线 */}
        <div
          className="overflow-auto"
          style={{ maxHeight: maxHeight ?? "400px" }}
        >
          {shots.map((shot, index) => (
            <ShotCard
              key={shot.id}
              shot={shot}
              isLast={index === shots.length - 1}
              totalDuration={totalDuration}
            />
          ))}
        </div>

        {/* 结尾 CTA */}
        {closingCta && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <Target className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">
                结尾 CTA
              </p>
              <p className="text-sm">{closingCta}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

ScriptTimelineRenderer.displayName = "ScriptTimelineRenderer";
