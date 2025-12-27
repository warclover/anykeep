/**
 * MD 阅读进度组件
 * Spec: md-reader-upgrade / REQ-4
 */

"use client";

import { memo, useCallback } from "react";
import { Clock, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WithClassName } from "../../types/reader";

/**
 * 完成阈值百分比
 */
const COMPLETION_THRESHOLD = 95;

/**
 * ReadingProgress Props
 */
export interface ReadingProgressProps extends WithClassName {
  /** 当前进度百分比 (0-100) */
  progress: number;
  /** 剩余阅读时间（分钟） */
  remainingMinutes: number;
  /** 是否显示进度条 */
  showProgressBar?: boolean;
  /** 进度条颜色（CSS color） */
  progressColor?: string;
  /** 阅读完成回调 */
  onComplete?: () => void;
}

/**
 * 格式化剩余时间文本
 */
function formatRemainingTime(minutes: number): string {
  if (minutes <= 0) {
    return "阅读完成";
  }
  if (minutes < 1) {
    return "即将读完";
  }
  return `约 ${minutes} 分钟`;
}

/**
 * 格式化进度文本
 */
function formatProgressText(
  progress: number,
  remainingMinutes: number,
): string {
  const percent = Math.round(progress);

  if (percent >= COMPLETION_THRESHOLD) {
    return "阅读完成 ✓";
  }

  const timeText = formatRemainingTime(remainingMinutes);
  return `${percent}% · ${timeText}`;
}

/**
 * 阅读进度组件
 *
 * 功能：
 * - 显示进度百分比和剩余时间
 * - 格式："50% · 约 3 分钟"
 * - 即将完成时显示："即将读完"
 * - 完成时显示："阅读完成 ✓"
 *
 * @example
 * ```tsx
 * <ReadingProgress
 *   progress={50}
 *   remainingMinutes={3}
 *   showProgressBar
 *   onComplete={() => markAsRead()}
 * />
 * ```
 */
export const ReadingProgress = memo(function ReadingProgress({
  progress,
  remainingMinutes,
  showProgressBar = false,
  progressColor = "#00324D",
  className,
  onComplete,
}: ReadingProgressProps) {
  // 是否已完成
  const isCompleted = progress >= COMPLETION_THRESHOLD;

  // 完成时触发回调
  const handleComplete = useCallback(() => {
    if (isCompleted && onComplete) {
      onComplete();
    }
  }, [isCompleted, onComplete]);

  // 首次完成时触发
  if (isCompleted) {
    handleComplete();
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* 图标 */}
      {isCompleted ? (
        <CheckCircle className="size-4 text-green-500" />
      ) : (
        <Clock className="size-4 text-gray-400" />
      )}

      {/* 进度文本 */}
      <span
        className={cn(
          "text-sm",
          isCompleted
            ? "text-green-600 dark:text-green-400 font-medium"
            : "text-gray-500 dark:text-gray-400",
        )}
      >
        {formatProgressText(progress, remainingMinutes)}
      </span>

      {/* 可选进度条 */}
      {showProgressBar && (
        <div className="flex-1 min-w-[60px] max-w-[120px] h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${Math.min(100, progress)}%`,
              backgroundColor: isCompleted ? "#22c55e" : progressColor,
            }}
          />
        </div>
      )}
    </div>
  );
});

/**
 * 紧凑版阅读进度（仅显示百分比）
 */
export function ReadingProgressCompact({
  progress,
  className,
}: {
  progress: number;
  className?: string;
}) {
  const isCompleted = progress >= COMPLETION_THRESHOLD;

  return (
    <span
      className={cn(
        "text-xs tabular-nums",
        isCompleted
          ? "text-green-600 dark:text-green-400"
          : "text-gray-500 dark:text-gray-400",
        className,
      )}
    >
      {isCompleted ? "✓" : `${Math.round(progress)}%`}
    </span>
  );
}

export default ReadingProgress;
