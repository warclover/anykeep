"use client";

/**
 * 智能轮询 Hook
 * V4.2.21: 修复轮询定时器丢失问题
 * V4.2.25: 修复中间状态不更新问题 - 每次轮询都更新数据
 * V4.2.26: 新增首次立即轮询，避免新书签等待 3 秒才更新
 * V4.2.30: 新增页面可见性检测，后台时暂停轮询节省资源
 *
 * 对 PROCESSING 状态或"正在获取标题..."的书签进行定时轮询
 * 当数据更新完成后自动停止轮询该书签
 *
 * 性能优化：
 * - 仅轮询需要更新的书签
 * - 使用批量查询减少请求次数
 * - 书签完成后自动移除轮询列表
 * - 无需轮询时不发送请求
 * - 首次检测到新书签时立即轮询
 * - 页面不可见时暂停轮询，可见时立即恢复
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { API_PATHS } from "@/lib/constants/api-paths";
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

  // V4.2.30: 页面可见性状态
  const [isPageVisible, setIsPageVisible] = useState(true);

  // V4.2.30: 监听页面可见性变化
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(document.visibilityState === "visible");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  /**
   * 执行轮询请求
   */
  const pollBookmarks = useCallback(
    async (ids: number[]) => {
      if (ids.length === 0) return;

      try {
        const response = await fetch(
          `${API_PATHS.bookmarks.batchStatus}?ids=${ids.join(",")}`,
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
          // V4.2.25: 无论是否完成，都更新数据（修复中间状态卡片不更新问题）
          // 这样标题抓取完成后，卡片会立即显示新标题和封面
          onUpdate(updated);

          // 检查是否已完成
          if (isCompleted(updated)) {
            // 已完成，从轮询计数器中移除
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
   * V4.2.21: 移除错误的"跳过"逻辑，确保每次 effect 执行都正确设置定时器
   * V4.2.26: 新增首次立即轮询，检测到新书签后立即执行一次轮询
   * V4.2.30: 页面不可见时暂停轮询，可见时立即恢复并执行一次轮询
   */
  useEffect(() => {
    // V4.2.30: 页面不可见或未启用时不轮询
    if (!enabled || !isPageVisible) return;

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

    // V4.2.26: 检测是否有新加入的书签需要轮询
    let hasNewPollingBookmarks = false;
    bookmarks.forEach((b) => {
      if (needsPolling(b) && !pollCountRef.current.has(b.id)) {
        pollCountRef.current.set(b.id, 0);
        hasNewPollingBookmarks = true;
      }
    });

    // 检查是否有需要轮询的书签
    const pollingIds = getPollingIds();

    // 如果没有需要轮询的书签，不设置定时器
    if (pollingIds.length === 0) {
      return;
    }

    // V4.2.26: 如果有新书签加入，立即执行首次轮询（不等待 3 秒）
    // V4.2.30: 页面从不可见变为可见时，也立即执行一次轮询
    if (hasNewPollingBookmarks) {
      pollBookmarks(pollingIds);
    }

    // V4.2.21: 移除了错误的跳过逻辑
    // 旧代码会在 pollingIds 相同时直接 return，但此时 useEffect 的清理函数
    // 已经清除了旧定时器，导致没有任何定时器在运行

    // 设置定时器
    const intervalId = setInterval(() => {
      const ids = getPollingIds();
      if (ids.length > 0) {
        pollBookmarks(ids);
      } else {
        // 没有需要轮询的书签，清除定时器
        clearInterval(intervalId);
      }
    }, POLL_INTERVAL);

    // 清理函数
    return () => {
      clearInterval(intervalId);
    };
  }, [bookmarks, enabled, isPageVisible, pollBookmarks]);

  // 组件卸载时清理
  useEffect(() => {
    const pollCountMap = pollCountRef.current;
    return () => {
      pollCountMap.clear();
    };
  }, []);
}
