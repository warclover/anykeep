/**
 * 消息通知 Hook
 * @description 统一管理消息分发、Toast/Modal 展示、未读数刷新
 * @solution 解决消息分发链路断裂问题
 */

"use client";

import { useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSWRConfig } from "swr";
import { toast } from "sonner";
import type { MessageResult, MessageLevel, Message } from "@/lib/messages";
import { getLevelConfig } from "@/lib/messages";

// ============================================
// 类型定义
// ============================================

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

type ModalHandler = (message: Partial<Message>) => void;
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
// Hook 实现
// ============================================

export function useMessageNotification(
  options: UseMessageNotificationOptions = {},
): UseMessageNotificationResult {
  const { autoRefreshList = true, debounceMs = 300 } = options;

  const pathname = usePathname();
  const { mutate } = useSWRConfig();

  // 去抖定时器
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 判断是否在消息页
  const isOnMessagesPage = pathname === "/messages";

  /**
   * 刷新未读数（去抖）
   */
  const refreshUnreadCount = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      mutate("/api/messages/unread-count");
    }, debounceMs);
  }, [mutate, debounceMs]);

  /**
   * 刷新消息列表
   */
  const refreshMessageList = useCallback(() => {
    // 使用正则匹配所有消息列表 key
    mutate(
      (key: string) =>
        typeof key === "string" && key.startsWith("/api/messages?"),
    );
  }, [mutate]);

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
      const isImportant = level === "important";
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
        type: "system_announcement", // 默认类型
        level: result.level,
        action_url: result.actionUrl,
        action_label: result.actionLabel,
        status: "unread",
        id: result.messageId ?? 0,
      } as Message);
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

      // 如果在消息页且启用自动刷新，刷新列表
      if (autoRefreshList && isOnMessagesPage) {
        refreshMessageList();
      }
    },
    [
      showToast,
      showModal,
      refreshUnreadCount,
      autoRefreshList,
      isOnMessagesPage,
      refreshMessageList,
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
      if (autoRefreshList && isOnMessagesPage) {
        refreshMessageList();
      }
    },
    [
      showToast,
      showModal,
      refreshUnreadCount,
      autoRefreshList,
      isOnMessagesPage,
      refreshMessageList,
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
