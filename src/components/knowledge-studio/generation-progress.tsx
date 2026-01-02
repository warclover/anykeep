"use client";

/**
 * Generation Progress - 生成进度组件
 * @module components/knowledge-studio
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import type { GenerationStage } from "@/lib/knowledge-studio";

interface GenerationProgressProps {
  stage: GenerationStage;
  stageProgress: number;
  totalProgress: number;
  className?: string;
}

const STAGE_CONFIG: Record<
  GenerationStage,
  {
    label: string;
    icon: string;
  }
> = {
  parsing: {
    label: "解析素材",
    icon: "📖",
  },
  outline: {
    label: "生成大纲",
    icon: "📝",
  },
  content: {
    label: "生成正文",
    icon: "✍️",
  },
  citations: {
    label: "提取引用",
    icon: "🔗",
  },
  finalizing: {
    label: "最终处理",
    icon: "✨",
  },
};

const STAGES: GenerationStage[] = [
  "parsing",
  "outline",
  "content",
  "citations",
  "finalizing",
];

export function GenerationProgress({
  stage,
  stageProgress,
  totalProgress,
  className,
}: GenerationProgressProps) {
  const currentStageIndex = useMemo(() => STAGES.indexOf(stage), [stage]);
  const stageConfig = STAGE_CONFIG[stage];

  return (
    <div className={cn("space-y-4", className)}>
      {/* Total Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">总进度</span>
          <span className="text-muted-foreground">{totalProgress}%</span>
        </div>
        <Progress value={totalProgress} className="h-2" />
      </div>

      {/* Stage Indicators */}
      <div className="flex items-center justify-between">
        {STAGES.map((s, index) => {
          const config = STAGE_CONFIG[s];
          const isCompleted = index < currentStageIndex;
          const isCurrent = index === currentStageIndex;
          const isPending = index > currentStageIndex;

          return (
            <div key={s} className="flex flex-col items-center">
              {/* Connector line */}
              {index > 0 && (
                <div
                  className={cn(
                    "absolute h-0.5 w-full -translate-y-3",
                    isCompleted ? "bg-primary" : "bg-muted",
                  )}
                  style={{
                    left: `${(index - 0.5) * (100 / (STAGES.length - 1))}%`,
                    width: `${100 / (STAGES.length - 1)}%`,
                  }}
                />
              )}

              {/* Stage circle */}
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm transition-all",
                  isCompleted && "bg-primary text-primary-foreground",
                  isCurrent &&
                    "bg-primary/20 ring-2 ring-primary ring-offset-2",
                  isPending && "bg-muted text-muted-foreground",
                )}
              >
                {isCompleted ? "✓" : config.icon}
              </div>

              {/* Stage label */}
              <span
                className={cn(
                  "mt-1 text-xs",
                  isCurrent
                    ? "font-medium text-primary"
                    : "text-muted-foreground",
                )}
              >
                {config.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Current Stage Detail */}
      <div className="rounded-lg bg-accent/50 p-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{stageConfig.icon}</span>
          <span className="font-medium">{stageConfig.label}</span>
          <span className="ml-auto text-sm text-muted-foreground">
            {stageProgress}%
          </span>
        </div>
        <Progress value={stageProgress} className="mt-2 h-1.5" />
      </div>
    </div>
  );
}
