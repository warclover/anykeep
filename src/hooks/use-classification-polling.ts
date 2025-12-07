/**
 * V3 分类结果轮询 Hook
 * 用于监听书签分类完成状态，替代 V1 的前端主动调用方案
 *
 * 特性：
 * - 追踪待分类书签
 * - 轮询 batch-status API 获取分类状态
 * - 分类完成后显示正确的结果通知
 * - 自动停止轮询（无待分类书签时）
 *
 * V3.2 修复：
 * - 添加并发执行锁，防止多个轮询同时运行
 * - 添加已通知书签追踪，防止重复显示通知
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { ClassificationResultData } from "@/types/supabase";

// 轮询间隔（毫秒）
const POLLING_INTERVAL = 2000;

// 最大轮询次数（防止无限轮询）
const MAX_POLL_COUNT = 30; // 最多 60 秒

interface PendingBookmark {
  id: number;
  pollCount: number;
}

interface UseClassificationPollingReturn {
  /** 追踪待分类的书签 */
  trackBookmark: (bookmarkId: number) => void;
  /** 当前待分类书签数量 */
  pendingCount: number;
  /** 是否正在轮询 */
  isPolling: boolean;
}

export function useClassificationPolling(): UseClassificationPollingReturn {
  const router = useRouter();
  const [pendingBookmarks, setPendingBookmarks] = useState<PendingBookmark[]>(
    [],
  );
  const [isPolling, setIsPolling] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // V3.2: 添加并发执行锁，防止多个轮询同时运行
  const isPollingInProgress = useRef(false);

  // V3.2: 追踪已通知的书签 ID，防止重复通知
  const notifiedIds = useRef<Set<number>>(new Set());

  /**
   * 追踪待分类的书签
   */
  const trackBookmark = useCallback((bookmarkId: number) => {
    // V3.2: 从已通知集合中移除（允许重新通知）
    notifiedIds.current.delete(bookmarkId);

    setPendingBookmarks((prev) => {
      // 避免重复追踪
      if (prev.some((b) => b.id === bookmarkId)) {
        return prev;
      }
      return [...prev, { id: bookmarkId, pollCount: 0 }];
    });
  }, []);

  /**
   * 显示分类完成通知
   */
  const showClassificationNotification = useCallback(
    (result: ClassificationResultData | null) => {
      if (!result) return;

      switch (result.action) {
        case "classify":
          toast.success(`已自动归类到「${result.folderName}」`, {
            icon: "✨",
            description: `AI 智能分类 (${result.confidence}% 置信度)`,
          });
          break;
        case "suggest_new":
          toast.success(`已创建并归类到「${result.folderName}」`, {
            icon: "📁",
            description: "AI 建议的新文件夹",
          });
          break;
        case "inbox":
          toast.info("已放入「待整理」文件夹", {
            icon: "📥",
            description: "稍后可手动整理",
          });
          break;
      }
    },
    [],
  );

  /**
   * 执行轮询
   * V3.2: 添加并发锁和去重逻辑
   */
  const pollStatus = useCallback(async () => {
    // V3.2: 防止并发执行
    if (isPollingInProgress.current) {
      return;
    }

    if (pendingBookmarks.length === 0) {
      setIsPolling(false);
      return;
    }

    // 设置并发锁
    isPollingInProgress.current = true;
    setIsPolling(true);

    try {
      const ids = pendingBookmarks.map((b) => b.id).join(",");
      const response = await fetch(`/api/bookmarks/batch-status?ids=${ids}`);

      if (!response.ok) {
        console.error("Failed to poll bookmark status");
        return;
      }

      const { data } = await response.json();
      const bookmarks = data?.bookmarks || [];
      const completed: number[] = [];
      const timedOut: number[] = [];

      for (const bookmark of bookmarks) {
        // 检查分类状态是否已完成（非 pending）
        if (
          bookmark.classification_status &&
          bookmark.classification_status !== "pending"
        ) {
          completed.push(bookmark.id);

          // V3.2: 仅在未通知过时显示通知
          if (!notifiedIds.current.has(bookmark.id)) {
            notifiedIds.current.add(bookmark.id);
            showClassificationNotification(
              bookmark.classification_result as ClassificationResultData,
            );
          }
        }
      }

      // 检查超时的书签
      setPendingBookmarks((prev) => {
        const updated = prev
          .map((b) => {
            if (completed.includes(b.id)) {
              return null; // 已完成，移除
            }
            const newCount = b.pollCount + 1;
            if (newCount >= MAX_POLL_COUNT) {
              timedOut.push(b.id);
              return null; // 超时，移除
            }
            return { ...b, pollCount: newCount };
          })
          .filter((b): b is PendingBookmark => b !== null);

        return updated;
      });

      // 如果有书签完成，刷新页面数据
      if (completed.length > 0) {
        router.refresh();
      }

      // 显示超时警告
      if (timedOut.length > 0) {
        toast.warning(`${timedOut.length} 个书签分类超时`, {
          icon: "⏱️",
          description: "请稍后刷新页面查看分类结果",
        });
      }
    } catch (error) {
      console.error("Classification polling error:", error);
    } finally {
      // V3.2: 释放并发锁
      isPollingInProgress.current = false;
    }
  }, [pendingBookmarks, router, showClassificationNotification]);

  /**
   * 管理轮询定时器
   */
  useEffect(() => {
    // 清除旧定时器
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    // 如果有待分类书签，启动轮询
    if (pendingBookmarks.length > 0) {
      pollingRef.current = setInterval(pollStatus, POLLING_INTERVAL);
    } else {
      setIsPolling(false);
    }

    // 清理函数
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [pendingBookmarks.length, pollStatus]);

  return {
    trackBookmark,
    pendingCount: pendingBookmarks.length,
    isPolling,
  };
}
