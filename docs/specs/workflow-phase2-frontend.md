# 工作流系统 Phase 2: 前端集成

> **版本**: v1.1.0
> **日期**: 2025-01-08
> **状态**: 待实施
> **预估工时**: 2.5-3.5 天
> **前置依赖**: Phase 1 核心引擎 MVP v1.1.0（含 StreamResultCollector）
> **更新**: v1.1.0 - 添加 SSE 实时进度推送方案，替代纯轮询

---

## 1. 目标与范围

### 1.1 Phase 2 目标

为工作流系统提供**完整的用户交互界面**，让用户可以通过 UI 触发、监控和管理工作流。

### 1.2 范围界定

| 包含                                  | 不包含                 |
| ------------------------------------- | ---------------------- |
| WorkflowQuickActions（快捷按钮组）    | 用户自定义工作流编辑器 |
| WorkflowExecutionProgress（进度展示） | 复杂的工作流可视化     |
| WorkflowResultCard（结果卡片）        | 工作流模板市场         |
| 工作流管理页面 `/workflows`           | 高级筛选和搜索         |
| 4 个核心 Hooks（含 SSE 支持）         |                        |
| **SSE 实时进度推送**（带轮询降级）    |                        |
| Toast 通知集成                        |                        |

### 1.3 成功标准

- [ ] 首页工具栏显示工作流快捷按钮
- [ ] 点击按钮可触发工作流
- [ ] **SSE 连接成功时**：实时推送执行进度（延迟 < 500ms）
- [ ] **SSE 连接失败时**：自动降级为 SWR 轮询（1s 间隔）
- [ ] 执行完成后显示结果摘要
- [ ] `/workflows` 页面列出所有可用工作流
- [ ] 可查看历史执行记录

---

## 2. 组件架构

### 2.1 组件依赖关系

```
┌─────────────────────────────────────────────────────────────────────┐
│                         页面层                                       │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │ HomePage        │    │ WorkflowsPage   │    │ SidebarLayout   │ │
│  │ (首页)          │    │ (工作流管理页)   │    │ (侧边栏)        │ │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘ │
└───────────┼─────────────────────┼─────────────────────┼───────────┘
            │                     │                     │
            ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         组件层                                       │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │QuickActions     │    │WorkflowListPage │    │ExecutionProgress│ │
│  │(快捷按钮组)      │    │(工作流列表)      │    │(执行进度)        │ │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘ │
│           │                      │                      │          │
│  ┌────────┴────────┐    ┌────────┴────────┐    ┌────────┴────────┐ │
│  │ActionButton     │    │WorkflowCard     │    │StepIndicator    │ │
│  │(单个按钮)        │    │(工作流卡片)      │    │(步骤指示器)      │ │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘ │
│                                                                     │
│  ┌─────────────────┐    ┌─────────────────┐                        │
│  │ResultCard       │    │ExecutionHistory │                        │
│  │(结果卡片)        │    │(执行历史)        │                        │
│  └─────────────────┘    └─────────────────┘                        │
└─────────────────────────────────────────────────────────────────────┘
            │                     │                     │
            ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Hooks 层                                     │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │useWorkflowTrigger│   │useWorkflowList  │    │useWorkflowExec  │ │
│  │(触发工作流)       │   │(工作流列表)      │    │(执行状态)        │ │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
            │                     │                     │
            ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         API 层 (Phase 1)                            │
│  POST /api/workflow/start                                            │
│  GET  /api/workflow/execution/:id                                    │
│  GET  /api/workflow                                                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Hooks 实现

### 3.1 useWorkflowTrigger

```typescript
// src/hooks/workflow/use-workflow-trigger.ts
"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";

interface TriggerResult {
  success: boolean;
  executionId?: string;
  error?: string;
}

interface UseWorkflowTriggerReturn {
  triggerWorkflow: (
    workflowId: string,
    context?: Record<string, unknown>,
  ) => Promise<TriggerResult>;
  isLoading: boolean;
  loadingWorkflowId: string | null;
  lastExecutionId: string | null;
}

/**
 * 工作流触发 Hook
 *
 * 用于触发工作流执行并跟踪加载状态
 */
export function useWorkflowTrigger(): UseWorkflowTriggerReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingWorkflowId, setLoadingWorkflowId] = useState<string | null>(
    null,
  );
  const [lastExecutionId, setLastExecutionId] = useState<string | null>(null);

  const triggerWorkflow = useCallback(
    async (
      workflowId: string,
      triggerContext: Record<string, unknown> = {},
    ): Promise<TriggerResult> => {
      setIsLoading(true);
      setLoadingWorkflowId(workflowId);

      try {
        const response = await fetch("/api/workflow/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workflowId, triggerContext }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || data.message || "启动工作流失败");
        }

        setLastExecutionId(data.executionId);

        toast.success("工作流已启动", {
          description: `执行 ID: ${data.executionId.slice(0, 8)}...`,
          action: {
            label: "查看进度",
            onClick: () => {
              // 可以触发打开进度面板的回调
              window.dispatchEvent(
                new CustomEvent("workflow:show-progress", {
                  detail: { executionId: data.executionId },
                }),
              );
            },
          },
        });

        return { success: true, executionId: data.executionId };
      } catch (error) {
        const message = error instanceof Error ? error.message : "未知错误";

        toast.error("启动失败", { description: message });

        return { success: false, error: message };
      } finally {
        setIsLoading(false);
        setLoadingWorkflowId(null);
      }
    },
    [],
  );

  return {
    triggerWorkflow,
    isLoading,
    loadingWorkflowId,
    lastExecutionId,
  };
}
```

### 3.2 useWorkflowExecution

```typescript
// src/hooks/workflow/use-workflow-execution.ts
"use client";

