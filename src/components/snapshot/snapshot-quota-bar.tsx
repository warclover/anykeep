/**
 * SnapshotQuotaBar Component (V4.2.1)
 * 快照配额进度条 - 显示用户的快照配额使用情况
 *
 * 功能：
 * - 显示已用/总配额
 * - 进度条可视化
 * - 配额告警提示
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { Camera, AlertTriangle, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { SnapshotQuota } from "@/lib/snapshot";

// ============================================================================
// 类型定义
// ============================================================================

export interface SnapshotQuotaBarProps {
  /** 预设的配额数据（可选，不传则自动获取） */
  quota?: SnapshotQuota;
  /** 是否显示图标 */
  showIcon?: boolean;
  /** 是否显示详细文本 */
  showDetails?: boolean;
  /** 显示模式 */
  mode?: "bar" | "compact" | "minimal";
  /** 自定义类名 */
  className?: string;
  /** 配额更新回调 */
  onQuotaUpdate?: (quota: SnapshotQuota) => void;
}

// 配额状态阈值
const QUOTA_WARNING_THRESHOLD = 0.8; // 80%
const QUOTA_DANGER_THRESHOLD = 0.95; // 95%

// ============================================================================
// 组件实现
// ============================================================================

export function SnapshotQuotaBar({
  quota: externalQuota,
  showIcon = true,
  showDetails = true,
  mode = "bar",
  className,
  onQuotaUpdate,
}: SnapshotQuotaBarProps) {
  const [quota, setQuota] = useState<SnapshotQuota | null>(
    externalQuota || null,
  );
  const [isLoading, setIsLoading] = useState(!externalQuota);
  const [error, setError] = useState<string | null>(null);

  // 加载配额数据
  const loadQuota = useCallback(async () => {
    if (externalQuota) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/snapshots/quota");
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || "获取配额失败");
      }

      setQuota(result.data);
      onQuotaUpdate?.(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取配额失败");
    } finally {
      setIsLoading(false);
    }
  }, [externalQuota, onQuotaUpdate]);

  // 初始加载
  useEffect(() => {
    loadQuota();
  }, [loadQuota]);

  // 同步外部配额
  useEffect(() => {
    if (externalQuota) {
      setQuota(externalQuota);
    }
  }, [externalQuota]);

  // 计算使用百分比
  const usagePercent = quota ? (quota.usedCount / quota.maxCount) * 100 : 0;

  // 确定状态颜色
  const getStatusColor = () => {
    if (usagePercent >= QUOTA_DANGER_THRESHOLD * 100) {
      return "text-red-500";
    }
    if (usagePercent >= QUOTA_WARNING_THRESHOLD * 100) {
      return "text-amber-500";
    }
    return "text-green-500";
  };

  const _getProgressColor = () => {
    if (usagePercent >= QUOTA_DANGER_THRESHOLD * 100) {
      return "bg-red-500";
    }
    if (usagePercent >= QUOTA_WARNING_THRESHOLD * 100) {
      return "bg-amber-500";
    }
    return "bg-primary";
  };

  // 加载中状态
  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">加载配额...</span>
      </div>
    );
  }

  // 错误状态
  if (error || !quota) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <AlertTriangle className="size-4 text-amber-500" />
        <span className="text-xs text-muted-foreground">
          {error || "无法获取配额"}
        </span>
      </div>
    );
  }

  // 最小模式 - 仅显示数字
  if (mode === "minimal") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn("text-xs font-medium", getStatusColor(), className)}
            >
              {quota.usedCount}/{quota.maxCount}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            已使用 {quota.usedCount} / {quota.maxCount} 个快照配额
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // 紧凑模式 - 图标 + 数字
  if (mode === "compact") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn("flex items-center gap-1.5", className)}>
              {showIcon && (
                <Camera className="size-3.5 text-muted-foreground" />
              )}
              <span className={cn("text-xs font-medium", getStatusColor())}>
                {quota.usedCount}/{quota.maxCount}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            <div className="space-y-1">
              <p>
                快照配额: {quota.usedCount} / {quota.maxCount}
              </p>
              {quota.canCreate ? (
                <p className="text-green-400">可继续创建快照</p>
              ) : (
                <p className="text-red-400">配额已满，请删除旧快照</p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // 完整模式 - 进度条
  return (
    <div className={cn("space-y-2", className)}>
      {/* 标题行 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {showIcon && <Camera className="size-4 text-muted-foreground" />}
          <span className="text-sm font-medium">快照配额</span>
        </div>
        <span className={cn("text-sm font-medium", getStatusColor())}>
          {quota.usedCount} / {quota.maxCount}
        </span>
      </div>

      {/* 进度条 */}
      <div className="relative">
        <Progress
          value={usagePercent}
          className={cn(
            "h-2",
            usagePercent >= QUOTA_DANGER_THRESHOLD * 100 &&
              "[&>div]:bg-red-500",
            usagePercent >= QUOTA_WARNING_THRESHOLD * 100 &&
              usagePercent < QUOTA_DANGER_THRESHOLD * 100 &&
              "[&>div]:bg-amber-500",
          )}
        />
      </div>

      {/* 详情文本 */}
      {showDetails && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {quota.canCreate
              ? `还可创建 ${quota.maxCount - quota.usedCount} 个快照`
              : "配额已满"}
          </span>
          {usagePercent >= QUOTA_WARNING_THRESHOLD * 100 && (
            <span className={getStatusColor()}>
              {usagePercent >= QUOTA_DANGER_THRESHOLD * 100
                ? "配额即将用尽"
                : "配额使用较多"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 导出
// ============================================================================

export default SnapshotQuotaBar;
