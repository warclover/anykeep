"use client";

/**
 * 整理执行进度组件
 *
 * 展示整理操作的实时执行进度
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import { Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OrganizeProgressProps, OperationStatus } from "./types";

// ============================================
// 常量定义
// ============================================

const PROGRESS_STRINGS = {
  executing: "执行中...",
  completed: "已完成",
  cancelButton: "取消",
  stepProgress: (current: number, total: number) =>
    `${current} / ${total} 完成`,
} as const;

// ============================================
// 状态图标组件
// ============================================

function StatusIcon({
  status,
  className,
}: {
  status: OperationStatus;
  className?: string;
}) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className={cn("text-green-500", className)} />;
    case "failed":
      return <XCircle className={cn("text-red-500", className)} />;
    case "executing":
      return (
        <Loader2 className={cn("animate-spin text-blue-500", className)} />
      );
    case "skipped":
      return <AlertCircle className={cn("text-gray-400", className)} />;
    default:
      return <div className={cn("rounded-full bg-gray-200", className)} />;
  }
}

// ============================================
// 主组件
// ============================================

/**
 * 整理执行进度组件
 */
export function OrganizeProgress({
  progress,
  onCancel,
  className,
}: OrganizeProgressProps) {
  const hasError = progress.results.some((r) => r.status === "failed");
  const completedCount = progress.results.filter(
    (r) => r.status === "completed",
  ).length;

  return (
    <div className={cn("p-6 space-y-4", className)}>
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <h3 className="font-semibold">{PROGRESS_STRINGS.executing}</h3>
        </div>
        {progress.cancelable && onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {PROGRESS_STRINGS.cancelButton}
          </Button>
        )}
      </div>

      {/* 进度条 */}
      <Progress value={progress.percent} className="h-2" />

      {/* 进度文本 */}
      <div className="text-sm text-muted-foreground text-center">
        {PROGRESS_STRINGS.stepProgress(
          completedCount,
          progress.totalOperations,
        )}
      </div>

      {/* 当前操作 */}
      <div className="flex items-center justify-center gap-2 text-sm">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>{progress.currentOperationName}</span>
      </div>

      {/* 已完成的操作列表 */}
      {progress.results.length > 0 && (
        <div className="space-y-2 mt-4">
          {progress.results.map((result, index) => (
            <div
              key={result.operationId}
              className={cn(
                "flex items-center justify-between text-sm p-2 rounded-md",
                result.status === "completed" &&
                  "bg-green-50 dark:bg-green-900/10",
                result.status === "failed" && "bg-red-50 dark:bg-red-900/10",
              )}
            >
              <div className="flex items-center gap-2">
                <StatusIcon status={result.status} className="w-4 h-4" />
                <span>操作 {index + 1}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                {result.status === "completed" && (
                  <span>影响 {result.affectedCount} 条</span>
                )}
                {result.status === "failed" && (
                  <span className="text-red-500">{result.error}</span>
                )}
                <span>{result.duration}ms</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 错误提示 */}
      {hasError && (
        <div className="text-sm text-red-500 text-center mt-2">
          部分操作执行失败，可在完成后查看详情
        </div>
      )}
    </div>
  );
}

/**
 * 内联进度指示器（用于消息流中）
 */
export function OrganizeProgressInline({
  progress,
  className,
}: Omit<OrganizeProgressProps, "onCancel">) {
  return (
    <div className={cn("border rounded-lg p-4 bg-muted/30", className)}>
      <div className="flex items-center gap-2 mb-3">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        <span className="text-sm font-medium">
          {progress.currentOperationName}
        </span>
      </div>
      <Progress value={progress.percent} className="h-1.5" />
      <div className="text-xs text-muted-foreground mt-2 text-center">
        {PROGRESS_STRINGS.stepProgress(
          progress.currentIndex,
          progress.totalOperations,
        )}
      </div>
    </div>
  );
}