import { useCallback, useEffect, useRef } from "react";
import useSWR from "swr";

export interface ExecutionStep {
  stepId: string;
  stepName: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  output?: unknown;
  error?: string;
  duration?: number;
  startedAt?: string;
  completedAt?: string;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  userId: string;
  status:
    | "pending"
    | "running"
    | "completed"
    | "failed"
    | "cancelled"
    | "waiting_confirmation";
  triggerType: string;
  triggerContext: Record<string, unknown>;
  currentStepIndex: number;
  steps: ExecutionStep[];
  totalSteps: number;
  progress: number;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
}

interface UseWorkflowExecutionOptions {
  /** 是否启用轮询（默认 true） */
  polling?: boolean;
  /** 轮询间隔（毫秒，默认 1000） */
  pollingInterval?: number;
  /** 完成回调 */
  onComplete?: (execution: WorkflowExecution) => void;
  /** 失败回调 */
  onError?: (execution: WorkflowExecution) => void;
}

interface UseWorkflowExecutionReturn {
  execution: WorkflowExecution | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
  cancelExecution: () => Promise<boolean>;
}

const fetcher = async (url: string): Promise<WorkflowExecution> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch execution");
  }
  return res.json();
};

/**
 * 工作流执行状态 Hook
 *
 * 用于获取和轮询工作流执行状态
 */
export function useWorkflowExecution(
  executionId: string | null,
  options: UseWorkflowExecutionOptions = {},
): UseWorkflowExecutionReturn {
  const {
    polling = true,
    pollingInterval = 1000,
    onComplete,
    onError,
  } = options;

  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);

  // 更新 refs
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
  }, [onComplete, onError]);

  const { data, error, isLoading, mutate } = useSWR<WorkflowExecution>(
    executionId ? `/api/workflow/execution/${executionId}` : null,
    fetcher,
    {
      // 动态刷新间隔：运行中时轮询，否则停止
      refreshInterval: (latestData) => {
        if (!polling) return 0;
        if (!latestData) return pollingInterval;

        const isActive =
          latestData.status === "pending" ||
          latestData.status === "running" ||
          latestData.status === "waiting_confirmation";

        return isActive ? pollingInterval : 0;
      },
      revalidateOnFocus: false,
    },
  );

  // 处理完成/失败回调
  useEffect(() => {
    if (!data) return;

    if (data.status === "completed" && onCompleteRef.current) {
      onCompleteRef.current(data);
    }

    if (data.status === "failed" && onErrorRef.current) {
      onErrorRef.current(data);
    }
  }, [data?.status]);

  const cancelExecution = useCallback(async (): Promise<boolean> => {
    if (!executionId) return false;

    try {
      const response = await fetch(
        `/api/workflow/execution/${executionId}/cancel`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to cancel");
      }

      const result = await response.json();
      mutate(); // 刷新状态

      return result.cancelled;
    } catch (error) {
      console.error("Failed to cancel execution:", error);
      return false;
    }
  }, [executionId, mutate]);

  return {
    execution: data || null,
    isLoading,
    error: error || null,
    refresh: () => mutate(),
    cancelExecution,
  };
}
```

### 3.3 useWorkflowList

```typescript
// src/hooks/workflow/use-workflow-list.ts
"use client";

import useSWR from "swr";

export interface WorkflowSummary {
  id: string;
  name: string;
  description: string;
  category: "builtin" | "user_defined";
  version: string;
  stepCount: number;
  triggers: Array<{
    type: string;
  }>;
}

interface UseWorkflowListReturn {
  workflows: WorkflowSummary[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
}

const fetcher = async (
  url: string,
): Promise<{ workflows: WorkflowSummary[] }> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch workflows");
  }
  return res.json();
};

/**
 * 工作流列表 Hook
 *
 * 获取用户可用的工作流列表
 */
export function useWorkflowList(): UseWorkflowListReturn {
  const { data, error, isLoading, mutate } = useSWR("/api/workflow", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000, // 1 分钟去重
  });

  return {
    workflows: data?.workflows || [],
    isLoading,
    error: error || null,
    refresh: () => mutate(),
  };
}
```

### 3.4 useExecutionHistory

```typescript
// src/hooks/workflow/use-execution-history.ts
"use client";

import useSWR from "swr";
import type { WorkflowExecution } from "./use-workflow-execution";

interface UseExecutionHistoryOptions {
  limit?: number;
  status?: string;
}

interface UseExecutionHistoryReturn {
  executions: WorkflowExecution[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
}

const fetcher = async (
  url: string,
): Promise<{ executions: WorkflowExecution[] }> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch executions");
  }
  return res.json();
};

/**
 * 执行历史 Hook
 */
export function useExecutionHistory(
  options: UseExecutionHistoryOptions = {},
): UseExecutionHistoryReturn {
  const { limit = 20, status } = options;

  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (status) params.set("status", status);

  const { data, error, isLoading, mutate } = useSWR(
    `/api/workflow/executions?${params.toString()}`,
    fetcher,
    {
      revalidateOnFocus: false,
    },
  );

  return {
    executions: data?.executions || [],
    isLoading,
    error: error || null,
    refresh: () => mutate(),
  };
}
```

### 3.5 Hooks 导出

```typescript
// src/hooks/workflow/index.ts

