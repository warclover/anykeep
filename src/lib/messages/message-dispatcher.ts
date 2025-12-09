/**
 * 消息分发器
 * @description 前端使用，根据消息等级决定展示方式（Toast/Modal）
 */

"use client";

import { toast } from "sonner";
import type { Message, MessageLevel, MessageResult } from "./types";
import { getLevelConfig } from "./message-levels";

// ============================================
// 类型定义
// ============================================

export interface DispatchMessage {
  title: string;
  content?: string;
  level: MessageLevel;
  actionUrl?: string;
  actionLabel?: string;
}

type ModalHandler = (message: Message | DispatchMessage) => void;

// ============================================
// MessageDispatcher 类
// ============================================

export class MessageDispatcher {
  private static modalHandler: ModalHandler | null = null;

  /**
   * 注册 Modal 展示回调
   * @description 在应用根组件中调用，注册显示 Modal 的方法
   */
  static registerModalHandler(handler: ModalHandler): void {
    this.modalHandler = handler;
  }

  /**
   * 注销 Modal 展示回调
   */
  static unregisterModalHandler(): void {
    this.modalHandler = null;
  }

  /**
   * 分发消息展示
   * @description 根据消息等级决定是否显示 Toast 和 Modal
   */
  static dispatch(message: DispatchMessage): void {
    const config = getLevelConfig(message.level);

    // Toast 展示
    if (config.showToast) {
      this.showToast(message);
    }

    // Modal 展示
    if (config.showModal && this.modalHandler) {
      this.modalHandler(message as Message);
    }
  }

  /**
   * 从 MessageResult 分发消息
   * @description 用于服务端返回后在前端展示
   */
  static dispatchFromResult(result: MessageResult): void {
    if (!result.success || !result.title) {
      return;
    }

    this.dispatch({
      title: result.title,
      content: result.content,
      level: result.level,
      actionUrl: result.actionUrl,
      actionLabel: result.actionLabel,
    });
  }

  /**
   * 显示 Toast 通知
   */
  private static showToast(message: DispatchMessage): void {
    const isImportant = message.level === "important";
    const duration = isImportant ? 8000 : 4000;

    // 根据等级选择 Toast 类型
    if (isImportant) {
      // 重要消息使用 warning 样式
      toast.warning(message.title, {
        description: message.content,
        duration,
        action: message.actionUrl
          ? {
              label: message.actionLabel || "查看",
              onClick: () => {
                window.location.href = message.actionUrl!;
              },
            }
          : undefined,
      });
    } else {
      // 普通消息使用 info 样式
      toast.info(message.title, {
        description: message.content,
        duration,
        action: message.actionUrl
          ? {
              label: message.actionLabel || "查看",
              onClick: () => {
                window.location.href = message.actionUrl!;
              },
            }
          : undefined,
      });
    }
  }

  /**
   * 显示成功 Toast
   */
  static success(title: string, description?: string): void {
    toast.success(title, { description });
  }

  /**
   * 显示错误 Toast
   */
  static error(title: string, description?: string): void {
    toast.error(title, { description });
  }

  /**
   * 显示普通 Toast
   */
  static info(title: string, description?: string): void {
    toast.info(title, { description });
  }

  /**
   * 显示警告 Toast
   */
  static warning(title: string, description?: string): void {
    toast.warning(title, { description });
  }
}

// ============================================
// React Hook 用于注册 Modal Handler
// ============================================

import { useEffect, useCallback } from "react";

/**
 * 注册消息 Modal 处理器的 Hook
 * @param handler Modal 展示回调函数
 */
export function useMessageModalHandler(
  handler: (message: Message | DispatchMessage) => void,
): void {
  const stableHandler = useCallback(
    (msg: Message | DispatchMessage) => handler(msg),
    [handler],
  );

  useEffect(() => {
    MessageDispatcher.registerModalHandler(stableHandler);
    return () => {
      MessageDispatcher.unregisterModalHandler();
    };
  }, [stableHandler]);
}
