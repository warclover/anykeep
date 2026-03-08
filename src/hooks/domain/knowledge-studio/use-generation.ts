"use client";

/**
 * Knowledge Studio - 蓝图生成 Hook
 * @module hooks/domain/knowledge-studio
 * @description 管理蓝图生成流程，支持 SSE 流式输出和进度追踪
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { clientLogger } from "@/lib/client-logger";
import { API_KNOWLEDGE_STUDIO } from "@/lib/constants/api-paths";
import type {
  BlueprintType,
  StreamChunk,
  GenerationStage,
  Citation,
} from "@/lib/knowledge-studio/types";

// ============================================================================
// 类型定义
// ============================================================================

export type GenerationStatus =
  | "idle"
  | "preparing"
  | "generating"
  | "streaming"
  | "completed"
  | "error"
  | "cancelled";

export interface GenerationProgress {
  /** 当前阶段 */
  stage: GenerationStage;
  /** 阶段进度 (0-100) */
  stageProgress: number;
  /** 总进度 (0-100) */
  totalProgress: number;
  /** 阶段描述 */
  stageMessage: string;
}

export interface GenerationConfig {
  /** 蓝图类型 */
  type: BlueprintType;
  /** 目标长度 */
  targetLength?: "short" | "medium" | "long";
  /** 语气风格 */
  tone?: "formal" | "casual" | "academic";
  /** 自定义提示 */
  customPrompt?: string;
}

export interface MaterialItem {
  /** 书签 ID */
  bookmarkId: string;
  /** 标题 */
  title: string;
  /** 内容 */
  content: string;
  /** URL */
  url: string;
  /** 平台 */
  platform?: string;
}

export interface GenerationResult {
  /** 是否成功 */
  success: boolean;
  /** 报告 ID */
  reportId?: string;
  /** 生成内容 */
  content?: string;
  /** 引用列表 */
  citations?: Citation[];
  /** 错误信息 */
  error?: string;
  /** 错误码 */
  errorCode?: string;
}

export interface UseGenerationOptions {
  /** 生成完成回调 */
  onComplete?: (result: GenerationResult) => void;
  /** 进度更新回调 */
  onProgress?: (progress: GenerationProgress) => void;
  /** 错误回调 */
  onError?: (error: string) => void;
}

export interface UseGenerationReturn {
  /** 当前状态 */
  status: GenerationStatus;
  /** 进度信息 */
  progress: GenerationProgress | null;
  /** 流式输出内容 */
  streamContent: string;
  /** 生成结果 */
  result: GenerationResult | null;
  /** 错误信息 */
  error: string | null;
  /** 开始生成 */
  generate: (
    config: GenerationConfig,
    materials: MaterialItem[],
  ) => Promise<void>;
  /** 取消生成 */
  cancel: () => void;
  /** 重置状态 */
  reset: () => void;
}

// ============================================================================
// 阶段描述映射
// ============================================================================

const STAGE_MESSAGES: Record<GenerationStage, string> = {
  parsing: "正在解析素材...",
  outline: "正在生成大纲...",
  content: "正在撰写内容...",
  citations: "正在整理引用...",
  finalizing: "正在完成最后润色...",
};

// ============================================================================
// Hook 实现
// ============================================================================

