/**
 * 导出进度条组件
 * 显示导出进度和支持取消操作
 */

"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { ExportProgress } from "@/lib/export/types";

interface ExportProgressBarProps {
  /** 进度数据 */
  progress: ExportProgress;
  /** 取消回调 */
  onCancel?: () => void;
  /** 是否显示取消按钮 */
  showCancel?: boolean;
  /** 样式类名 */
  className?: string;
}

export function ExportProgressBar({
  progress,
  onCancel,
  showCancel = true,
  className,
}: ExportProgressBarProps) {
  const { status, current, total, percentage, stage } = progress;

  // 根据状态显示不同的标题
  const getStatusText = () => {
    switch (status) {
      case "preparing":
        return "准备中...";
      case "exporting":
        return "正在导出...";
      case "success":
        return "导出完成！";
      case "failed":
        return "导出失败";
      case "cancelled":
        return "已取消";
      default:
        return "等待中";
    }
  };

  // 是否正在处理中
  const isProcessing = status === "preparing" || status === "exporting";

  return (
    <div className={cn("space-y-3", className)}>
      {/* 状态文本 */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{getStatusText()}</span>
        {showCancel && isProcessing && onCancel && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="h-7 px-2 text-muted-foreground hover:text-destructive"
          >
            <X className="size-4 mr-1" />
            取消
          </Button>
        )}
      </div>

      {/* 进度条 */}
      <Progress
        value={percentage}
        className={cn(
          "h-2",
          status === "success" && "[&>div]:bg-green-500",
          status === "failed" && "[&>div]:bg-destructive",
          status === "cancelled" && "[&>div]:bg-yellow-500",
        )}
      />

      {/* 进度详情 */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{stage || `已处理：${current} / ${total} 条`}</span>
        <span>{percentage}%</span>
      </div>
    </div>
  );
}
