/**
 * SnapshotButton Component (V4.2.1)
 * 快照按钮组件 - 触发网页快照创建
 *
 * 功能：
 * - 创建网页快照
 * - 显示加载状态
 * - 错误处理与提示
 */

"use client";

import { useState, useCallback } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { SnapshotType } from "@/lib/snapshot";
import { API_SNAPSHOTS } from "@/lib/constants/api-paths";

// ============================================================================
// 类型定义
// ============================================================================

export interface SnapshotButtonProps {
  /** 书签 ID */
  bookmarkId: number;
  /** 书签 URL（用于显示） */
  url?: string;
  /** 快照类型 */
  snapshotType?: SnapshotType;
  /** 是否已有快照 */
  hasSnapshot?: boolean;
  /** 按钮变体 */
  variant?: "default" | "ghost" | "outline";
  /** 按钮尺寸 */
  size?: "default" | "sm" | "icon" | "icon-sm";
  /** 是否显示文字标签 */
  showLabel?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 禁用状态 */
  disabled?: boolean;
  /** 创建成功回调 */
  onSuccess?: (snapshotId: number) => void;
  /** 创建失败回调 */
  onError?: (error: string) => void;
}

// ============================================================================
// 组件实现
// ============================================================================

export function SnapshotButton({
  bookmarkId,
  url: _url,
  snapshotType = "basic",
  hasSnapshot = false,
  variant = "ghost",
  size = "icon-sm",
  showLabel = false,
  className,
  disabled = false,
  onSuccess,
  onError,
}: SnapshotButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  // 创建快照
  const handleCreateSnapshot = useCallback(async () => {
    if (isLoading || disabled) return;

    setIsLoading(true);

    try {
      const response = await fetch(API_SNAPSHOTS.list, {
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

        // 特殊处理配额超限
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
  }, [bookmarkId, snapshotType, isLoading, disabled, onSuccess, onError]);

  // 按钮内容
  const buttonContent = (
    <>
      {isLoading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Camera className="size-4" />
      )}
      {showLabel && <span>{hasSnapshot ? "更新快照" : "创建快照"}</span>}
    </>
  );

  // 提示文本
  const tooltipText = hasSnapshot
    ? "更新网页快照"
    : "保存网页快照，防止内容丢失";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size={size}
            onClick={handleCreateSnapshot}
            disabled={disabled || isLoading}
            className={cn(
              "text-muted-foreground hover:text-foreground",
              hasSnapshot && "text-primary",
              className,
            )}
            aria-label={tooltipText}
          >
            {buttonContent}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// 导出
// ============================================================================

export default SnapshotButton;