export { useWorkflowTrigger } from "./use-workflow-trigger";
export { useWorkflowExecution } from "./use-workflow-execution";
export type {
  WorkflowExecution,
  ExecutionStep,
} from "./use-workflow-execution";
export { useWorkflowList } from "./use-workflow-list";
export type { WorkflowSummary } from "./use-workflow-list";
export { useExecutionHistory } from "./use-execution-history";
export { useWorkflowSSE } from "./use-workflow-sse";
```

---

## 3.6 SSE 实时进度推送方案

### 3.6.1 方案概述

为解决轮询带来的延迟和资源消耗问题，采用 **SSE + 轮询降级** 的混合方案：

| 方案           | 优先级 | 触发条件               | 延迟    | 资源消耗       |
| -------------- | ------ | ---------------------- | ------- | -------------- |
| SSE 单连接推送 | 首选   | 浏览器支持 EventSource | < 500ms | 低（单连接）   |
| SWR 轮询       | 降级   | SSE 连接失败/不支持    | 1000ms  | 中（定时请求） |

### 3.6.2 SSE API 端点

```typescript
// src/app/api/workflow/sse/route.ts

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkflowOrchestrator } from "@/lib/workflow/orchestrator";

export const runtime = "edge"; // Edge Runtime 支持 SSE

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const executionIds = searchParams.get("ids")?.split(",") || [];

  if (executionIds.length === 0) {
    return new Response("No execution IDs provided", { status: 400 });
  }

  const encoder = new TextEncoder();
  const orchestrator = getWorkflowOrchestrator();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // 定期检查执行状态并推送
      const checkInterval = setInterval(async () => {
        try {
          for (const executionId of executionIds) {
            const execution =
              await orchestrator.getExecutionStatus(executionId);

            if (execution && execution.userId === user.id) {
              sendEvent({
                type: "progress",
                executionId,
                execution,
              });

              // 终态时移除该 ID
              if (
                ["completed", "failed", "cancelled"].includes(execution.status)
              ) {
                const index = executionIds.indexOf(executionId);
                if (index > -1) executionIds.splice(index, 1);
              }
            }
          }

          // 所有执行完成时关闭连接
          if (executionIds.length === 0) {
            sendEvent({ type: "done" });
            clearInterval(checkInterval);
            controller.close();
          }
        } catch (error) {
          sendEvent({ type: "error", message: "Failed to fetch status" });
        }
      }, 500); // 服务端 500ms 检查间隔

      // 客户端断开连接时清理
      request.signal.addEventListener("abort", () => {
        clearInterval(checkInterval);
        controller.close();
      });

      // 发送初始连接成功事件
      sendEvent({ type: "connected", ids: executionIds });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

### 3.6.3 useWorkflowSSE Hook

```typescript
// src/hooks/workflow/use-workflow-sse.ts
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
            console.warn("SSE error:", data.message);
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
        setTimeout(connect, retryInterval);
      } else {
        // 超过重试次数，降级为轮询
        setIsFallback(true);
        onFallbackToPollingRef.current?.();
      }
    };
  }, [enabled, watchedIds, isFallback, maxRetries, retryInterval]);

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
```

### 3.6.4 useWorkflowExecution 集成 SSE

```typescript
// src/hooks/workflow/use-workflow-execution.ts (更新版)
// 关键变更：支持 SSE 优先、轮询降级

interface UseWorkflowExecutionOptions {
  /** 是否启用实时更新（默认 true） */
  realtime?: boolean;
  /** 首选 SSE，不可用时降级为轮询（默认 true） */
  preferSSE?: boolean;
  /** 轮询间隔（毫秒，默认 1000，仅降级时使用） */
  pollingInterval?: number;
  /** 完成回调 */
  onComplete?: (execution: WorkflowExecution) => void;
  /** 失败回调 */
  onError?: (execution: WorkflowExecution) => void;
}

export function useWorkflowExecution(
  executionId: string | null,
  options: UseWorkflowExecutionOptions = {},
): UseWorkflowExecutionReturn {
  const {
    realtime = true,
    preferSSE = true,
    pollingInterval = 1000,
    onComplete,
    onError,
  } = options;

  const [execution, setExecution] = useState<WorkflowExecution | null>(null);
  const [isSSEActive, setIsSSEActive] = useState(false);

  // SSE Hook
  const {
    isConnected: sseConnected,
    isFallback: sseFallback,
    addExecutionId,
    removeExecutionId,
  } = useWorkflowSSE({
    enabled: realtime && preferSSE,
    onExecutionUpdate: (id, exec) => {
      if (id === executionId) {
        setExecution(exec);
        setIsSSEActive(true);
      }
    },
    onFallbackToPolling: () => {
      setIsSSEActive(false);
    },
  });

  // 添加/移除 SSE 监听
  useEffect(() => {
    if (executionId && preferSSE) {
      addExecutionId(executionId);
      return () => removeExecutionId(executionId);
    }
  }, [executionId, preferSSE, addExecutionId, removeExecutionId]);

  // SWR 轮询（仅当 SSE 降级时启用）
  const shouldPoll = realtime && (!preferSSE || sseFallback);

  const { data, error, isLoading, mutate } = useSWR<WorkflowExecution>(
    executionId ? `/api/workflow/execution/${executionId}` : null,
    fetcher,
    {
      refreshInterval: (latestData) => {
        if (!shouldPoll) return 0;
        if (!latestData) return pollingInterval;
        const isActive = [
          "pending",
          "running",
          "waiting_confirmation",
        ].includes(latestData.status);
        return isActive ? pollingInterval : 0;
      },
      revalidateOnFocus: false,
    },
  );

  // 同步 SWR 数据到 execution（仅轮询模式）
  useEffect(() => {
    if (!isSSEActive && data) {
      setExecution(data);
    }
  }, [data, isSSEActive]);

  // ... 其余代码保持不变
}
```

