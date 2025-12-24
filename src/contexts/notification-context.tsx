/**
 * AI 通知状态管理 Context
 *
 * 统一管理来自 AI Skills 和 Tools 的通知状态，
 * 连接 NotificationService 与前端 UI。
 *
 * @version 1.0.0
 * @since 2025-12-24
 *
 * @example
 * ```tsx
 * // 在应用中使用
 * function App() {
 *   return (
 *     <NotificationProvider>
 *       <YourComponents />
 *     </NotificationProvider>
 *   );
 * }
 *
 * // 在组件中消费
 * function MyComponent() {
 *   const { notifications, dismissNotification, clearAll } = useNotification();
 *
 *   return (
 *     <div>
 *       {notifications.map(n => (
 *         <Toast key={n.id} {...n} onClose={() => dismissNotification(n.id)} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */

"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { effectManager } from "@/lib/ai-skills/effects";
import type {
  NotificationLevel,
  NotificationEffect,
} from "@/lib/ai-skills/effects/types";
import { clientLogger } from "@/lib/client-logger";

// ============================================
// 类型定义
// ============================================

/**
 * 通知项
 */
export interface NotificationItem {
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
  /** 自动关闭时间（毫秒），0 表示不自动关闭 */
  autoCloseMs: number;
  /** 是否已读 */
  read: boolean;
}

/**
 * Context 值类型
 */
export interface NotificationContextValue {
  /** 当前通知列表（按时间倒序） */
  notifications: NotificationItem[];
  /** 未读通知数量 */
  unreadCount: number;
  /** 是否有未读通知 */
  hasUnread: boolean;

  /** 关闭/dismiss 单个通知 */
  dismissNotification: (id: string) => void;
  /** 标记通知为已读 */
  markAsRead: (id: string) => void;
  /** 标记所有通知为已读 */
  markAllAsRead: () => void;
  /** 清除所有通知 */
  clearAll: () => void;
  /** 手动添加通知（用于测试或自定义场景） */
  addNotification: (
    notification: Omit<NotificationItem, "id" | "createdAt" | "read">,
  ) => string;
}

// ============================================
// 常量定义
// ============================================

/** 最大通知数量 */
const MAX_NOTIFICATIONS = 50;

/** 默认自动关闭时间（毫秒） */
const DEFAULT_AUTO_CLOSE_MS = 5000;

// ============================================
// Context 创建
// ============================================

const NotificationContext = createContext<NotificationContextValue | null>(
  null,
);

// ============================================
// 工具函数
// ============================================

/**
 * 生成通知 ID
 */
function generateNotificationId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `ui_notif_${timestamp}_${random}`;
}

// ============================================
// Provider 组件
// ============================================

interface NotificationProviderProps {
  children: ReactNode;
  /** 是否启用自动关闭 */
  enableAutoClose?: boolean;
}

/**
 * 通知 Provider 组件
 *
 * 监听 EffectManager 的通知事件，管理通知列表状态
 */
export function NotificationProvider({
  children,
  enableAutoClose = true,
}: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  /**
   * 添加通知
   */
  const addNotification = useCallback(
    (
      notification: Omit<NotificationItem, "id" | "createdAt" | "read">,
    ): string => {
      const id = generateNotificationId();
      const newNotification: NotificationItem = {
        ...notification,
        id,
        createdAt: new Date(),
        read: false,
      };

      setNotifications((prev) => {
        // 添加到列表开头（最新的在前）
        const updated = [newNotification, ...prev];
        // 限制数量
        if (updated.length > MAX_NOTIFICATIONS) {
          return updated.slice(0, MAX_NOTIFICATIONS);
        }
        return updated;
      });

      clientLogger.debug(
        {
          notificationId: id,
          level: notification.level,
          title: notification.title,
        },
        "NotificationContext: Added notification",
      );

      // 自动关闭逻辑
      if (enableAutoClose && notification.autoCloseMs > 0) {
        setTimeout(() => {
          setNotifications((prev) => prev.filter((n) => n.id !== id));
        }, notification.autoCloseMs);
      }

      return id;
    },
    [enableAutoClose],
  );

  /**
   * 关闭单个通知
   */
  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    clientLogger.debug(
      { notificationId: id },
      "NotificationContext: Dismissed notification",
    );
  }, []);

  /**
   * 标记为已读
   */
  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  }, []);

  /**
   * 标记所有为已读
   */
  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  /**
   * 清除所有通知
   */
  const clearAll = useCallback(() => {
    setNotifications([]);
    clientLogger.debug("NotificationContext: Cleared all notifications");
  }, []);

  /**
   * 监听 EffectManager 的通知事件
   */
  useEffect(() => {
    const listenerId = effectManager.on<NotificationEffect>(
      "notification",
      async (effect) => {
        const { payload } = effect;

        clientLogger.debug(
          { notificationId: payload.id, level: payload.level },
          "NotificationContext: Received notification effect",
        );

        addNotification({
          level: payload.level,
          title: payload.title,
          message: payload.message,
          autoCloseMs: payload.autoCloseMs ?? DEFAULT_AUTO_CLOSE_MS,
        });
      },
    );

    clientLogger.info(
      "NotificationContext: Started listening to notification effects",
    );

    return () => {
      effectManager.off(listenerId);
      clientLogger.info(
        "NotificationContext: Stopped listening to notification effects",
      );
    };
  }, [addNotification]);

  // 计算派生状态
  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const hasUnread = unreadCount > 0;

  const value = useMemo<NotificationContextValue>(
    () => ({
      notifications,
      unreadCount,
      hasUnread,
      dismissNotification,
      markAsRead,
      markAllAsRead,
      clearAll,
      addNotification,
    }),
    [
      notifications,
      unreadCount,
      hasUnread,
      dismissNotification,
      markAsRead,
      markAllAsRead,
      clearAll,
      addNotification,
    ],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

// ============================================
// Hooks
// ============================================

/**
 * 使用通知 Context
 *
 * @throws 如果在 NotificationProvider 外部使用
 */
export function useNotification(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotification must be used within a NotificationProvider",
    );
  }
  return context;
}

/**
 * 安全获取通知上下文（不抛出错误）
 */
export function useSafeNotification(): NotificationContextValue | null {
  return useContext(NotificationContext);
}
