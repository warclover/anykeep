/**
 * 综述流式生成 Hook
 *
 * 通过 SSE 获取综述生成的实时进度和内容
 * 支持客户端和服务端取消
 *
 * @version 1.1.0
 * @since 2025-12-29
 */

"use client";

import { useCallback, useRef, useState } from "react";
import { API_SYNTHESIS } from "@/lib/constants/api-paths";
import type {
  SynthesisSSEEvent,
  SynthesisProgressData,
  ConsensusPoint,
  DivergencePoint,
  BlindSpot,
} from "@/lib/synthesis";
import { clientLogger } from "@/lib/client-logger";

interface SynthesisStreamState {
  /** 当前状态 */
  status:
    | "idle"
    | "connecting"
    | "generating"
    | "completed"
    | "error"
    | "cancelled";
  /** 进度信息 */
  progress: SynthesisProgressData | null;
  /** 概述内容 */
  overview: string | null;
  /** 共识点 */
  consensus: ConsensusPoint[];
  /** 分歧点 */
  divergence: DivergencePoint[];
  /** 盲区 */
  blindSpots: BlindSpot[];
  /** 错误信息 */
  error: string | null;
  /** 完成时的字数 */
  wordCount: number;
}

interface UseSynthesisStreamResult {
  /** 流状态 */
  state: SynthesisStreamState;
  /** 开始生成 */
  startGeneration: (reportId: string) => void;
  /** 停止生成（客户端取消） */
  stopGeneration: () => void;
  /** 取消生成（同时通知服务端） */
  cancelGeneration: (reportId: string) => Promise<void>;
  /** 是否正在生成 */
  isGenerating: boolean;
  /** 是否正在取消 */
  isCancelling: boolean;
}

const initialState: SynthesisStreamState = {
  status: "idle",
  progress: null,
  overview: null,
  consensus: [],
  divergence: [],
  blindSpots: [],
  error: null,
  wordCount: 0,
};

/**
 * 综述流式生成 Hook
 */
export function useSynthesisStream(): UseSynthesisStreamResult {
  const [state, setState] = useState<SynthesisStreamState>(initialState);
  const [isCancelling, setIsCancelling] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentReportIdRef = useRef<string | null>(null);

  /**
   * 开始生成
   */
  const startGeneration = useCallback((reportId: string) => {
    // 如果已经在生成，先停止
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // 保存当前 reportId
    currentReportIdRef.current = reportId;

    // 重置状态
    setState({
      ...initialState,
      status: "connecting",
    });

    // 创建新的 AbortController
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // 发起 SSE 请求
    fetch(API_SYNTHESIS.generate, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reportId }),
      signal: abortController.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to start generation");
        }

        setState((prev) => ({ ...prev, status: "generating" }));

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });

          // 解析 SSE 事件
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const event: SynthesisSSEEvent = JSON.parse(line.slice(6));
                handleEvent(event);
              } catch (e) {
                clientLogger.error({ e }, "Failed to parse SSE event:");
              }
            }
          }
        }
      })
      .catch((error) => {
        if (error.name === "AbortError") {
          // 用户主动取消
          return;
        }

        setState((prev) => ({
          ...prev,
          status: "error",
          error: error.message || "Generation failed",
        }));
      });

    /**
     * 处理 SSE 事件
     */
    function handleEvent(event: SynthesisSSEEvent) {
      switch (event.type) {
        case "progress":
          setState((prev) => ({
            ...prev,
            progress: event.data,
          }));
          break;

        case "overview":
          setState((prev) => ({
            ...prev,
            overview: event.data.content,
          }));
          break;

        case "consensus":
          setState((prev) => ({
            ...prev,
            consensus: event.data.items,
          }));
          break;

        case "divergence":
          setState((prev) => ({
            ...prev,
            divergence: event.data.items,
          }));
          break;

        case "blindspot":
          setState((prev) => ({
            ...prev,
            blindSpots: event.data.items,
          }));
          break;

        case "complete":
          setState((prev) => ({
            ...prev,
            status: "completed",
            wordCount: event.data.wordCount,
          }));
          break;

        case "error":
          setState((prev) => ({
            ...prev,
            status: "error",
            error: event.data.message,
          }));
          break;
      }
    }
  }, []);

  /**
   * 停止生成（仅客户端）
   */
  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;

      setState((prev) => ({
        ...prev,
        status: "idle",
      }));
    }
  }, []);

  /**
   * 取消生成（通知服务端）
   */
  const cancelGeneration = useCallback(async (reportId: string) => {
    setIsCancelling(true);

    try {
      // 先中断客户端请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      // 通知服务端取消
      const response = await fetch(API_SYNTHESIS.cancel(reportId), {
        method: "POST",
      });

      if (!response.ok) {
        clientLogger.error("Failed to cancel synthesis on server");
      }

      setState((prev) => ({
        ...prev,
        status: "cancelled",
      }));
    } catch (error) {
      clientLogger.error({ error }, "Cancel synthesis error:");
      setState((prev) => ({
        ...prev,
        status: "error",
        error: "取消失败",
      }));
    } finally {
      setIsCancelling(false);
      currentReportIdRef.current = null;
    }
  }, []);

  return {
    state,
    startGeneration,
    stopGeneration,
    cancelGeneration,
    isGenerating:
      state.status === "connecting" || state.status === "generating",
    isCancelling,
  };
}