### 3.6.5 技术决策说明

| 问题                           | 决策        | 理由                                 |
| ------------------------------ | ----------- | ------------------------------------ |
| 为什么选 SSE 而非 WebSocket？  | SSE         | 单向推送足够，实现更简单，无需握手   |
| 为什么不用 Supabase Realtime？ | 自建 SSE    | 执行状态在内存中，无需持久化到数据库 |
| 为什么服务端 500ms 间隔？      | 折中方案    | 比轮询 1s 更快，又不会过度消耗 CPU   |
| 如何处理多执行 ID？            | 单连接多 ID | 减少连接数，参数化 `?ids=`           |

---

## 4. 组件实现

### 4.1 WorkflowQuickActions

```typescript
// src/components/workflow/quick-actions/workflow-quick-actions.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { useWorkflowTrigger } from "@/hooks/workflow";
import {
  Zap,
  Calendar,
  Brain,
  HeartPulse,
  Loader2,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FC } from "react";

/**
 * 预设工作流配置
 */
const QUICK_WORKFLOWS = [
  {
    id: "smart_intake",
    name: "智能收录",
    description: "自动整理今日新增书签",
    icon: Zap,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
  },
  {
    id: "weekly_organize",
    name: "周度整理",
    description: "本周收藏智能分类归档",
    icon: Calendar,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    id: "deep_learning",
    name: "深度学习",
    description: "生成学习计划和知识图谱",
    icon: Brain,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  {
    id: "bookmark_health_simple",
    name: "书签巡检",
    description: "检测失效链接和重复内容",
    icon: HeartPulse,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
] as const;

type WorkflowConfig = (typeof QUICK_WORKFLOWS)[number];

interface WorkflowQuickActionsProps {
  /** 显示模式：toolbar（工具栏紧凑）或 sidebar（侧边栏完整） */
  variant?: "toolbar" | "sidebar";
  /** 工作流启动回调 */
  onExecutionStart?: (workflowId: string, executionId: string) => void;
  /** 最大显示数量（仅 toolbar 模式） */
  maxVisible?: number;
}

export const WorkflowQuickActions: FC<WorkflowQuickActionsProps> = ({
  variant = "toolbar",
  onExecutionStart,
  maxVisible = 3,
}) => {
  const { triggerWorkflow, isLoading, loadingWorkflowId, lastExecutionId } =
    useWorkflowTrigger();

  const handleTrigger = async (workflow: WorkflowConfig) => {
    const result = await triggerWorkflow(workflow.id);
    if (result.success && result.executionId) {
      onExecutionStart?.(workflow.id, result.executionId);
    }
  };

  if (variant === "sidebar") {
    return <SidebarVariant workflows={QUICK_WORKFLOWS} onTrigger={handleTrigger} isLoading={isLoading} loadingWorkflowId={loadingWorkflowId} />;
  }

  return (
    <ToolbarVariant
      workflows={QUICK_WORKFLOWS}
      onTrigger={handleTrigger}
      isLoading={isLoading}
      loadingWorkflowId={loadingWorkflowId}
      maxVisible={maxVisible}
    />
  );
};

/**
 * 工具栏变体：紧凑图标按钮
 */
const ToolbarVariant: FC<{
  workflows: readonly WorkflowConfig[];
  onTrigger: (workflow: WorkflowConfig) => void;
  isLoading: boolean;
  loadingWorkflowId: string | null;
  maxVisible: number;
}> = ({ workflows, onTrigger, isLoading, loadingWorkflowId, maxVisible }) => {
  const visibleWorkflows = workflows.slice(0, maxVisible);
  const hiddenWorkflows = workflows.slice(maxVisible);

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        {visibleWorkflows.map((workflow) => {
          const Icon = workflow.icon;
          const isCurrentLoading = isLoading && loadingWorkflowId === workflow.id;

          return (
            <Tooltip key={workflow.id}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onTrigger(workflow)}
                  disabled={isLoading}
                  className="h-8 w-8"
                >
                  {isCurrentLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Icon className={`h-4 w-4 ${workflow.color}`} />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="font-medium">{workflow.name}</p>
                <p className="text-xs text-muted-foreground">
                  {workflow.description}
                </p>
              </TooltipContent>
            </Tooltip>
          );
        })}

        {hiddenWorkflows.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {hiddenWorkflows.map((workflow) => {
                const Icon = workflow.icon;
                return (
                  <DropdownMenuItem
                    key={workflow.id}
                    onClick={() => onTrigger(workflow)}
                    disabled={isLoading}
                  >
                    <Icon className={`h-4 w-4 mr-2 ${workflow.color}`} />
                    <span>{workflow.name}</span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </TooltipProvider>
  );
};

/**
 * 侧边栏变体：完整按钮列表
 */
const SidebarVariant: FC<{
  workflows: readonly WorkflowConfig[];
  onTrigger: (workflow: WorkflowConfig) => void;
  isLoading: boolean;
  loadingWorkflowId: string | null;
}> = ({ workflows, onTrigger, isLoading, loadingWorkflowId }) => {
  return (
    <div className="flex flex-col gap-1 p-2">
      {workflows.map((workflow) => {
        const Icon = workflow.icon;
        const isCurrentLoading = isLoading && loadingWorkflowId === workflow.id;

        return (
          <Button
            key={workflow.id}
            variant="ghost"
            size="sm"
            onClick={() => onTrigger(workflow)}
            disabled={isLoading}
            className="justify-start gap-2 h-9"
          >
            {isCurrentLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <div className={`p-1 rounded ${workflow.bgColor}`}>
                <Icon className={`h-3 w-3 ${workflow.color}`} />
              </div>
            )}
            <span className="text-sm">{workflow.name}</span>
          </Button>
        );
      })}
    </div>
  );
};
```

