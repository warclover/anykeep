/**
 * 消息通知 Provider
 * @description 提供全局消息通知能力，使用新的通知系统
 * @version 2.0.0 - 重构：使用新通知系统
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { MessageModal } from "./message-modal";
import {
  registerGlobalModalHandler,
  unregisterGlobalModalHandler,
} from "@/hooks/ui";
import { createClient } from "@/lib/supabase/client";
import type { Notification as _Notification } from "@/lib/notifications";

// ============================================
// 类型定义
// ============================================

export interface MessageNotificationProviderProps {
  children: React.ReactNode;
}

// 兼容旧 Message 类型的接口
interface LegacyMessage {
  id: number;
  user_id: string;
  type: string;
  level: string;
  title: string;
  content: string | null;
  action_url: string | null;
  action_label: string | null;
  status: string;
  priority: number;
  created_at: string;
  read_at: string | null;
  expires_at?: string;
  metadata: Record<string, unknown>;
  related_bookmark_id: string | null;
  related_folder_id: string | null;
  related_import_id: string | null;
}

// ============================================
// 组件实现
// ============================================

export function MessageNotificationProvider({
  children,
}: MessageNotificationProviderProps) {
  const [modalMessage, setModalMessage] = useState<LegacyMessage | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // 消息队列（处理多个重要消息）
  const [messageQueue, setMessageQueue] = useState<LegacyMessage[]>([]);

  // Modal 处理器
  const handleShowModal = useCallback((message: Partial<LegacyMessage>) => {
    const fullMessage: LegacyMessage = {
      id: message.id ?? 0,
      user_id: "",
      type: message.type ?? "system.announcement",
      level: message.level ?? "important",
      title: message.title ?? "",
      content: message.content ?? null,
      action_url: message.action_url ?? null,
      action_label: message.action_label ?? null,
      status: message.status ?? "unread",
      priority: message.priority ?? 8,
      created_at: message.created_at ?? new Date().toISOString(),
      read_at: null,
      expires_at: undefined,
      metadata: message.metadata ?? {},
      related_bookmark_id: message.related_bookmark_id ?? null,
      related_folder_id: message.related_folder_id ?? null,
      related_import_id: null,
    };

    setMessageQueue((prev) => [...prev, fullMessage]);
  }, []);

  // 注册全局处理器
  useEffect(() => {
    registerGlobalModalHandler(handleShowModal);
    return () => {
      unregisterGlobalModalHandler();
    };
  }, [handleShowModal]);

  // 处理消息队列（使用 queueMicrotask 避免级联渲染）
  useEffect(() => {
    if (!modalOpen && messageQueue.length > 0) {
      const [nextMessage, ...rest] = messageQueue;
      // 延迟到下一个微任务执行，避免同步 setState 导致级联渲染
      queueMicrotask(() => {
        setModalMessage(nextMessage);
        setModalOpen(true);
        setMessageQueue(rest);
      });
    }
  }, [modalOpen, messageQueue]);

  // 关闭 Modal 时的回调
  const handleOpenChange = useCallback((open: boolean) => {
    setModalOpen(open);
    if (!open) {
      // 延迟清理，让动画完成
      setTimeout(() => {
        setModalMessage(null);
      }, 200);
    }
  }, []);

  // 标记已读回调（使用新的通知系统）
  const handleMarkAsRead = useCallback(
    async (messageId: number): Promise<boolean> => {
      if (!messageId) return true;

      try {
        const supabase = createClient();
        const { error } = await supabase
          .from("user_notifications")
          .update({ status: "read", read_at: new Date().toISOString() })
          .eq("id", String(messageId));

        return !error;
      } catch {
        return false;
      }
    },
    [],
  );

  return (
    <>
      {children}
      <MessageModal
        message={modalMessage}
        open={modalOpen}
        onOpenChange={handleOpenChange}
        onMarkAsRead={handleMarkAsRead}
      />
    </>
  );
}
