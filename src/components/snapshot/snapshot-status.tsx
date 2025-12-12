/**
 * SnapshotStatus Component (V4.2.1)
 * 快照状态指示器 - 显示快照的当前处理状态
 *
 * 状态说明：
 * - pending: 等待处理
 * - processing: 正在处理
 * - completed: 处理完成
 * - failed: 处理失败
 * - expired: 已过期
 */

"use client";

import { useMemo } from "react";
import {
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { SnapshotStatus as SnapshotStatusType } from "@/lib/snapshot";

// ============================================================================
// 类型定义
// ============================================================================

export interface SnapshotStatusProps {
  /** 快照状态 */
  status: SnapshotStatusType;
  /** 错误信息（失败时显示） */
  errorMessage?: string | null;
  /** 捕获时间 */
  capturedAt?: string | null;
  /** 显示模式 */
  mode?: "icon" | "badge" | "text";
  /** 尺寸 */
  size?: "sm" | "md";
  /** 自定义类名 */
  className?: string;
}

// 状态配置
const STATUS_CONFIG: Record<
  SnapshotStatusType,
  {
    label: string;
    icon: typeof Clock;
    colorClass: string;
    bgClass: string;
    borderClass: string;
  }
> = {
  pending: {
    label: "等待处理",
    icon: Clock,
    colorClass: "text-amber-500",
    bgClass: "bg-amber-50 dark:bg-amber-950/30",
    borderClass: "border-amber-200 dark:border-amber-800",
  },
  processing: {
    label: "正在处理",
    icon: Loader2,
    colorClass: "text-blue-500",
    bgClass: "bg-blue-50 dark:bg-blue-950/30",
    borderClass: "border-blue-200 dark:border-blue-800",
  },
  completed: {
    label: "快照就绪",
    icon: CheckCircle2,
    colorClass: "text-green-500",
    bgClass: "bg-green-50 dark:bg-green-950/30",
    borderClass: "border-green-200 dark:border-green-800",
  },
  failed: {
    label: "处理失败",
    icon: XCircle,
    colorClass: "text-red-500",
    bgClass: "bg-red-50 dark:bg-red-950/30",
    borderClass: "border-red-200 dark:border-red-800",
  },
  expired: {
    label: "已过期",
    icon: AlertCircle,
    colorClass: "text-gray-400",
    bgClass: "bg-gray-50 dark:bg-gray-900/50",
    borderClass: "border-gray-200 dark:border-gray-700",
  },
};

// ============================================================================
// 组件实现
// ============================================================================

export function SnapshotStatus({
  status,
  errorMessage,
  capturedAt,
  mode = "icon",
  size = "md",
  className,
}: SnapshotStatusProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  // 格式化捕获时间
  const formattedTime = useMemo(() => {
    if (!capturedAt) return null;
    try {
      const date = new Date(capturedAt);
      return date.toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return null;
    }
  }, [capturedAt]);

  // 提示文本
  const tooltipText = useMemo(() => {
    let text = config.label;
    if (status === "completed" && formattedTime) {
      text += ` · ${formattedTime}`;
    }
    if (status === "failed" && errorMessage) {
      text += `: ${errorMessage}`;
    }
    return text;
  }, [status, config.label, formattedTime, errorMessage]);

  // 图标尺寸
  const iconSize = size === "sm" ? "size-3.5" : "size-4";

  // 仅图标模式
  if (mode === "icon") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn("inline-flex items-center", className)}>
              <Icon
                className={cn(
                  iconSize,
                  config.colorClass,
                  status === "processing" && "animate-spin",
                )}
              />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs max-w-xs">
            {tooltipText}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // 徽章模式
  if (mode === "badge") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border",
                size === "sm" ? "text-xs" : "text-sm",
                config.bgClass,
                config.borderClass,
                className,
              )}
            >
              <Icon
                className={cn(
                  iconSize,
                  config.colorClass,
                  status === "processing" && "animate-spin",
                )}
              />
              <span className={config.colorClass}>{config.label}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs max-w-xs">
            {tooltipText}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // 文本模式
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        size === "sm" ? "text-xs" : "text-sm",
        config.colorClass,
        className,
      )}
    >
      <Icon
        className={cn(iconSize, status === "processing" && "animate-spin")}
      />
      <span>{config.label}</span>
      {status === "completed" && formattedTime && (
        <span className="text-muted-foreground">· {formattedTime}</span>
      )}
    </span>
  );
}

// ============================================================================
// 导出
// ============================================================================

export default SnapshotStatus;