### 4.2 WorkflowExecutionProgress

```typescript
// src/components/workflow/execution/workflow-execution-progress.tsx
"use client";

import { useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  SkipForward,
  X,
  AlertTriangle,
} from "lucide-react";
import { useWorkflowExecution } from "@/hooks/workflow";
import type { ExecutionStep } from "@/hooks/workflow";
import type { FC } from "react";

interface WorkflowExecutionProgressProps {
  executionId: string;
  onClose?: () => void;
  onComplete?: () => void;
  compact?: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "等待中",
  running: "执行中",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
  waiting_confirmation: "等待确认",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  running: "default",
  completed: "secondary",
  failed: "destructive",
  cancelled: "outline",
  waiting_confirmation: "default",
};

/**
 * 步骤状态图标
 */
const StepStatusIcon: FC<{ status: ExecutionStep["status"] }> = ({ status }) => {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "running":
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "skipped":
      return <SkipForward className="h-4 w-4 text-muted-foreground" />;
    default:
      return <Circle className="h-4 w-4 text-muted-foreground" />;
  }
};

/**
 * 工作流执行进度组件
 */
export const WorkflowExecutionProgress: FC<WorkflowExecutionProgressProps> = ({
  executionId,
  onClose,
  onComplete,
  compact = false,
}) => {
  const { execution, isLoading, error, cancelExecution } = useWorkflowExecution(
    executionId,
    {
      onComplete: () => {
        onComplete?.();
      },
    }
  );

  // 加载中状态
  if (isLoading && !execution) {
    return (
      <Card className={compact ? "border-0 shadow-none" : ""}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // 错误状态
  if (error) {
    return (
      <Card className={compact ? "border-0 shadow-none" : ""}>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <AlertTriangle className="h-8 w-8 text-yellow-500 mb-2" />
          <p className="text-sm text-muted-foreground">加载执行状态失败</p>
        </CardContent>
      </Card>
    );
  }

  if (!execution) {
    return null;
  }

  const isActive = execution.status === "pending" || execution.status === "running";

  return (
    <Card className={compact ? "border-0 shadow-none" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">{execution.workflowName}</CardTitle>
            <p className="text-xs text-muted-foreground">
              ID: {execution.id.slice(0, 8)}...
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANTS[execution.status]}>
              {STATUS_LABELS[execution.status]}
            </Badge>
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 进度条 */}
        <div className="space-y-1">
          <Progress value={execution.progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {execution.steps.filter((s) => s.status === "completed").length} /{" "}
              {execution.totalSteps} 步骤
            </span>
            <span>{execution.progress}%</span>
          </div>
        </div>

        {/* 步骤列表 */}
        <div className="space-y-2">
          {execution.steps.map((step) => (
            <div
              key={step.stepId}
              className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted/50"
            >
              <StepStatusIcon status={step.status} />
              <span className="flex-1">{step.stepName}</span>
              {step.duration && step.status === "completed" && (
                <span className="text-xs text-muted-foreground">
                  {formatDuration(step.duration)}
                </span>
              )}
              {step.error && (
                <span className="text-xs text-red-500 truncate max-w-[120px]">
                  {step.error}
                </span>
              )}
            </div>
          ))}

          {/* 待执行步骤占位 */}
          {execution.totalSteps > execution.steps.length && (
            <div className="text-xs text-muted-foreground text-center py-1">
              还有 {execution.totalSteps - execution.steps.length} 个步骤待执行
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        {isActive && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={cancelExecution}
              className="text-red-500 hover:text-red-600"
            >
              <X className="h-4 w-4 mr-1" />
              取消执行
            </Button>
          </div>
        )}

        {/* 错误信息 */}
        {execution.status === "failed" && execution.errorMessage && (
          <div className="p-3 bg-red-50 dark:bg-red-950 rounded-md">
            <p className="text-sm text-red-600 dark:text-red-400">
              {execution.errorMessage}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * 格式化持续时间
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}
```

### 4.3 WorkflowResultCard

