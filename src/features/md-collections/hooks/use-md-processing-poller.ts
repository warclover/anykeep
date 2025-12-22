/**
 * MD 收藏处理状态轮询 Hook
 *
 * 对 pending/processing 状态的 MD 收藏进行定时轮询
 * 当处理完成后自动停止轮询并更新数据
 *
 * 参考: src/hooks/ui/use-processing-poller.ts (书签轮询)
 */

"use client";

import { useEffect, useRef, useCallback } from "react";
import type { MdCollection, MdProcessingStatus } from "../types";

// 轮询配置
const POLL_INTERVAL = 3000; // 3 秒轮询一次
const MAX_POLL_COUNT = 60; // 最多轮询 60 次（3 分钟）

/**
 * 判断 MD 收藏是否需要轮询
 */
function needsPolling(collection: MdCollection): boolean {
  return (
    collection.processing_status === "pending" ||
    collection.processing_status === "processing"
  );
}

/**
 * 判断 MD 收藏是否已完成处理
 */
function isCompleted(status: MdProcessingStatus): boolean {
  return status === "completed" || status === "failed";
}

interface UseMdProcessingPollerOptions {
  /** MD 收藏列表 */
  collections: MdCollection[];
  /** 更新单个收藏的回调 */
  onUpdate: (id: number, updates: Partial<MdCollection>) => void;
  /** 是否启用轮询（默认 true） */
  enabled?: boolean;
}

/**
 * MD 收藏处理状态轮询 Hook
 */
export function useMdProcessingPoller({
  collections,
  onUpdate,
  enabled = true,
}: UseMdProcessingPollerOptions) {
  // 轮询计数器（用于限制最大轮询次数）
  const pollCountRef = useRef<Map<number, number>>(new Map());

  /**
   * 执行轮询请求
   */
  const pollCollections = useCallback(
    async (ids: number[]) => {
      if (ids.length === 0) return;

      try {
        const response = await fetch(
          `/api/md-collections/batch-status?ids=${ids.join(",")}`,
          {
            credentials: "include",
          },
        );

        if (!response.ok) {
          return;
        }

        const result = await response.json();
        const updatedItems = result.data?.items as Array<{
          id: number;
          processing_status: MdProcessingStatus;
          ai_summary: string | null;
          ai_tags: string[] | null;
          processing_error: string | null;
          processed_at: string | null;
        }>;

        if (!updatedItems || updatedItems.length === 0) {
          return;
        }

        // 处理每个返回的收藏
        updatedItems.forEach((updated) => {
          // 更新数据
          onUpdate(updated.id, {
            processing_status: updated.processing_status,
            ai_summary: updated.ai_summary,
            ai_tags: updated.ai_tags,
            processing_error: updated.processing_error,
            processed_at: updated.processed_at,
          });

          // 检查是否已完成
          if (isCompleted(updated.processing_status)) {
            // 已完成，从轮询计数器中移除
            pollCountRef.current.delete(updated.id);
          } else {
            // 未完成，增加轮询计数
            const count = (pollCountRef.current.get(updated.id) || 0) + 1;
            pollCountRef.current.set(updated.id, count);

            // 超过最大轮询次数，停止轮询
            if (count >= MAX_POLL_COUNT) {
              pollCountRef.current.delete(updated.id);
            }
          }
        });
      } catch {
        // 静默处理错误，不影响用户体验
      }
    },
    [onUpdate],
  );

  /**
   * 设置轮询定时器
   */
  useEffect(() => {
    if (!enabled) return;

    // 找出需要轮询的收藏 ID
    const getPollingIds = () => {
      return collections
        .filter((c) => {
          // 需要轮询且未超过最大次数
          if (!needsPolling(c)) return false;
          const count = pollCountRef.current.get(c.id) || 0;
          return count < MAX_POLL_COUNT;
        })
        .map((c) => c.id);
    };

    // 检测是否有新加入的收藏需要轮询
    let hasNewPollingItems = false;
    collections.forEach((c) => {
      if (needsPolling(c) && !pollCountRef.current.has(c.id)) {
        pollCountRef.current.set(c.id, 0);
        hasNewPollingItems = true;
      }
    });

    // 检查是否有需要轮询的收藏
    const pollingIds = getPollingIds();

    // 如果没有需要轮询的收藏，不设置定时器
    if (pollingIds.length === 0) {
      return;
    }

    // 如果有新收藏加入，立即执行首次轮询（不等待 3 秒）
    if (hasNewPollingItems) {
      pollCollections(pollingIds);
    }

    // 设置定时器
    const intervalId = setInterval(() => {
      const ids = getPollingIds();
      if (ids.length > 0) {
        pollCollections(ids);
      } else {
        // 没有需要轮询的收藏，清除定时器
        clearInterval(intervalId);
      }
    }, POLL_INTERVAL);

    // 清理函数
    return () => {
      clearInterval(intervalId);
    };
  }, [collections, enabled, pollCollections]);

  // 组件卸载时清理
  useEffect(() => {
    const pollCountMap = pollCountRef.current;
    return () => {
      pollCountMap.clear();
    };
  }, []);
}
