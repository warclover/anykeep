/**
 * 重要消息弹窗组件
 * @description 用于展示 L3 级别（重要/紧急）消息，需要用户确认后才能关闭
 */

"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Info, AlertCircle, Bell } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Message } from "@/lib/messages";

// ============================================
// 类型定义
// ============================================

export interface MessageModalProps {
  /** 要显示的消息 */
  message: Message | null;
  /** 弹窗开关状态 */
  open: boolean;
  /** 状态变更回调 */
  onOpenChange: (open: boolean) => void;
  /** 操作按钮点击回调 */
  onAction?: () => void;
  /** 标记已读回调 */
  onMarkAsRead?: (messageId: number) => Promise<boolean>;
}

// ============================================
// 辅助函数
// ============================================

/**
 * 根据消息类型判断是否为警告类型
 */
function isWarningType(type: string): boolean {
  return type.includes("warning") || type.includes("critical");
}

/**
 * 根据消息类型判断是否为危险类型
 */
function isDangerType(type: string): boolean {
  return type.includes("exceeded") || type.includes("failed");
}

/**
 * 根据消息类型判断是否为系统公告类型
 */
function isAnnouncementType(type: string): boolean {
  return (
    type.includes("announcement") ||
    type.includes("maintenance") ||
    type.includes("update")
  );
}

/**
 * 获取图标类型
 */
function getIconType(
  type: string,
): "danger" | "warning" | "announcement" | "default" {
  if (isDangerType(type)) return "danger";
  if (isWarningType(type)) return "warning";
  if (isAnnouncementType(type)) return "announcement";
  return "default";
}

/**
 * 消息图标组件 - 静态声明避免在 render 中创建
 */
function MessageIcon({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  const iconType = getIconType(type);
  switch (iconType) {
    case "danger":
      return <AlertCircle className={className} />;
    case "warning":
      return <AlertTriangle className={className} />;
    case "announcement":
      return <Info className={className} />;
    default:
      return <Bell className={className} />;
  }
}

/**
 * 获取图标样式
 */
function getIconStyles(type: string): { bg: string; icon: string } {
  if (isDangerType(type)) {
    return {
      bg: "bg-red-100 dark:bg-red-900/30",
      icon: "text-red-600 dark:text-red-400",
    };
  }
  if (isWarningType(type)) {
    return {
      bg: "bg-orange-100 dark:bg-orange-900/30",
      icon: "text-orange-600 dark:text-orange-400",
    };
  }
  if (isAnnouncementType(type)) {
    return {
      bg: "bg-blue-100 dark:bg-blue-900/30",
      icon: "text-blue-600 dark:text-blue-400",
    };
  }
  return {
    bg: "bg-gray-100 dark:bg-gray-800",
    icon: "text-gray-600 dark:text-gray-400",
  };
}

// ============================================
// 组件实现
// ============================================

export function MessageModal({
  message,
  open,
  onOpenChange,
  onAction,
  onMarkAsRead,
}: MessageModalProps) {
  const router = useRouter();

  // 处理关闭弹窗
  const handleClose = useCallback(async () => {
    if (message && onMarkAsRead) {
      await onMarkAsRead(message.id);
    }
    onOpenChange(false);
  }, [message, onMarkAsRead, onOpenChange]);

  // 处理操作按钮点击
  const handleAction = useCallback(async () => {
    if (message && onMarkAsRead) {
      await onMarkAsRead(message.id);
    }
    if (onAction) {
      onAction();
    } else if (message?.action_url) {
      router.push(message.action_url);
    }
    onOpenChange(false);
  }, [message, onMarkAsRead, onAction, router, onOpenChange]);

  // 无消息时不渲染
  if (!message) {
    return null;
  }

  // 获取图标样式
  const iconStyles = getIconStyles(message.type);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-full", iconStyles.bg)}>
              <MessageIcon
                type={message.type}
                className={cn("size-5", iconStyles.icon)}
              />
            </div>
            <DialogTitle className="text-lg">{message.title}</DialogTitle>
          </div>
        </DialogHeader>

        <DialogDescription className="py-4">
          <p className="text-muted-foreground leading-relaxed">
            {message.content}
          </p>
        </DialogDescription>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            稍后处理
          </Button>
          {message.action_url && (
            <Button onClick={handleAction}>
              {message.action_label || "立即处理"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
