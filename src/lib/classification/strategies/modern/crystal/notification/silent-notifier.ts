/**
 * V5.5 静默通知类型定义
 */

export interface SilentNotification {
  type: "success" | "info" | "warning";
  message: string;
  duration?: number; // 毫秒，默认 3000
  action?: {
    label: string;
    href: string;
  };
}

/**
 * V5.5 静默通知器
 *
 * 生成静默通知配置
 * 特点：不打断用户，右下角轻提示，自动消失
 */
export class SilentNotifier {
  /**
   * 根据动作生成通知配置
   */
  createNotification(params: {
    action: string;
    folderName?: string;
    count?: number;
    reason?: string;
  }): SilentNotification | null {
    switch (params.action) {
      case "CRYSTALLIZED":
        return {
          type: "success",
          message: `已创建「${params.folderName}」，收录 ${params.count} 条内容`,
          duration: 3000,
          action: {
            label: "查看",
            href: `/folders?highlight=${encodeURIComponent(params.folderName || "")}`,
          },
        };

      case "QUOTA_BLOCKED":
        return {
          type: "info",
          message: params.reason || "智能分类已暂停",
          duration: 5000,
          action: {
            label: "整理",
            href: "/folders?action=cleanup",
          },
        };

      default:
        return null; // 静默，无通知
    }
  }
}
