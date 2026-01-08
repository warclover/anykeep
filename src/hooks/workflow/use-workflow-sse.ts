"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { WorkflowExecution } from "./use-workflow-execution";
import { logger } from "@/lib/logger";

interface SSEMessage {
  type: "connected" | "progress" | "done" | "error";
  executionId?: string;
  execution?: WorkflowExecution;
  message?: string;
  ids?: string[];
}

interface UseWorkflowSSEOptions {
  /** 是否启用 SSE（默认 true） */
  enabled?: boolean;
  /** 连接失败重试次数（默认 3） */
  maxRetries?: number;
  /** 基础重试间隔毫秒（默认 2000，使用指数退避） */
  retryInterval?: number;
  /** 降级后恢复尝试间隔毫秒（默认 30000） */
  fallbackRecoveryInterval?: number;
  /** 执行更新回调 */
  onExecutionUpdate?: (
    executionId: string,
    execution: WorkflowExecution,
  ) => void;
  /** SSE 降级为轮询回调 */
  onFallbackToPolling?: () => void;
}

interface UseWorkflowSSEReturn {
  /** SSE 连接状态 */
  isConnected: boolean;
  /** 是否已降级为轮询 */
  isFallback: boolean;
  /** 当前监听的执行 ID 列表 */
  watchedIds: string[];
  /** 添加执行 ID 到监听列表 */
  addExecutionId: (id: string) => void;
  /** 从监听列表移除执行 ID */
  removeExecutionId: (id: string) => void;
  /** 手动重连 */
  reconnect: () => void;
}

/** 最大重试延迟（10秒） */
const MAX_RETRY_DELAY = 10000;

/**
 * 清理 EventSource 连接和事件监听器
 */
function cleanupEventSource(eventSource: EventSource | null): void {
  if (eventSource) {
    eventSource.onopen = null;
    eventSource.onmessage = null;
    eventSource.onerror = null;
    eventSource.close();
  }
}

/**
 * SSE 实时进度推送 Hook
 *
 * 自动管理 SSE 连接，支持多执行 ID 监听和降级机制
 * - 指数退避重试策略
 * - 降级后自动尝试恢复
 */
export function useWorkflowSSE(
  options: UseWorkflowSSEOptions = {},
): UseWorkflowSSEReturn {
  const {
    enabled = true,
    maxRetries = 3,
    retryInterval = 2000,
    fallbackRecoveryInterval = 30000,
    onExecutionUpdate,
    onFallbackToPolling,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const [watchedIds, setWatchedIds] = useState<string[]>([]);

  const eventSourceRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);
  const recoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectRef = useRef<(() => void) | null>(null);
  const onExecutionUpdateRef = useRef(onExecutionUpdate);
  const onFallbackToPollingRef = useRef(onFallbackToPolling);

  // 更新回调 refs
  useEffect(() => {
    onExecutionUpdateRef.current = onExecutionUpdate;
    onFallbackToPollingRef.current = onFallbackToPolling;
  }, [onExecutionUpdate, onFallbackToPolling]);

  // 清理恢复定时器
  const clearRecoveryTimer = useCallback(() => {
    if (recoveryTimerRef.current) {
      clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
  }, []);

  // 建立 SSE 连接
  const connect = useCallback(() => {
    if (!enabled || watchedIds.length === 0 || isFallback) return;

    // 清理现有连接
    cleanupEventSource(eventSourceRef.current);
    eventSourceRef.current = null;

    const url = `/api/workflow/sse?ids=${watchedIds.join(",")}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      retryCountRef.current = 0;
      logger.info(
        { watchedIds: watchedIds.length },
        "SSE connection established",
      );
    };

    eventSource.onmessage = (event) => {
      try {
        const data: SSEMessage = JSON.parse(event.data);

        switch (data.type) {
          case "progress":
            if (data.executionId && data.execution) {
              onExecutionUpdateRef.current?.(data.executionId, data.execution);
            }
            break;
          case "done":
            cleanupEventSource(eventSource);
            eventSourceRef.current = null;
            setIsConnected(false);
            break;
          case "error":
            logger.info(
              { message: data.message, executionId: data.executionId },
              "SSE stream error",
            );
            break;
        }
      } catch (error) {
        logger.error(
          { error: error instanceof Error ? error.message : String(error) },
          "Failed to parse SSE message",
        );
      }
    };

    eventSource.onerror = () => {
      cleanupEventSource(eventSource);
      eventSourceRef.current = null;
      setIsConnected(false);

      // 指数退避重试
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        const delay = Math.min(
          retryInterval * Math.pow(2, retryCountRef.current - 1),
          MAX_RETRY_DELAY,
        );

        logger.info(
          { retryCount: retryCountRef.current, maxRetries, delayMs: delay },
          "SSE connection error, retrying",
        );

        setTimeout(() => connectRef.current?.(), delay);
      } else {
        // 超过重试次数，降级为轮询
        logger.info(
          { maxRetries, watchedIds: watchedIds.length },
          "SSE max retries reached, falling back to polling",
        );

        setIsFallback(true);
        onFallbackToPollingRef.current?.();

        // 设置恢复定时器，降级后尝试恢复 SSE
        clearRecoveryTimer();
        recoveryTimerRef.current = setTimeout(() => {
          logger.info("Attempting to recover SSE after fallback");
          setIsFallback(false);
          retryCountRef.current = 0;
          // connect 会在 isFallback 变为 false 后由 useEffect 触发
        }, fallbackRecoveryInterval);
      }
    };
  }, [
    enabled,
    watchedIds,
    isFallback,
    maxRetries,
    retryInterval,
    fallbackRecoveryInterval,
    clearRecoveryTimer,
  ]);

  // 更新 connect ref
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  // 监听 ID 变化时重连
  useEffect(() => {
    if (watchedIds.length > 0 && !isFallback) {
      connect();
    }

    return () => {
      cleanupEventSource(eventSourceRef.current);
      eventSourceRef.current = null;
    };
  }, [watchedIds, connect, isFallback]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      clearRecoveryTimer();
      cleanupEventSource(eventSourceRef.current);
      eventSourceRef.current = null;
    };
  }, [clearRecoveryTimer]);

  const addExecutionId = useCallback((id: string) => {
    setWatchedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const removeExecutionId = useCallback((id: string) => {
    setWatchedIds((prev) => prev.filter((i) => i !== id));
  }, []);

  const reconnect = useCallback(() => {
    clearRecoveryTimer();
    setIsFallback(false);
    retryCountRef.current = 0;
    connect();
  }, [connect, clearRecoveryTimer]);

  return {
    isConnected,
    isFallback,
    watchedIds,
    addExecutionId,
    removeExecutionId,
    reconnect,
  };
}
