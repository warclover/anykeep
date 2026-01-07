/**
 * Knowledge Studio 风格适配 Hook（P1-1）
 *
 * 支持将内容适配到不同平台风格（一稿多发）
 *
 * @version 1.0.0
 * @since 2026-01-07
 */

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import type { PlatformStyle } from "@/lib/knowledge-studio/v2/constants";

// ============================================
// 类型定义
// ============================================

export type AdaptStyleStatus = "idle" | "adapting" | "success" | "error";

export interface AdaptStyleState {
  /** 当前状态 */
  status: AdaptStyleStatus;
  /** 适配进度 (0-100) */
  progress: number;
  /** 适配后的内容 */
  adaptedContent: string;
  /** 原始字数 */
  originalWords: number;
  /** 最终字数 */
  finalWords: number;
  /** 目标风格 */
  targetStyle: PlatformStyle | null;
  /** 错误信息 */
  error: string | null;
}

export interface AdaptStyleOptions {
  /** 原始内容 */
  content: string;
  /** 原始风格 */
  sourceStyle: PlatformStyle;
  /** 目标风格 */
  targetStyle: PlatformStyle;
}

// ============================================
// 初始状态
// ============================================

const initialState: AdaptStyleState = {
  status: "idle",
  progress: 0,
  adaptedContent: "",
  originalWords: 0,
  finalWords: 0,
  targetStyle: null,
  error: null,
};

// ============================================
// Hook 实现
// ============================================

/**
 * 风格适配 Hook
 *
 * @example
 * ```tsx
 * const { state, adaptStyle, reset } = useAdaptStyle();
 *
 * // 适配
 * await adaptStyle({
 *   content: "原始内容...",
 *   sourceStyle: "general",
 *   targetStyle: "xiaohongshu"
 * });
 *
 * // 使用结果
 * console.log(state.adaptedContent);
 * ```
 */
export function useAdaptStyle() {
  const [state, setState] = useState<AdaptStyleState>(initialState);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 清理函数
  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    cleanup();
    setState(initialState);
  }, [cleanup]);

  /**
   * 执行风格适配
   */
  const adaptStyle = useCallback(
    async (options: AdaptStyleOptions): Promise<boolean> => {
      const { content, sourceStyle, targetStyle } = options;

      if (!content || content.trim().length < 10) {
        toast.error("内容过短，无法适配");
        return false;
      }

      if (sourceStyle === targetStyle) {
        // 风格相同，直接返回原内容
        setState({
          status: "success",
          progress: 100,
          adaptedContent: content,
          originalWords: content.length,
          finalWords: content.length,
          targetStyle,
          error: null,
        });
        return true;
      }

      // 清理之前的状态
      cleanup();

      setState({
        status: "adapting",
        progress: 0,
        adaptedContent: "",
        originalWords: 0,
        finalWords: 0,
        targetStyle,
        error: null,
      });

      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch("/api/knowledge-studio/v2/adapt-style", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content,
            sourceStyle,
            targetStyle,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error?.message || `请求失败: ${response.status}`,
          );
        }

        // 检查是否为 SSE 流
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("text/event-stream")) {
          // 处理 SSE 流
          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error("无法获取响应流");
          }

          const decoder = new TextDecoder();
          let buffer = "";
          let fullContent = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const data = JSON.parse(line.slice(6));

                  switch (data.type) {
                    case "content":
                      fullContent += data.text;
                      setState((prev) => ({
                        ...prev,
                        adaptedContent: fullContent,
                      }));
                      break;

                    case "progress":
                      setState((prev) => ({
                        ...prev,
                        progress: data.percent,
                      }));
                      break;

                    case "done":
                      setState((prev) => ({
                        ...prev,
                        status: "success",
                        progress: 100,
                        originalWords: data.originalWords,
                        finalWords: data.finalWords,
                        targetStyle: data.targetStyle,
                      }));
                      break;

                    case "error":
                      throw new Error(data.message);
                  }
                } catch (parseError) {
                  // 忽略解析错误，继续处理
                  // SSE 解析错误可忽略（非完整 JSON 块）
                  void parseError;
                }
              }
            }
          }

          return true;
        } else {
          // 非流式响应（风格相同时直接返回 JSON）
          const result = await response.json();
          setState({
            status: "success",
            progress: 100,
            adaptedContent: result.adaptedContent,
            originalWords: result.originalWords,
            finalWords: result.finalWords,
            targetStyle: result.targetStyle,
            error: null,
          });
          return true;
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          setState(initialState);
          return false;
        }

        const message = error instanceof Error ? error.message : "适配失败";
        setState((prev) => ({
          ...prev,
          status: "error",
          error: message,
        }));
        toast.error("风格适配失败", { description: message });
        return false;
      }
    },
    [cleanup],
  );

  return {
    state,
    isAdapting: state.status === "adapting",
    isSuccess: state.status === "success",
    adaptStyle,
    reset,
  };
}
