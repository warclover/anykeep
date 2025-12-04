"use client";

/**
 * 智能轮询 Hook
 * 对 PROCESSING 状态或"正在获取标题..."的书签进行定时轮询
 * 当数据更新完成后自动停止轮询该书签
 *
 * 性能优化：
 * - 仅轮询需要更新的书签
 * - 使用批量查询减少请求次数
 * - 书签完成后自动移除轮询列表
 * - 无需轮询时不发送请求
 */

import { useEffect, useRef, useCallback } from "react";
import type { Bookmark } from "@/types/supabase";

// 扩展的书签类型（包含文件夹信息）
type BookmarkWithFolder = Bookmark & {
  folders?: { name: string } | null;
};

// 轮询配置
const POLL_INTERVAL = 3000; // 3 秒轮询一次
const MAX_POLL_COUNT = 60; // 最多轮询 60 次（3 分钟）

/**
 * 判断书签是否需要轮询
 */
function needsPolling(bookmark: BookmarkWithFolder): boolean {
  return (
    bookmark.status === "PROCESSING" || bookmark.title === "正在获取标题..."
  );
}

/**
 * 判断书签是否已完成处理
 */
function isCompleted(bookmark: BookmarkWithFolder): boolean {
  return (
    bookmark.status !== "PROCESSING" && bookmark.title !== "正在获取标题..."
  );
}

interface UseProcessingPollerOptions {
  /** 书签列表 */
  bookmarks: BookmarkWithFolder[];
  /** 更新单个书签的回调 */
  onUpdate: (updatedBookmark: BookmarkWithFolder) => void;
  /** 是否启用轮询（默认 true） */
  enabled?: boolean;
}

/**
 * 智能轮询 Hook
 */
export function useProcessingPoller({
  bookmarks,
  onUpdate,
  enabled = true,
}: UseProcessingPollerOptions) {
  // 轮询计数器（用于限制最大轮询次数）
  const pollCountRef = useRef<Map<number, number>>(new Map());

  // 上一次轮询的 ID 列表（用于检测变化）
  const lastPollIdsRef = useRef<string>("");

  /**
   * 执行轮询请求
   */
  const pollBookmarks = useCallback(
    async (ids: number[]) => {
      if (ids.length === 0) return;

      try {
        const response = await fetch(
          `/api/bookmarks/batch-status?ids=${ids.join(",")}`,
          {
            credentials: "include",
          },
        );

        if (!response.ok) {
          return;
        }

        const { data } = await response.json();
        const updatedBookmarks = data?.bookmarks as BookmarkWithFolder[];

        if (!updatedBookmarks || updatedBookmarks.length === 0) {
          return;
        }

        // 处理每个返回的书签
        updatedBookmarks.forEach((updated) => {
          // 检查是否已完成
          if (isCompleted(updated)) {
            // 已完成，触发更新回调
            onUpdate(updated);
            // 从轮询计数器中移除
            pollCountRef.current.delete(updated.id);
          } else {
            // 未完成，增加轮询计数
            const count = (pollCountRef.current.get(updated.id) || 0) + 1;
            pollCountRef.current.set(updated.id, count);

            // 超过最大轮询次数，停止轮询该书签
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

    // 找出需要轮询的书签 ID
    const getPollingIds = () => {
      return bookmarks
        .filter((b) => {
          // 需要轮询且未超过最大次数
          if (!needsPolling(b)) return false;
          const count = pollCountRef.current.get(b.id) || 0;
          return count < MAX_POLL_COUNT;
        })
        .map((b) => b.id);
    };

    // 初始化轮询计数器（新加入的书签）
    bookmarks.forEach((b) => {
      if (needsPolling(b) && !pollCountRef.current.has(b.id)) {
        pollCountRef.current.set(b.id, 0);
      }
    });

    // 检查是否有需要轮询的书签
    const pollingIds = getPollingIds();
    const pollingIdsStr = pollingIds.join(",");

    // 如果没有需要轮询的书签，不设置定时器
    if (pollingIds.length === 0) {
      lastPollIdsRef.current = "";
      return;
    }

    // 如果轮询列表没有变化，且已有定时器在运行，跳过
    if (pollingIdsStr === lastPollIdsRef.current) {
      return;
    }

    lastPollIdsRef.current = pollingIdsStr;

    // 设置定时器
    const intervalId = setInterval(() => {
      const ids = getPollingIds();
      if (ids.length > 0) {
        pollBookmarks(ids);
      } else {
        // 没有需要轮询的书签，清除定时器
        clearInterval(intervalId);
        lastPollIdsRef.current = "";
      }
    }, POLL_INTERVAL);

    // 清理函数
    return () => {
      clearInterval(intervalId);
    };
  }, [bookmarks, enabled, pollBookmarks]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      pollCountRef.current.clear();
      lastPollIdsRef.current = "";
    };
  }, []);
}
