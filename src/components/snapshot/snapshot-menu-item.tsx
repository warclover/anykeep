/**
 * SnapshotMenuItem Component (V4.2.1)
 * 快照菜单项组件 - 用于书签卡片下拉菜单
 *
 * 功能：
 * - 创建快照（无快照时）
 * - 查看快照（有快照时）
 * - 显示处理状态
 * - 错误重试
 */

"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Eye, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { SnapshotType } from "@/lib/snapshot";

// ============================================================================
// 类型定义
// ============================================================================

export type SnapshotStatusValue =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | null;

export interface SnapshotMenuItemProps {
  /** 书签 ID */
  bookmarkId: number;
  /** 书签 URL */
  bookmarkUrl: string;
  /** 是否已有快照 */
  hasSnapshot?: boolean;
  /** 快照状态 */
  snapshotStatus?: SnapshotStatusValue;
  /** 快照类型 */
  snapshotType?: SnapshotType;
  /** 创建成功回调 */
  onSuccess?: (snapshotId: number) => void;
  /** 创建失败回调 */
  onError?: (error: string) => void;
  /** 自定义类名 */
  className?: string;
}

// ============================================================================
// 组件实现
// ============================================================================

export function SnapshotMenuItem({
  bookmarkId,
  bookmarkUrl: _bookmarkUrl,
  hasSnapshot = false,
  snapshotStatus = null,
  snapshotType = "standard",
  onSuccess,
  onError,
  className,
}: SnapshotMenuItemProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  // 是否正在处理中
  const isProcessing =
    snapshotStatus === "pending" || snapshotStatus === "processing";
  const isFailed = snapshotStatus === "failed";
  const isCompleted = snapshotStatus === "completed" || hasSnapshot;

  // 创建快照
  const handleCreateSnapshot = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (isLoading || isProcessing) return;

      setIsLoading(true);

      try {
        const response = await fetch("/api/snapshots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookmarkId,
            snapshotType,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          const errorMessage = result.error?.message || "创建快照失败";

          if (result.error?.code === "QUOTA_EXCEEDED") {
            toast.error("快照配额已满", {
              description: "请删除一些旧快照后重试",
            });
          } else if (result.error?.code === "SNAPSHOT_EXISTS") {
            toast.info("快照已存在", {
              description: "该书签已有有效快照",
            });
          } else {
            toast.error("创建快照失败", {
              description: errorMessage,
            });
          }

          onError?.(errorMessage);
          return;
        }

        toast.success("快照任务已创建", {
          description: "后台正在处理，稍后可查看",
        });

        onSuccess?.(result.data.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : "网络请求失败";
        toast.error("请求失败", { description: message });
        onError?.(message);
      } finally {
        setIsLoading(false);
      }
    },
    [bookmarkId, snapshotType, isLoading, isProcessing, onSuccess, onError],
  );

  // 查看快照
  const handleViewSnapshot = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // 导航到书签详情页（快照区块会自动显示）
      router.push(`/bookmark/${bookmarkId}#snapshot`);
    },
    [bookmarkId, router],
  );

  // 重试失败的快照
  const handleRetry = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // 重试等同于重新创建
      await handleCreateSnapshot(e);
    },
    [handleCreateSnapshot],
  );

  // 渲染图标
  const renderIcon = () => {
    if (isLoading) {
      return <Loader2 className="mr-2 h-4 w-4 animate-spin" />;
    }
    if (isProcessing) {
      return <Loader2 className="mr-2 h-4 w-4 animate-spin text-blue-500" />;
    }
    if (isFailed) {
      return <AlertCircle className="mr-2 h-4 w-4 text-red-500" />;
    }
    if (isCompleted) {
      return <Eye className="mr-2 h-4 w-4 text-green-500" />;
    }
    return <Camera className="mr-2 h-4 w-4" />;
  };

  // 渲染文本
  const renderLabel = () => {
    if (isLoading) return "创建中...";
    if (isProcessing) return "处理中...";
    if (isFailed) return "重试快照";
    if (isCompleted) return "查看快照";
    return "创建快照";
  };

  // 点击处理
  const handleClick = (e: React.MouseEvent) => {
    if (isCompleted && !isFailed) {
      handleViewSnapshot(e);
    } else if (isFailed) {
      handleRetry(e);
    } else {
      handleCreateSnapshot(e);
    }
  };

  return (
    <DropdownMenuItem
      onClick={handleClick}
      disabled={isLoading || isProcessing}
      className={cn(
        isProcessing && "text-blue-600 dark:text-blue-400",
        isFailed && "text-red-600 dark:text-red-400",
        isCompleted && !isFailed && "text-green-600 dark:text-green-400",
        className,
      )}
    >
      {renderIcon()}
      {renderLabel()}
    </DropdownMenuItem>
  );
}

// ============================================================================
// 导出
// ============================================================================

export default SnapshotMenuItem;
