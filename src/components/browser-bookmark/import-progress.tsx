"use client";

import { Loader2, CheckCircle, XCircle, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { ImportProgress as ImportProgressType } from "@/lib/browser-bookmark";

interface ImportProgressProps {
  progress: ImportProgressType;
  onCancel?: () => void;
}

export function ImportProgress({ progress, onCancel }: ImportProgressProps) {
  const {
    totalBookmarks,
    totalBatches,
    currentBatch,
    batchProgress: _batchProgress,
    totalSuccess,
    totalFailed,
    totalSkipped,
    currentItem,
    status,
    errorMessage,
  } = progress;
  void _batchProgress; // suppress unused variable warning

  // 计算总进度百分比
  const progressPercent =
    totalBookmarks > 0
      ? Math.round(
          ((totalSuccess + totalFailed + totalSkipped) / totalBookmarks) * 100,
        )
      : 0;

  const isImporting = status === "importing";
  const isParsing = status === "parsing";
  const isCompleted = status === "completed";
  const isError = status === "error";

  return (
    <div className="space-y-6">
      {/* 状态标题 */}
      <div className="flex items-center gap-3">
        {(isImporting || isParsing) && (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        )}
        {isCompleted && <CheckCircle className="h-5 w-5 text-green-500" />}
        {isError && <XCircle className="h-5 w-5 text-destructive" />}
        <span className="text-lg font-medium">
          {isParsing && "正在解析书签文件..."}
          {isImporting && "正在导入书签..."}
          {isCompleted && "导入完成"}
          {isError && "导入出错"}
        </span>
      </div>

      {/* 进度条 */}
      {(isImporting || isParsing) && (
        <div className="space-y-2">
          <Progress value={progressPercent} className="h-2" />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{progressPercent}%</span>
            {totalBatches > 1 && (
              <span>
                批次 {currentBatch}/{totalBatches}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 当前处理项 */}
      {currentItem && isImporting && (
        <div className="text-sm text-muted-foreground truncate">
          当前: {currentItem}
        </div>
      )}

      {/* 统计信息 */}
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-1.5">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span>成功: {totalSuccess}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <XCircle className="h-4 w-4 text-destructive" />
          <span>失败: {totalFailed}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <SkipForward className="h-4 w-4 text-amber-500" />
          <span>跳过: {totalSkipped}</span>
        </div>
      </div>

      {/* 错误信息 */}
      {errorMessage && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      {/* 取消按钮 */}
      {isImporting && onCancel && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={onCancel}>
            取消导入
          </Button>
        </div>
      )}
    </div>
  );
}
