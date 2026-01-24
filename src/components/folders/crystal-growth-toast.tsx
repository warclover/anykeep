/**
 * V5.5 晶体生长 Toast 通知组件
 *
 * 静默通知 Toast
 * 特点：不打断用户，右下角轻提示，自动消失
 */

"use client";

import { toast } from "sonner";
import { FolderPlus, Sparkles, AlertCircle } from "lucide-react";
import type { SilentNotification } from "@/lib/classification/strategies/modern/crystal/notification";

/**
 * 显示晶体生长相关的静默通知
 */
export function showCrystalGrowthToast(notification: SilentNotification) {
  const icons = {
    success: <FolderPlus className="h-4 w-4 text-green-500" />,
    info: <Sparkles className="h-4 w-4 text-blue-500" />,
    warning: <AlertCircle className="h-4 w-4 text-amber-500" />,
  };

  const Icon = icons[notification.type];

  toast(notification.message, {
    icon: Icon,
    duration: notification.duration || 3000,
    position: "bottom-right",
    action: notification.action
      ? {
          label: notification.action.label,
          onClick: () => {
            if (notification.action?.href) {
              window.location.href = notification.action.href;
            }
          },
        }
      : undefined,
  });
}

/**
 * 显示文件夹创建成功通知
 */
export function showFolderCreatedToast(folderName: string, count: number) {
  showCrystalGrowthToast({
    type: "success",
    message: `已创建「${folderName}」，收录 ${count} 条内容`,
    duration: 3000,
    action: {
      label: "查看",
      href: `/folders?highlight=${encodeURIComponent(folderName)}`,
    },
  });
}

/**
 * 显示配额警告通知
 */
export function showQuotaWarningToast(reason: string) {
  showCrystalGrowthToast({
    type: "info",
    message: reason,
    duration: 5000,
    action: {
      label: "整理",
      href: "/folders?action=cleanup",
    },
  });
}