```typescript
// src/components/workflow/result/workflow-result-card.tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  CheckCircle2,
  XCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Clock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import type { WorkflowExecution } from "@/hooks/workflow";
import type { FC } from "react";

interface WorkflowResultCardProps {
  execution: WorkflowExecution;
  onViewDetail?: (executionId: string) => void;
}

/**
 * 工作流执行结果卡片
 */
export const WorkflowResultCard: FC<WorkflowResultCardProps> = ({
  execution,
  onViewDetail,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const isSuccess = execution.status === "completed";
  const relativeTime = formatDistanceToNow(new Date(execution.startedAt), {
    locale: zhCN,
    addSuffix: true,
  });

  // 计算总耗时
  const totalDuration = execution.steps.reduce(
    (sum, step) => sum + (step.duration || 0),
    0
  );

  // 生成摘要
  const summary = generateSummary(execution);

  return (
    <Card
      className={
        isSuccess
          ? "border-green-200 dark:border-green-900"
          : "border-red-200 dark:border-red-900"
      }
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isSuccess ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
            <CardTitle className="text-base">{execution.workflowName}</CardTitle>
          </div>
          <Badge variant={isSuccess ? "secondary" : "destructive"}>
            {isSuccess ? "成功" : "失败"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* 摘要 */}
        <p className="text-sm text-muted-foreground">{summary}</p>

        {/* 元信息 */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {relativeTime}
          </span>
          <span>•</span>
          <span>耗时 {formatDuration(totalDuration)}</span>
          <span>•</span>
          <span>
            {execution.steps.filter((s) => s.status === "completed").length}/
            {execution.totalSteps} 步骤
          </span>
        </div>

        {/* 展开详情 */}
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between">
              <span>执行详情</span>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 space-y-2">
              {execution.steps.map((step) => (
                <div
                  key={step.stepId}
                  className="flex items-center justify-between text-sm p-2 rounded bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <StatusDot status={step.status} />
                    <span>{step.stepName}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {step.duration ? formatDuration(step.duration) : "-"}
                  </span>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* 操作按钮 */}
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewDetail?.(execution.id)}
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            查看详情
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * 状态点
 */
const StatusDot: FC<{ status: string }> = ({ status }) => {
  const colors: Record<string, string> = {
    completed: "bg-green-500",
    failed: "bg-red-500",
    skipped: "bg-gray-400",
    running: "bg-blue-500",
    pending: "bg-gray-300",
  };

  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${colors[status] || colors.pending}`}
    />
  );
};

/**
 * 生成执行摘要
 */
function generateSummary(execution: WorkflowExecution): string {
  const completedSteps = execution.steps.filter((s) => s.status === "completed");
  const failedSteps = execution.steps.filter((s) => s.status === "failed");

  if (execution.status === "completed") {
    return `成功执行 ${completedSteps.length} 个步骤`;
  }

  if (execution.status === "failed") {
    const failedStep = failedSteps[0];
    return failedStep
      ? `在「${failedStep.stepName}」步骤失败: ${failedStep.error || "未知错误"}`
      : "执行失败";
  }

  if (execution.status === "cancelled") {
    return `用户取消，已完成 ${completedSteps.length} 个步骤`;
  }

  return `${execution.status}`;
}

/**
 * 格式化持续时间
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}
```

### 4.4 WorkflowCard

```typescript
// src/components/workflow/list/workflow-card.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, Zap, User, Clock, Layers } from "lucide-react";
import { useWorkflowTrigger } from "@/hooks/workflow";
import type { WorkflowSummary } from "@/hooks/workflow";
import type { FC } from "react";

interface WorkflowCardProps {
  workflow: WorkflowSummary;
  onExecutionStart?: (executionId: string) => void;
}

const TRIGGER_LABELS: Record<string, string> = {
  manual: "手动",
  event: "事件",
  schedule: "定时",
  conversation: "对话",
};

/**
 * 工作流卡片组件
 */