export function useGeneration(
  options: UseGenerationOptions = {},
): UseGenerationReturn {
  const { onComplete, onProgress, onError } = options;

  // 状态管理
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [streamContent, setStreamContent] = useState("");
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 取消控制
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef<string | null>(null);

  // 清理函数
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // 重置状态
  const reset = useCallback(() => {
    setStatus("idle");
    setProgress(null);
    setStreamContent("");
    setResult(null);
    setError(null);
    requestIdRef.current = null;
  }, []);

  // 取消生成
  const cancel = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // 调用取消 API
    if (requestIdRef.current) {
      try {
        await fetch("/api/agent/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: requestIdRef.current }),
        });
      } catch (error) {
        clientLogger.debug(
          { error },
          "Cancel request failed (expected during cleanup)",
        );
      }
    }

    setStatus("cancelled");
  }, []);

  // 开始生成
  const generate = useCallback(
    async (config: GenerationConfig, materials: MaterialItem[]) => {
      // 重置状态
      reset();
      setStatus("preparing");

      // 创建新的 AbortController
      abortControllerRef.current = new AbortController();
      const requestId = crypto.randomUUID();
      requestIdRef.current = requestId;

      try {
        setStatus("generating");

        // 发起 SSE 请求
        const response = await fetch(API_KNOWLEDGE_STUDIO.generate, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            blueprintType: config.type,
            bookmarkIds: materials.map((m) => m.bookmarkId),
            targetLength: config.targetLength || "medium",
            tone: config.tone,
            customPrompt: config.customPrompt, // 支持自定义指令
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || "生成请求失败");
        }

        if (!response.body) {
          throw new Error("响应体为空");
        }

        setStatus("streaming");

        // 处理 SSE 流
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullContent = "";
        let receivedDoneEvent = false;

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            clientLogger.info(
              { component: "use-generation", receivedDoneEvent },
              "SSE stream ended",
            );
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") {
                clientLogger.info(
                  { component: "use-generation" },
                  "Received [DONE] marker",
                );
                continue;
              }

              try {
                const chunk: StreamChunk = JSON.parse(data);

                clientLogger.info(
                  {
                    component: "use-generation",
                    type: chunk.type,
                    data: chunk.data,
                  },
                  "Received SSE chunk",
                );

                // 处理进度更新
                if (chunk.type === "progress" && chunk.data.stage) {
                  const progressUpdate: GenerationProgress = {
                    stage: chunk.data.stage,
                    stageProgress: chunk.data.stageProgress || 0,
                    totalProgress: chunk.data.totalProgress || 0,
                    stageMessage: STAGE_MESSAGES[chunk.data.stage],
                  };
                  setProgress(progressUpdate);
                  onProgress?.(progressUpdate);
                }

                // 处理内容流
                if (chunk.type === "content" && chunk.data.content) {
                  fullContent += chunk.data.content;
                  setStreamContent(fullContent);
                }

                // 处理完成事件
                if (chunk.type === "done") {
                  receivedDoneEvent = true;
                  const reportId = chunk.data.reportId;

                  clientLogger.info(
                    {
                      component: "use-generation",
                      reportId,
                      hasReportId: !!reportId,
                    },
                    "Received done event",
                  );

                  // 检查 reportId 是否存在
                  if (!reportId) {
                    clientLogger.error(
                      { data: chunk.data },
                      "Done event received but reportId is missing:",
                    );
                    const errorResult: GenerationResult = {
                      success: false,
                      error: "生成完成但缺少报告 ID",
                      content: chunk.data.content || fullContent,
                      citations: chunk.data.citations,
                    };
                    setResult(errorResult);
                    setStatus("error");
                    onComplete?.(errorResult);
                  } else {
                    const generationResult: GenerationResult = {
                      success: true,
                      reportId: reportId,
                      content: chunk.data.content || fullContent,
                      citations: chunk.data.citations,
                    };
                    setResult(generationResult);
                    setStatus("completed");
                    onComplete?.(generationResult);
                  }
                }

                // 处理错误事件
                if (chunk.type === "error") {
                  const errorCode = chunk.data.error?.code;
                  const errorMessage = chunk.data.error?.message || "生成失败";
                  const error = new Error(errorMessage) as Error & {
                    code?: string;
                  };
                  error.code = errorCode;
                  throw error;
                }
              } catch (parseError) {
                // JSON 解析错误，可能是不完整的数据，继续处理
                if (parseError instanceof SyntaxError) continue;
                throw parseError;
              }
            }
          }
        }

        // 如果没有收到完成事件但流已结束
        // 注意：使用 receivedDoneEvent 标志而不是 status，因为状态更新是异步的
        if (!receivedDoneEvent) {
          clientLogger.info(
            { component: "use-generation", status, receivedDoneEvent },
            "Stream ended without done event",
          );
          // 如果流结束了但没有收到完成事件，可能是错误
          const generationResult: GenerationResult = {
            success: false,
            error: "生成未完成：流已结束但未收到完成事件",
            errorCode: "GENERATION_FAILED",
            content: fullContent || undefined,
          };
          setResult(generationResult);
          setStatus("error");
          onComplete?.(generationResult);
        }
        // 如果已经收到 done 事件，不需要再次处理
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          setStatus("cancelled");
          return;
        }

        const errorMessage = err instanceof Error ? err.message : "未知错误";
        const errorCode = (err as Error & { code?: string }).code;
        setError(errorMessage);
        setStatus("error");

        // 创建错误结果并传递给 onComplete
        const errorResult: GenerationResult = {
          success: false,
          error: errorMessage,
          errorCode,
        };
        setResult(errorResult);
        onComplete?.(errorResult);
        onError?.(errorMessage);
      } finally {
        abortControllerRef.current = null;
      }
    },
    [reset, onComplete, onProgress, onError, status],
  );

  return {
    status,
    progress,
    streamContent,
    result,
    error,
    generate,
    cancel,
    reset,
  };
}
