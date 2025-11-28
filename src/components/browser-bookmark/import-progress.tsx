"use client";

import {
  Loader2,
  CheckCircle,
  XCircle,
  SkipForward,
  Pause,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { ImportProgress as ImportProgressType } from "@/lib/browser-bookmark";

interface ImportProgressProps {
  progress: ImportProgressType;
  onCancel?: () => void;
  /** 暂停回调 */
  onPause?: () => void;
  /** 继续回调 */
  onResume?: () => void;
  /** 是否已暂停 */
  isPaused?: boolean;
}

export function ImportProgress({
  progress,
  onCancel,
  onPause,
  onResume,
  isPaused = false,
}: ImportProgressProps) {
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
        {(isImporting || isParsing) && !isPaused && (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        )}
        {isPaused && <Pause className="h-5 w-5 text-amber-500" />}
        {isCompleted && <CheckCircle className="h-5 w-5 text-green-500" />}
        {isError && <XCircle className="h-5 w-5 text-destructive" />}
        <span className="text-lg font-medium">
          {isParsing && "正在解析书签文件..."}
          {isImporting && !isPaused && "正在导入书签..."}
          {isImporting && isPaused && "导入已暂停"}
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

      {/* 操作按钮 */}
      {isImporting && (
        <div className="flex justify-end gap-2">
          {/* 暂停/继续按钮 */}
          {!isPaused && onPause && (
            <Button variant="outline" onClick={onPause}>
              <Pause className="h-4 w-4 mr-1" />
              暂停
            </Button>
          )}
          {isPaused && onResume && (
            <Button variant="outline" onClick={onResume}>
              <Play className="h-4 w-4 mr-1" />
              继续
            </Button>
          )}
          {/* 取消按钮 */}
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              取消导入
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