export const WorkflowCard: FC<WorkflowCardProps> = ({
  workflow,
  onExecutionStart,
}) => {
  const { triggerWorkflow, isLoading, loadingWorkflowId } = useWorkflowTrigger();

  const isCurrentLoading = isLoading && loadingWorkflowId === workflow.id;
  const isBuiltin = workflow.category === "builtin";

  const handleRun = async () => {
    const result = await triggerWorkflow(workflow.id);
    if (result.success && result.executionId) {
      onExecutionStart?.(result.executionId);
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              {workflow.name}
              {isBuiltin && (
                <Badge variant="outline" className="text-xs">
                  <Zap className="h-3 w-3 mr-1" />
                  预设
                </Badge>
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {workflow.description}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* 元信息 */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Layers className="h-3 w-3" />
            {workflow.stepCount} 步骤
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            {workflow.triggers.map((t) => TRIGGER_LABELS[t.type]).join(" / ")}
          </span>
        </div>

        {/* 触发器标签 */}
        <div className="flex flex-wrap gap-1">
          {workflow.triggers.map((trigger, index) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {TRIGGER_LABELS[trigger.type]}
            </Badge>
          ))}
        </div>

        {/* 运行按钮 */}
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleRun}
            disabled={isLoading}
          >
            {isCurrentLoading ? (
              <>
                <span className="animate-spin mr-1">⏳</span>
                启动中...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-1" />
                运行
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
```

---

## 5. 页面实现

### 5.1 工作流管理页面

```typescript
// src/app/(main)/workflows/page.tsx

import { Suspense } from "react";
import { WorkflowListPageClient } from "@/components/workflow/list/workflow-list-page";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "工作流管理 - AnyKeep",
  description: "管理和执行自动化工作流",
};

export default function WorkflowsPage() {
  return (
    <div className="container mx-auto py-6 px-4">
      <Suspense fallback={<WorkflowListSkeleton />}>
        <WorkflowListPageClient />
      </Suspense>
    </div>
  );
}

function WorkflowListSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    </div>
  );
}
```

### 5.2 工作流列表页面客户端组件

```typescript
// src/components/workflow/list/workflow-list-page.tsx
"use client";

import { useState } from "react";
import { useWorkflowList, useExecutionHistory } from "@/hooks/workflow";
import { WorkflowCard } from "./workflow-card";
import { WorkflowResultCard } from "../result/workflow-result-card";
import { WorkflowExecutionProgress } from "../execution/workflow-execution-progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Search, Zap, User, History, Loader2 } from "lucide-react";
import type { FC } from "react";

export const WorkflowListPageClient: FC = () => {
  const { workflows, isLoading: isLoadingWorkflows } = useWorkflowList();
  const { executions, isLoading: isLoadingHistory } = useExecutionHistory({
    limit: 10,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"workflows" | "history">("workflows");
  const [activeExecutionId, setActiveExecutionId] = useState<string | null>(null);

  // 筛选工作流
  const filteredWorkflows = workflows.filter(
    (w) =>
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const builtinWorkflows = filteredWorkflows.filter((w) => w.category === "builtin");
  const customWorkflows = filteredWorkflows.filter((w) => w.category === "user_defined");

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">工作流管理</h1>
          <p className="text-muted-foreground">
            自动化执行多个 AI Skills，提升效率
          </p>
        </div>
      </div>

      {/* 搜索和标签 */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索工作流..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as typeof activeTab)}
        >
          <TabsList>
            <TabsTrigger value="workflows" className="gap-1">
              <Zap className="h-3 w-3" />
              工作流
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1">
              <History className="h-3 w-3" />
              执行历史
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* 内容区 */}
      {activeTab === "workflows" && (
        <div className="space-y-6">
          {isLoadingWorkflows ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredWorkflows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchQuery ? "未找到匹配的工作流" : "暂无可用工作流"}
            </div>
          ) : (
            <>
              {/* 预设工作流 */}
              {builtinWorkflows.length > 0 && (
                <section>
                  <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    预设工作流
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {builtinWorkflows.map((workflow) => (
                      <WorkflowCard
                        key={workflow.id}
                        workflow={workflow}
                        onExecutionStart={setActiveExecutionId}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* 自定义工作流 */}
              {customWorkflows.length > 0 && (
                <section>
                  <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <User className="h-4 w-4 text-blue-500" />
                    我的工作流
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {customWorkflows.map((workflow) => (
                      <WorkflowCard
                        key={workflow.id}
                        workflow={workflow}
                        onExecutionStart={setActiveExecutionId}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === "history" && (
        <div className="space-y-4">
          {isLoadingHistory ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : executions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              暂无执行记录
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {executions.map((execution) => (
                <WorkflowResultCard
                  key={execution.id}
                  execution={execution}
                  onViewDetail={setActiveExecutionId}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 执行进度抽屉 */}
      <Sheet
        open={!!activeExecutionId}
        onOpenChange={(open) => !open && setActiveExecutionId(null)}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>执行进度</SheetTitle>
          </SheetHeader>
          {activeExecutionId && (
            <div className="mt-4">
              <WorkflowExecutionProgress
                executionId={activeExecutionId}
                onClose={() => setActiveExecutionId(null)}
                compact
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};
```

---

## 6. 集成位置

### 6.1 首页工具栏集成

```typescript
// src/components/home/home-toolbar.tsx 中添加

import { WorkflowQuickActions } from "@/components/workflow/quick-actions";

// 在工具栏组件中添加
<div className="flex items-center gap-2">
  {/* 其他工具栏按钮 */}
  <Separator orientation="vertical" className="h-6" />
  <WorkflowQuickActions variant="toolbar" maxVisible={3} />
</div>
```

### 6.2 侧边栏集成

```typescript
// src/components/layout/sidebar.tsx 中添加

import { WorkflowQuickActions } from "@/components/workflow/quick-actions";

// 在侧边栏底部添加
<div className="mt-auto border-t pt-4">
  <h4 className="text-xs font-medium text-muted-foreground mb-2 px-3">
    快捷工作流
  </h4>
  <WorkflowQuickActions variant="sidebar" />
</div>
```

### 6.3 侧边栏导航添加

```typescript
// 在侧边栏导航配置中添加
const NAV_ITEMS = [
  // ... 其他导航项
  {
    label: "工作流",
    href: "/workflows",
    icon: Workflow,
  },
];
```

---

## 7. API 扩展

### 7.1 执行历史列表 API

```typescript
// src/app/api/workflow/executions/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkflowOrchestrator } from "@/lib/workflow/orchestrator";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const status = searchParams.get("status") || undefined;

    const orchestrator = getWorkflowOrchestrator();
    const executions = await orchestrator.listExecutions(user.id, {
      limit,
      status,
    });

    return NextResponse.json({ executions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to list executions", message },
      { status: 500 },
    );
  }
}
```

---

## 8. 组件导出

```typescript
// src/components/workflow/index.ts

// Quick Actions
export { WorkflowQuickActions } from "./quick-actions/workflow-quick-actions";

// Execution
export { WorkflowExecutionProgress } from "./execution/workflow-execution-progress";

// Result
export { WorkflowResultCard } from "./result/workflow-result-card";

// List
export { WorkflowCard } from "./list/workflow-card";
export { WorkflowListPageClient } from "./list/workflow-list-page";
```

---

## 9. 测试计划

### 9.1 组件测试

```typescript
// src/components/workflow/__tests__/workflow-quick-actions.test.tsx

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WorkflowQuickActions } from "../quick-actions/workflow-quick-actions";

describe("WorkflowQuickActions", () => {
  it("should render toolbar variant with icons", () => {
    render(<WorkflowQuickActions variant="toolbar" />);
    // 检查图标按钮存在
  });

  it("should render sidebar variant with labels", () => {
    render(<WorkflowQuickActions variant="sidebar" />);
    expect(screen.getByText("智能收录")).toBeInTheDocument();
    expect(screen.getByText("书签巡检")).toBeInTheDocument();
  });

  it("should trigger workflow on click", async () => {
    const onExecutionStart = vi.fn();
    render(<WorkflowQuickActions onExecutionStart={onExecutionStart} />);

    fireEvent.click(screen.getByRole("button", { name: /巡检/i }));

    await waitFor(() => {
      expect(onExecutionStart).toHaveBeenCalled();
    });
  });
});
```

### 9.2 Hook 测试

```typescript
// src/hooks/workflow/__tests__/use-workflow-execution.test.ts

import { renderHook, waitFor } from "@testing-library/react";
import { useWorkflowExecution } from "../use-workflow-execution";

describe("useWorkflowExecution", () => {
  it("should fetch execution status", async () => {
    const { result } = renderHook(() =>
      useWorkflowExecution("test-execution-id"),
    );

    await waitFor(() => {
      expect(result.current.execution).toBeDefined();
    });
  });

  it("should poll while running", async () => {
    // 测试轮询逻辑
  });

  it("should stop polling when completed", async () => {
    // 测试停止轮询
  });
});
```

---

## 10. 实施步骤

### Day 1: Hooks 和基础组件

| 序号 | 任务                                     | 预估时间 |
| ---- | ---------------------------------------- | -------- |
| 1.1  | 实现 useWorkflowTrigger                  | 1h       |
| 1.2  | 实现 useWorkflowExecution（含 SSE 集成） | 2h       |
| 1.3  | 实现 useWorkflowList                     | 0.5h     |
| 1.4  | 实现 useExecutionHistory                 | 0.5h     |
| 1.5  | **实现 useWorkflowSSE Hook**             | 1.5h     |
| 1.6  | 实现 WorkflowQuickActions                | 2h       |

### Day 2: SSE 后端 + 进度组件

| 序号 | 任务                                      | 预估时间 |
| ---- | ----------------------------------------- | -------- |
| 2.1  | **实现 SSE API 端点 `/api/workflow/sse`** | 1.5h     |
| 2.2  | **SSE 降级逻辑测试**                      | 1h       |
| 2.3  | 实现 WorkflowExecutionProgress            | 2h       |
| 2.4  | 实现 WorkflowResultCard                   | 1.5h     |
| 2.5  | 编写 Hook 测试                            | 1h       |

### Day 3: 页面和集成

| 序号 | 任务                      | 预估时间 |
| ---- | ------------------------- | -------- |
| 3.1  | 实现 WorkflowCard         | 1h       |
| 3.2  | 实现执行历史 API          | 0.5h     |
| 3.3  | 实现工作流管理页面        | 2h       |
| 3.4  | 首页工具栏集成            | 1h       |
| 3.5  | 侧边栏集成                | 0.5h     |
| 3.6  | 端到端测试（含 SSE 流程） | 1.5h     |
| 3.7  | 文档更新                  | 1h       |

---

## 11. 文件清单

```
src/hooks/workflow/
├── use-workflow-trigger.ts
├── use-workflow-execution.ts      # 集成 SSE 支持
├── use-workflow-list.ts
├── use-execution-history.ts
├── use-workflow-sse.ts            # [新增] SSE 实时推送 Hook
├── index.ts
└── __tests__/
    ├── use-workflow-trigger.test.ts
    ├── use-workflow-execution.test.ts
    ├── use-workflow-sse.test.ts   # [新增] SSE Hook 测试
    └── use-workflow-list.test.ts

src/components/workflow/
├── quick-actions/
│   ├── workflow-quick-actions.tsx
│   └── index.ts
├── execution/
│   ├── workflow-execution-progress.tsx
│   └── index.ts
├── result/
│   ├── workflow-result-card.tsx
│   └── index.ts
├── list/
│   ├── workflow-card.tsx
│   ├── workflow-list-page.tsx
│   └── index.ts
├── index.ts
└── __tests__/
    ├── workflow-quick-actions.test.tsx
    ├── workflow-execution-progress.test.tsx
    └── workflow-result-card.test.tsx

src/app/(main)/workflows/
└── page.tsx

src/app/api/workflow/
├── executions/
│   └── route.ts
└── sse/
    └── route.ts                   # [新增] SSE 实时进度端点
```

---

## 12. 验收标准

### 12.1 功能验收

- [ ] WorkflowQuickActions 在首页工具栏正确显示
- [ ] 点击按钮可触发工作流并显示 Toast
- [ ] **SSE 连接成功时**：实时显示执行进度（延迟 < 500ms）
- [ ] **SSE 连接失败时**：自动降级为轮询且无用户感知
- [ ] WorkflowExecutionProgress 正确显示步骤状态
- [ ] 完成后停止 SSE/轮询
- [ ] WorkflowResultCard 正确显示结果摘要
- [ ] `/workflows` 页面正确列出工作流
- [ ] 可查看执行历史

### 12.2 质量验收

- [ ] TypeScript 类型检查通过
- [ ] ESLint 检查通过
- [ ] Hook 测试覆盖率 > 80%（含 SSE 降级场景）
- [ ] 组件测试覆盖率 > 70%
- [ ] 响应式设计（移动端适配）
- [ ] 暗色模式支持

### 12.3 性能验收

- [ ] 组件首次渲染 < 100ms
- [ ] **SSE 连接建立 < 1s**
- [ ] **SSE 降级切换无感知（< 2s）**
- [ ] 轮询不导致内存泄漏
- [ ] 列表页支持 50+ 工作流流畅显示

---

## 13. 后续阶段依赖

Phase 3（AI 集成）需要本阶段提供：

- WorkflowQuickActions 组件（用于 AI 对话中的推荐展示）
- WorkflowExecutionProgress 组件（用于对话中的进度展示）

Phase 4（扩展工作流）需要本阶段提供：

- 工作流管理页面基础设施
- 执行历史查看能力
