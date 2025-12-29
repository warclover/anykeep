/**
 * MD 收藏处理状态轮询 Hook
 *
 * 对 pending/processing 状态的 MD 收藏进行定时轮询
 * 当处理完成后自动停止轮询并更新数据
 * 自动检测并重试卡住的处理任务
 *
 * 参考: src/hooks/ui/use-processing-poller.ts (书签轮询)
 */

"use client";

import { useEffect, useRef, useCallback } from "react";
import type { MdCollection, MdProcessingStatus } from "../types";

// 轮询配置
const POLL_INTERVAL = 3000; // 3 秒轮询一次
const MAX_POLL_COUNT = 60; // 最多轮询 60 次（3 分钟）

// 卡住检测配置
const STUCK_PENDING_THRESHOLD = 10000; // pending 超过 10 秒视为卡住
const STUCK_PROCESSING_THRESHOLD = 120000; // processing 超过 2 分钟视为卡住
const MAX_RETRY_COUNT = 2; // 每个 item 最多重试 2 次

/**
 * 轮询追踪条目
 */
interface PollTrackingEntry {
  /** 轮询次数 */
  pollCount: number;
  /** 首次开始轮询的时间 */
  startTime: number;
  /** 收藏创建时间（用于已存在的卡住项检测） */
  createdAt?: string;
  /** 重试次数 */
  retryCount: number;
  /** 上次重试时间 */
  lastRetryTime?: number;
  /** 当前状态（用于检测状态变化） */
  lastStatus?: MdProcessingStatus;
}

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

/**
 * 判断 item 是否卡住需要重试
 * @param status - 当前处理状态
 * @param entry - 轮询追踪条目（包含 createdAt 用于已存在的卡住项）
 */
function isStuck(
  status: MdProcessingStatus,
  entry: PollTrackingEntry,
): boolean {
  const now = Date.now();

  // 如果刚重试过，等待一段时间再判断
  if (entry.lastRetryTime && now - entry.lastRetryTime < 15000) {
    return false;
  }

  // 优先使用 createdAt（更准确），否则使用 startTime
  const referenceTime = entry.createdAt
    ? new Date(entry.createdAt).getTime()
    : entry.startTime;
  const elapsed = now - referenceTime;

  if (status === "pending" && elapsed > STUCK_PENDING_THRESHOLD) {
    return true;
  }

  if (status === "processing" && elapsed > STUCK_PROCESSING_THRESHOLD) {
    return true;
  }

  return false;
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
  // 轮询追踪器
  const trackingRef = useRef<Map<number, PollTrackingEntry>>(new Map());
  // 正在重试的 ID（防止并发重试）
  const retryingRef = useRef<Set<number>>(new Set());

  /**
   * 触发单个 item 的 AI 处理重试
   */
  const triggerRetry = useCallback(async (id: number) => {
    // 防止并发重试
    if (retryingRef.current.has(id)) {
      return;
    }

    const entry = trackingRef.current.get(id);
    if (!entry || entry.retryCount >= MAX_RETRY_COUNT) {
      return;
    }

    retryingRef.current.add(id);

    try {
      const response = await fetch(
        `/api/md-collections/${id}/process?force=true`,
        {
          method: "POST",
          credentials: "include",
        },
      );

      if (response.ok) {
        // 更新重试计数和时间
        entry.retryCount += 1;
        entry.lastRetryTime = Date.now();
        entry.startTime = Date.now(); // 重置开始时间
        trackingRef.current.set(id, entry);
      }
    } catch {
      // 静默处理错误
    } finally {
      retryingRef.current.delete(id);
    }
  }, []);

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
        for (const updated of updatedItems) {
          // 更新数据
          onUpdate(updated.id, {
            processing_status: updated.processing_status,
            ai_summary: updated.ai_summary,
            ai_tags: updated.ai_tags,
            processing_error: updated.processing_error,
            processed_at: updated.processed_at,
          });

          const entry = trackingRef.current.get(updated.id);

          // 检查是否已完成
          if (isCompleted(updated.processing_status)) {
            // 已完成，从追踪器中移除
            trackingRef.current.delete(updated.id);
          } else if (entry) {
            // 未完成，检查是否卡住需要重试
            entry.pollCount += 1;
            entry.lastStatus = updated.processing_status;

            // 检查是否卡住并且还有重试次数
            if (
              isStuck(updated.processing_status, entry) &&
              entry.retryCount < MAX_RETRY_COUNT
            ) {
              // 异步触发重试，不阻塞轮询
              triggerRetry(updated.id);
            }

            // 超过最大轮询次数，停止轮询
            if (entry.pollCount >= MAX_POLL_COUNT) {
              trackingRef.current.delete(updated.id);
            }
          }
        }
      } catch {
        // 静默处理错误，不影响用户体验
      }
    },
    [onUpdate, triggerRetry],
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
          const entry = trackingRef.current.get(c.id);
          if (!entry) return true; // 新 item 总是需要轮询
          return entry.pollCount < MAX_POLL_COUNT;
        })
        .map((c) => c.id);
    };

    // 检测是否有新加入的收藏需要轮询
    let hasNewPollingItems = false;
    collections.forEach((c) => {
      if (needsPolling(c) && !trackingRef.current.has(c.id)) {
        trackingRef.current.set(c.id, {
          pollCount: 0,
          startTime: Date.now(),
          createdAt: c.created_at, // 保存创建时间用于卡住检测
          retryCount: 0,
          lastStatus: c.processing_status,
        });
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
    const trackingMap = trackingRef.current;
    const retryingSet = retryingRef.current;
    return () => {
      trackingMap.clear();
      retryingSet.clear();
    };
  }, []);
}
