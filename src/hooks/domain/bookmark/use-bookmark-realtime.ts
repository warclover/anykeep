"use client";

/**
 * Bookmark Realtime Hook
 *
 * 订阅书签状态变更的实时更新
 * Phase 2: 异步任务队列配套功能
 *
 * @module hooks/domain/bookmark
 * @version 1.0.0
 */

import { useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { clientLogger } from "@/lib/client-logger";
import type { Bookmark } from "@/types/supabase";

// ============================================================================
// Types
// ============================================================================

/** 书签状态 */
type BookmarkStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "EMBEDDING_DONE"
  | "FAILED";

/** 状态变更回调 */
export interface BookmarkStatusChange {
  /** 新书签数据 */
  bookmark: Partial<Bookmark>;
  /** 旧状态 */
  oldStatus: BookmarkStatus | null;
  /** 新状态 */
  newStatus: BookmarkStatus;
}

/** Hook 配置选项 */
export interface UseBookmarkRealtimeOptions {
  /** 用户 ID */
  userId: string;
  /** 数据刷新回调（当书签状态变更时触发） */
  onRefetch?: () => void;
  /** 自定义状态变更处理 */
  onStatusChange?: (change: BookmarkStatusChange) => void;
  /** 是否显示 toast 通知（默认 true） */
  showToast?: boolean;
  /** 是否启用（默认 true） */
  enabled?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** 频道名称 */
const CHANNEL_NAME = "bookmark-status-updates";

/** 状态显示名称 */
const STATUS_LABELS: Record<BookmarkStatus, string> = {
  PENDING: "等待处理",
  PROCESSING: "处理中",
  COMPLETED: "处理完成",
  EMBEDDING_DONE: "向量生成完成",
  FAILED: "处理失败",
};

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * 书签实时更新 Hook
 *
 * 监听 Supabase Realtime 的书签状态变更，提供：
 * - 状态变更 toast 通知
 * - 自动触发数据刷新
 * - 自定义状态变更处理
 *
 * @example
 * ```tsx
 * // 基础用法
 * useBookmarkRealtime({
 *   userId: user.id,
 *   onRefetch: refetchBookmarks,
 * });
 *
 * // 高级用法
 * useBookmarkRealtime({
 *   userId: user.id,
 *   onRefetch: refetchBookmarks,
 *   onStatusChange: ({ bookmark, newStatus }) => {
 *     if (newStatus === "COMPLETED") {
 *       // 自定义处理逻辑
 *     }
 *   },
 * });
 * ```
 */
export function useBookmarkRealtime({
  userId,
  onRefetch,
  onStatusChange,
  showToast = true,
  enabled = true,
}: UseBookmarkRealtimeOptions) {
  // 使用 ref 保存回调，避免频繁重连
  const onRefetchRef = useRef(onRefetch);
  const onStatusChangeRef = useRef(onStatusChange);

  // 更新 refs
  useEffect(() => {
    onRefetchRef.current = onRefetch;
    onStatusChangeRef.current = onStatusChange;
  }, [onRefetch, onStatusChange]);

  /**
   * 处理状态变更通知
   */
  const handleStatusChange = useCallback(
    (change: BookmarkStatusChange) => {
      const { bookmark, oldStatus, newStatus } = change;
      const title = bookmark.title || "书签";

      // 显示 toast 通知
      if (showToast) {
        // 处理完成
        if (
          oldStatus === "PENDING" &&
          (newStatus === "COMPLETED" || newStatus === "EMBEDDING_DONE")
        ) {
          toast.success(`"${title}" ${STATUS_LABELS[newStatus]}`);
        }
        // 从处理中变为完成
        else if (
          oldStatus === "PROCESSING" &&
          (newStatus === "COMPLETED" || newStatus === "EMBEDDING_DONE")
        ) {
          toast.success(`"${title}" ${STATUS_LABELS[newStatus]}`);
        }
        // 处理失败
        else if (newStatus === "FAILED") {
          toast.error(`"${title}" ${STATUS_LABELS[newStatus]}`);
        }
      }

      // 调用自定义处理
      onStatusChangeRef.current?.(change);

      // 触发数据刷新
      onRefetchRef.current?.();
    },
    [showToast],
  );

  /**
   * 订阅 Realtime 频道
   */
  useEffect(() => {
    if (!enabled || !userId) {
      return;
    }

    const supabase = createClient();

    // 创建频道并订阅
    const channel = supabase
      .channel(`${CHANNEL_NAME}-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "bookmarks",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newBookmark = payload.new as Partial<Bookmark> & {
            status?: BookmarkStatus;
          };
          const oldBookmark = payload.old as Partial<Bookmark> & {
            status?: BookmarkStatus;
          };

          // 仅处理状态变更
          if (newBookmark.status && newBookmark.status !== oldBookmark.status) {
            handleStatusChange({
              bookmark: newBookmark,
              oldStatus: (oldBookmark.status as BookmarkStatus) || null,
              newStatus: newBookmark.status as BookmarkStatus,
            });
          }
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // 订阅成功，静默处理
        } else if (status === "CHANNEL_ERROR") {
          // 订阅失败，记录日志
          clientLogger.warn(
            { channel: `${CHANNEL_NAME}-${userId}` },
            "Channel error, will retry...",
          );
        }
      });

    // 清理函数
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, enabled, handleStatusChange]);
}

/**
 * 获取状态显示标签
 */
export function getStatusLabel(status: BookmarkStatus): string {
  return STATUS_LABELS[status] || status;
}
