/**
 * NotificationService - 统一通知服务
 *
 * 管理应用内通知的创建、分发和生命周期
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import { logger } from "@/lib/logger";
import type {
  EffectContext,
  NotificationEffect,
  NotificationLevel,
} from "../types";
import type { EffectManager } from "../effect-manager";
import { effectManager } from "../effect-manager";

// ============================================
// 类型定义
// ============================================

/**
 * 通知请求选项
 */
export interface NotificationRequestOptions {
  /** 通知级别 */
  level: NotificationLevel;
  /** 通知标题 */
  title: string;
  /** 通知消息 */
  message: string;
  /** 自动关闭时间（毫秒），0 表示不自动关闭 */
  autoCloseMs?: number;
  /** 用户 ID */
  userId?: string;
  /** Effect 上下文 */
  effectContext?: EffectContext;
}

/**
 * 服务配置
 */
export interface NotificationServiceConfig {
  /** 默认自动关闭时间（毫秒） */
  defaultAutoCloseMs: number;
  /** 最大通知数量 */
  maxNotifications: number;
  /** 是否自动发出 Effect */
  emitEffects: boolean;
}

/**
 * 通知记录
 */
export interface NotificationRecord {
  /** 通知 ID */
  id: string;
  /** 通知级别 */
  level: NotificationLevel;
  /** 通知标题 */
  title: string;
  /** 通知消息 */
  message: string;
  /** 创建时间 */
  createdAt: Date;
  /** 是否已读 */
  read: boolean;
  /** 是否已关闭 */
  closed: boolean;
  /** 用户 ID */
  userId?: string;
}

// ============================================
// 默认配置
// ============================================

const DEFAULT_CONFIG: NotificationServiceConfig = {
  defaultAutoCloseMs: 5000, // 5 秒
  maxNotifications: 50,
  emitEffects: true,
};

// ============================================
// NotificationService 实现
// ============================================

/**
 * 统一通知服务
 *
 * @example
 * ```typescript
 * const service = new NotificationService();
 *
 * // 发送成功通知
 * service.success('操作成功', '书签已删除');
 *
 * // 发送错误通知
 * service.error('操作失败', '删除书签时发生错误');
 *
 * // 发送自定义通知
 * service.notify({
 *   level: 'warning',
 *   title: '注意',
 *   message: '此操作不可撤销',
 *   autoCloseMs: 10000,
 * });
 * ```
 */
export class NotificationService {
  private config: NotificationServiceConfig;
  private effectManager: EffectManager;
  private notifications: Map<string, NotificationRecord>;

  constructor(
    config: Partial<NotificationServiceConfig> = {},
    manager?: EffectManager,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.effectManager = manager ?? effectManager;
    this.notifications = new Map();
  }

  /**
   * 发送通知
   */
  async notify(options: NotificationRequestOptions): Promise<string> {
    const id = this.generateId();
    const now = new Date();

    const record: NotificationRecord = {
      id,
      level: options.level,
      title: options.title,
      message: options.message,
      createdAt: now,
      read: false,
      closed: false,
      userId: options.userId,
    };

    // 添加到记录
    this.notifications.set(id, record);
    this.enforceLimit();

    logger.debug(
      { notificationId: id, level: options.level, title: options.title },
      "NotificationService: 发送通知",
    );

    // 发出 Effect
    if (this.config.emitEffects) {
      await this.emitNotificationEffect(record, options);
    }

    return id;
  }

  /**
   * 发送信息通知
   */
  async info(title: string, message: string): Promise<string> {
    return this.notify({ level: "info", title, message });
  }

  /**
   * 发送成功通知
   */
  async success(title: string, message: string): Promise<string> {
    return this.notify({ level: "success", title, message });
  }

  /**
   * 发送警告通知
   */
  async warning(title: string, message: string): Promise<string> {
    return this.notify({ level: "warning", title, message });
  }

  /**
   * 发送错误通知
   */
  async error(title: string, message: string): Promise<string> {
    return this.notify({ level: "error", title, message });
  }

  /**
   * 标记通知为已读
   */
  markAsRead(notificationId: string): boolean {
    const record = this.notifications.get(notificationId);
    if (record) {
      record.read = true;
      return true;
    }
    return false;
  }

  /**
   * 关闭通知
   */
  close(notificationId: string): boolean {
    const record = this.notifications.get(notificationId);
    if (record) {
      record.closed = true;
      return true;
    }
    return false;
  }

  /**
   * 获取通知
   */
  getNotification(notificationId: string): NotificationRecord | undefined {
    return this.notifications.get(notificationId);
  }

  /**
   * 获取用户的通知
   */
  getNotificationsByUser(userId: string): NotificationRecord[] {
    return Array.from(this.notifications.values())
      .filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * 获取未读通知
   */
  getUnreadNotifications(userId?: string): NotificationRecord[] {
    return Array.from(this.notifications.values())
      .filter((n) => !n.read && !n.closed && (!userId || n.userId === userId))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    total: number;
    unread: number;
    byLevel: Record<NotificationLevel, number>;
  } {
    const stats = {
      total: this.notifications.size,
      unread: 0,
      byLevel: { info: 0, success: 0, warning: 0, error: 0 } as Record<
        NotificationLevel,
        number
      >,
    };

    for (const notification of this.notifications.values()) {
      stats.byLevel[notification.level]++;
      if (!notification.read && !notification.closed) {
        stats.unread++;
      }
    }

    return stats;
  }

  /**
   * 清除所有通知
   */
  clearAll(): void {
    this.notifications.clear();
  }

  /**
   * 清除用户通知
   */
  clearByUser(userId: string): number {
    let cleared = 0;
    for (const [id, notification] of this.notifications.entries()) {
      if (notification.userId === userId) {
        this.notifications.delete(id);
        cleared++;
      }
    }
    return cleared;
  }

  // ============================================
  // 私有方法
  // ============================================

  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `notif_${timestamp}_${random}`;
  }

  private enforceLimit(): void {
    if (this.notifications.size > this.config.maxNotifications) {
      // 删除最旧的已关闭通知
      const sorted = Array.from(this.notifications.entries())
        .filter(([_, n]) => n.closed)
        .sort(
          ([_, a], [__, b]) => a.createdAt.getTime() - b.createdAt.getTime(),
        );

      for (const [id] of sorted.slice(
        0,
        this.notifications.size - this.config.maxNotifications,
      )) {
        this.notifications.delete(id);
      }
    }
  }

  private async emitNotificationEffect(
    record: NotificationRecord,
    options: NotificationRequestOptions,
  ): Promise<void> {
    const effect: NotificationEffect = {
      type: "notification",
      payload: {
        id: record.id,
        level: record.level,
        title: record.title,
        message: record.message,
        autoCloseMs: options.autoCloseMs ?? this.config.defaultAutoCloseMs,
      },
      context: options.effectContext ?? {
        requestId: record.id,
        userId: record.userId ?? "unknown",
        mode: "atomic",
        source: "skill",
      },
    };

    await this.effectManager.emitNotification(effect);
  }
}

// ============================================
// 工厂函数和单例
// ============================================

/**
 * 创建通知服务
 */
export function createNotificationService(
  config?: Partial<NotificationServiceConfig>,
  manager?: EffectManager,
): NotificationService {
  return new NotificationService(config, manager);
}

/**
 * 默认通知服务实例
 */
export const notificationService = new NotificationService();
