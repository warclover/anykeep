/**
 * AI 进度指示器组件
 *
 * 用于显示编排模式的执行进度
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import { memo } from "react";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import type { ProgressInfo } from "./types";

interface AIProgressIndicatorProps {
  /** 进度信息 */
  progress: ProgressInfo;
  /** 自定义类名 */
  className?: string;
}

/**
 * AI 进度指示器
 *
 * 显示编排 Skill 的执行进度，包括：
 * - 总体进度条
 * - 当前步骤名称
 * - 步骤进度 (如 2/5)
 */
export const AIProgressIndicator = memo(function AIProgressIndicator({
  progress,
  className,
}: AIProgressIndicatorProps) {
  const { step, percent, message, stepIndex, totalSteps } = progress;

  const isCompleted = percent >= 100;

  return (
    <div
      className={`rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50 p-3 ${className || ""}`}
    >
      {/* 步骤信息 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isCompleted ? (
            <CheckCircle2 className="size-4 text-green-500" />
          ) : (
            <Loader2 className="size-4 text-purple-500 animate-spin" />
          )}
          <span className="text-sm font-medium text-gray-700">{step}</span>
        </div>
        {typeof stepIndex === "number" && typeof totalSteps === "number" && (
          <span className="text-xs text-gray-500">
            步骤 {stepIndex + 1}/{totalSteps}
          </span>
        )}
      </div>

      {/* 进度条 */}
      <Progress value={percent} className="h-1.5 bg-purple-100" />

      {/* 进度消息 */}
      {message && <p className="mt-2 text-xs text-gray-500">{message}</p>}

      {/* 百分比 */}
      <div className="mt-1 text-right">
        <span className="text-xs font-medium text-purple-600">
          {Math.round(percent)}%
        </span>
      </div>
    </div>
  );
});

/**
 * 简化版进度指示器（用于内联显示）
 */
export const AIProgressIndicatorInline = memo(
  function AIProgressIndicatorInline({ progress }: { progress: ProgressInfo }) {
    const { step, percent } = progress;
    const isCompleted = percent >= 100;

    return (
      <div className="flex items-center gap-2 text-sm text-gray-600">
        {isCompleted ? (
          <CheckCircle2 className="size-3.5 text-green-500" />
        ) : (
          <Loader2 className="size-3.5 text-purple-500 animate-spin" />
        )}
        <span>{step}</span>
        <span className="text-xs text-gray-400">({Math.round(percent)}%)</span>
      </div>
    );
  },
);

/**
 * 步骤列表显示组件
 */
export const AIStepsList = memo(function AIStepsList({
  currentStep,
  totalSteps,
  completedSteps,
  stepNames,
}: {
  currentStep: number;
  totalSteps: number;
  completedSteps: number;
  stepNames?: string[];
}) {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: totalSteps }).map((_, index) => {
        const isCompleted = index < completedSteps;
        const isCurrent = index === currentStep;
        const stepName = stepNames?.[index] || `步骤 ${index + 1}`;

        return (
          <div
            key={index}
            className={`flex items-center gap-2 text-sm ${
              isCompleted
                ? "text-green-600"
                : isCurrent
                  ? "text-purple-600 font-medium"
                  : "text-gray-400"
            }`}
          >
            {isCompleted ? (
              <CheckCircle2 className="size-4" />
            ) : isCurrent ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Circle className="size-4" />
            )}
            <span>{stepName}</span>
          </div>
        );
      })}
    </div>
  );
});
