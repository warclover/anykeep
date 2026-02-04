/**
 * 分类进度指示器组件
 *
 * 显示批量分类的三阶段进度
 *
 * @module components/batch-classification/progress-indicator
 * @version 1.0.0
 * @since 2026-02-01
 */

"use client";

import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ClassificationProgress,
  ClassificationPhase,
} from "@/lib/classification/services/batch-classification";
import { clientLogger } from "@/lib/client-logger";

// ============================================
// 常量
// ============================================

const PHASE_LABELS: Record<ClassificationPhase, string> = {
  sedimentation: "特征提取",
  clustering: "智能聚类",
  mapping: "文件夹映射",
  completed: "已完成",
  failed: "失败",
};

const PHASE_DESCRIPTIONS: Record<ClassificationPhase, string> = {
  sedimentation: "正在分析书签特征和关键词...",
  clustering: "正在发现书签之间的关联...",
  mapping: "正在匹配现有文件夹...",
  completed: "分类完成，等待确认",
  failed: "分类过程中出现错误",
};

// ============================================
// Props
// ============================================

interface ProgressIndicatorProps {
  transactionId: string;
  onComplete?: () => void;
  onError?: (error: string) => void;
  className?: string;
}

// ============================================
// 组件
// ============================================

export function ProgressIndicator({
  transactionId,
  onComplete,
  onError,
  className,
}: ProgressIndicatorProps) {
  const [progress, setProgress] = useState<ClassificationProgress | null>(null);
  const [isPolling, setIsPolling] = useState(true);

  // 轮询进度
  useEffect(() => {
    if (!isPolling) return;

    const pollProgress = async () => {
      try {
        const response = await fetch(
          `/api/batch-classification/${transactionId}/progress`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch progress");
        }

        const data = await response.json();
        setProgress(data);

        if (data.phase === "completed") {
          setIsPolling(false);
          onComplete?.();
        } else if (data.phase === "failed") {
          setIsPolling(false);
          onError?.(data.error?.message || "Unknown error");
        }
      } catch (error) {
        clientLogger.error({ error }, "Failed to poll progress:");
      }
    };

    pollProgress();
    const interval = setInterval(pollProgress, 2000);

    return () => clearInterval(interval);
  }, [transactionId, isPolling, onComplete, onError]);

  if (!progress) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">加载中...</span>
        </CardContent>
      </Card>
    );
  }

  const phases: ClassificationPhase[] = [
    "sedimentation",
    "clustering",
    "mapping",
  ];
  const currentPhaseIndex = phases.indexOf(
    progress.phase as ClassificationPhase,
  );

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {progress.phase === "completed" ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : progress.phase === "failed" ? (
            <Circle className="h-5 w-5 text-destructive" />
          ) : (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          )}
          {PHASE_LABELS[progress.phase]}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 总进度条 */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {PHASE_DESCRIPTIONS[progress.phase]}
            </span>
            <span className="font-medium">{progress.progress}%</span>
          </div>
          <Progress value={progress.progress} className="h-2" />
          {progress.estimatedRemainingSeconds > 0 && (
            <p className="text-xs text-muted-foreground">
              预计剩余时间: {formatTime(progress.estimatedRemainingSeconds)}
            </p>
          )}
        </div>

        {/* 阶段指示器 */}
        <div className="flex items-center justify-between">
          {phases.map((phase, index) => {
            const isCompleted =
              index < currentPhaseIndex || progress.phase === "completed";
            const isCurrent =
              index === currentPhaseIndex && progress.phase !== "completed";
            const isPending = index > currentPhaseIndex;

            return (
              <div key={phase} className="flex flex-col items-center gap-2">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2",
                    isCompleted && "border-green-500 bg-green-500 text-white",
                    isCurrent && "border-primary bg-primary/10",
                    isPending && "border-muted bg-muted",
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : isCurrent ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {index + 1}
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs",
                    isCompleted && "text-green-600",
                    isCurrent && "text-primary font-medium",
                    isPending && "text-muted-foreground",
                  )}
                >
                  {PHASE_LABELS[phase]}
                </span>
              </div>
            );
          })}
        </div>

        {/* 阶段详情 */}
        {progress.phaseDetails && (
          <div className="grid grid-cols-3 gap-4 text-sm">
            <PhaseDetailCard
              title="特征提取"
              detail={progress.phaseDetails.sedimentation}
              icon="📊"
            />
            <PhaseDetailCard
              title="智能聚类"
              detail={progress.phaseDetails.clustering}
              icon="🔗"
            />
            <PhaseDetailCard
              title="文件夹映射"
              detail={progress.phaseDetails.mapping}
              icon="📁"
            />
          </div>
        )}

        {/* 错误信息 */}
        {progress.error && (
          <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
            <p className="font-medium">错误</p>
            <p>{progress.error.message}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// 辅助组件
// ============================================

interface PhaseDetailCardProps {
  title: string;
  detail: {
    status: string;
    processed?: number;
    total?: number;
    clustersFound?: number;
    mapped?: number;
    created?: number;
  };
  icon: string;
}

function PhaseDetailCard({ title, detail, icon }: PhaseDetailCardProps) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-2 mb-2">
        <span>{icon}</span>
        <span className="font-medium">{title}</span>
      </div>
      <div className="text-xs text-muted-foreground space-y-1">
        {detail.processed !== undefined && detail.total !== undefined && (
          <p>
            已处理: {detail.processed} / {detail.total}
          </p>
        )}
        {detail.clustersFound !== undefined && (
          <p>发现簇: {detail.clustersFound}</p>
        )}
        {detail.mapped !== undefined && <p>已映射: {detail.mapped}</p>}
        {detail.created !== undefined && <p>新建: {detail.created}</p>}
      </div>
    </div>
  );
}

// ============================================
// 辅助函数
// ============================================

function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} 秒`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes} 分 ${remainingSeconds} 秒`;
}
