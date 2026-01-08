"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { WorkflowExecution } from "./use-workflow-execution";

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
  /** 重试间隔毫秒（默认 2000） */
  retryInterval?: number;
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

/**
 * SSE 实时进度推送 Hook
 *
 * 自动管理 SSE 连接，支持多执行 ID 监听和降级机制
 */
export function useWorkflowSSE(
  options: UseWorkflowSSEOptions = {},
): UseWorkflowSSEReturn {
  const {
    enabled = true,
    maxRetries = 3,
    retryInterval = 2000,
    onExecutionUpdate,
    onFallbackToPolling,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const [watchedIds, setWatchedIds] = useState<string[]>([]);

  const eventSourceRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);
  const connectRef = useRef<(() => void) | null>(null);
  const onExecutionUpdateRef = useRef(onExecutionUpdate);
  const onFallbackToPollingRef = useRef(onFallbackToPolling);

  // 更新回调 refs
  useEffect(() => {
    onExecutionUpdateRef.current = onExecutionUpdate;
    onFallbackToPollingRef.current = onFallbackToPolling;
  }, [onExecutionUpdate, onFallbackToPolling]);

  // 建立 SSE 连接
  const connect = useCallback(() => {
    if (!enabled || watchedIds.length === 0 || isFallback) return;

    // 关闭现有连接
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `/api/workflow/sse?ids=${watchedIds.join(",")}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      retryCountRef.current = 0;
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
            eventSource.close();
            setIsConnected(false);
            break;
          case "error":
            console.info("SSE error:", data.message);
            break;
        }
      } catch (error) {
        console.error("Failed to parse SSE message:", error);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      setIsConnected(false);

      // 重试逻辑
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        setTimeout(() => connectRef.current?.(), retryInterval);
      } else {
        // 超过重试次数，降级为轮询
        setIsFallback(true);
        onFallbackToPollingRef.current?.();
      }
    };
  }, [enabled, watchedIds, isFallback, maxRetries, retryInterval]);

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
      eventSourceRef.current?.close();
    };
  }, [watchedIds, connect, isFallback]);

  const addExecutionId = useCallback((id: string) => {
    setWatchedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const removeExecutionId = useCallback((id: string) => {
    setWatchedIds((prev) => prev.filter((i) => i !== id));
  }, []);

  const reconnect = useCallback(() => {
    setIsFallback(false);
    retryCountRef.current = 0;
    connect();
  }, [connect]);

  return {
    isConnected,
    isFallback,
    watchedIds,
    addExecutionId,
    removeExecutionId,
    reconnect,
  };
}
