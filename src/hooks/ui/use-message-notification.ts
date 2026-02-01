/**
 * 消息通知 Hook
 * @description 统一管理消息分发、Toast/Modal 展示、未读数刷新
 * @version 2.0.0 - 重构：使用新通知系统
 */

"use client";

import { useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { NotificationPriority } from "@/lib/notifications";

// ============================================
// 类型定义
// ============================================

export type MessageLevel = NotificationPriority;

export interface MessageResult {
  success: boolean;
  messageId?: number;
  title?: string;
  content?: string;
  level: MessageLevel;
  actionUrl?: string;
  actionLabel?: string;
}

export interface UseMessageNotificationOptions {
  /** 是否自动刷新消息列表（仅在消息页生效） */
  autoRefreshList?: boolean;
  /** 去抖延迟（毫秒） */
  debounceMs?: number;
}

export interface UseMessageNotificationResult {
  /**
   * 分发消息通知
   * @description 自动处理 Toast/Modal 展示，并刷新未读数
   */
  dispatch: (result: MessageResult) => void;
  /**
   * 批量分发消息通知（仅刷新一次未读数）
   */
  dispatchBatch: (results: MessageResult[]) => void;
  /**
   * 显示成功 Toast
   */
  success: (title: string, description?: string) => void;
  /**
   * 显示错误 Toast
   */
  error: (title: string, description?: string) => void;
  /**
   * 显示信息 Toast
   */
  info: (title: string, description?: string) => void;
  /**
   * 显示警告 Toast
   */
  warning: (title: string, description?: string) => void;
  /**
   * 刷新未读数
   */
  refreshUnreadCount: () => void;
}

// ============================================
// 全局 Modal 处理器
// ============================================

type ModalHandler = (message: Record<string, unknown>) => void;
let globalModalHandler: ModalHandler | null = null;

/**
 * 注册全局 Modal 处理器
 * @description 在应用根组件中调用
 */
export function registerGlobalModalHandler(handler: ModalHandler): void {
  globalModalHandler = handler;
}

/**
 * 注销全局 Modal 处理器
 */
export function unregisterGlobalModalHandler(): void {
  globalModalHandler = null;
}

// ============================================
// 辅助函数
// ============================================

interface LevelConfig {
  showToast: boolean;
  showModal: boolean;
}

function getLevelConfig(level: MessageLevel): LevelConfig {
  const configs: Record<MessageLevel, LevelConfig> = {
    silent: { showToast: false, showModal: false },
    normal: { showToast: true, showModal: false },
    important: { showToast: true, showModal: false },
    critical: { showToast: true, showModal: true },
  };
  return configs[level] ?? configs.normal;
}

// ============================================
// Hook 实现
// ============================================

export function useMessageNotification(
  options: UseMessageNotificationOptions = {},
): UseMessageNotificationResult {
  const { autoRefreshList = true, debounceMs = 300 } = options;

  const pathname = usePathname();
  const queryClient = useQueryClient();

  // 去抖定时器
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 判断是否在通知页
  const isOnNotificationsPage =
    pathname === "/notifications" || pathname === "/messages";

  /**
   * 刷新未读数（去抖）
   */
  const refreshUnreadCount = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["notification-counts"] });
    }, debounceMs);
  }, [queryClient, debounceMs]);

  /**
   * 刷新通知列表
   */
  const refreshNotificationList = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }, [queryClient]);

  /**
   * 显示 Toast 通知
   */
  const showToast = useCallback(
    (
      title: string,
      content?: string,
      level: MessageLevel = "normal",
      actionUrl?: string,
      actionLabel?: string,
    ) => {
      const isImportant = level === "important" || level === "critical";
      const duration = isImportant ? 8000 : 4000;

      const toastOptions = {
        description: content,
        duration,
        action: actionUrl
          ? {
              label: actionLabel || "查看",
              onClick: () => {
                window.location.href = actionUrl;
              },
            }
          : undefined,
      };

      if (isImportant) {
        toast.warning(title, toastOptions);
      } else {
        toast.info(title, toastOptions);
      }
    },
    [],
  );

  /**
   * 显示 Modal 弹窗
   */
  const showModal = useCallback((result: MessageResult) => {
    if (globalModalHandler && result.title) {
      globalModalHandler({
        title: result.title,
        content: result.content,
        type: "system.announcement",
        level: result.level,
        action_url: result.actionUrl,
        action_label: result.actionLabel,
        status: "unread",
        id: result.messageId ?? 0,
      });
    }
  }, []);

  /**
   * 分发单条消息通知
   */
  const dispatch = useCallback(
    (result: MessageResult) => {
      // 失败的消息不处理
      if (!result.success) {
        return;
      }

      const config = getLevelConfig(result.level);

      // 显示 Toast
      if (config.showToast && result.title) {
        showToast(
          result.title,
          result.content,
          result.level,
          result.actionUrl,
          result.actionLabel,
        );
      }

      // 显示 Modal
      if (config.showModal) {
        showModal(result);
      }

      // 刷新未读数
      refreshUnreadCount();

      // 如果在通知页且启用自动刷新，刷新列表
      if (autoRefreshList && isOnNotificationsPage) {
        refreshNotificationList();
      }
    },
    [
      showToast,
      showModal,
      refreshUnreadCount,
      autoRefreshList,
      isOnNotificationsPage,
      refreshNotificationList,
    ],
  );

  /**
   * 批量分发消息通知
   */
  const dispatchBatch = useCallback(
    (results: MessageResult[]) => {
      const successResults = results.filter((r) => r.success);

      if (successResults.length === 0) {
        return;
      }

      // 仅显示第一条消息的 Toast，避免刷屏
      const firstResult = successResults[0];
      const config = getLevelConfig(firstResult.level);

      if (config.showToast && firstResult.title) {
        const batchSuffix =
          successResults.length > 1 ? ` (+${successResults.length - 1})` : "";
        showToast(
          firstResult.title + batchSuffix,
          firstResult.content,
          firstResult.level,
          firstResult.actionUrl,
          firstResult.actionLabel,
        );
      }

      // 检查是否有需要显示 Modal 的重要消息
      const importantResult = successResults.find((r) => {
        const cfg = getLevelConfig(r.level);
        return cfg.showModal;
      });
      if (importantResult) {
        showModal(importantResult);
      }

      // 刷新未读数（仅一次）
      refreshUnreadCount();

      // 刷新列表
      if (autoRefreshList && isOnNotificationsPage) {
        refreshNotificationList();
      }
    },
    [
      showToast,
      showModal,
      refreshUnreadCount,
      autoRefreshList,
      isOnNotificationsPage,
      refreshNotificationList,
    ],
  );

  // 便捷方法
  const success = useCallback((title: string, description?: string) => {
    toast.success(title, { description });
  }, []);

  const error = useCallback((title: string, description?: string) => {
    toast.error(title, { description });
  }, []);

  const info = useCallback((title: string, description?: string) => {
    toast.info(title, { description });
  }, []);

  const warning = useCallback((title: string, description?: string) => {
    toast.warning(title, { description });
  }, []);

  return {
    dispatch,
    dispatchBatch,
    success,
    error,
    info,
    warning,
    refreshUnreadCount,
  };
}
