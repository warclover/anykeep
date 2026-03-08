/**
 * useGeneration - 合成报告生成 Hook
 * @module hooks/knowledge-studio
 * @description 管理 SSE 流式生成状态
 */

"use client";

import { useState, useCallback, useRef } from "react";
import { API_KNOWLEDGE_STUDIO } from "@/lib/constants/api-paths";
import type {
  BlueprintType,
  StreamChunk,
  Citation,
} from "@/lib/knowledge-studio";

/**
 * 生成状态
 */
export type GenerationStatus =
  | "idle"
  | "preparing"
  | "generating"
  | "saving"
  | "success"
  | "error";

/**
 * 生成阶段
 */
export type GenerationStage =
  | "parsing"
  | "outline"
  | "content"
  | "citations"
  | "finalizing";

/**
 * 生成进度
 */
export interface GenerationProgress {
  status: GenerationStatus;
  stage?: GenerationStage;
  stageProgress: number;
  totalProgress: number;
  message?: string;
}

/**
 * 生成配置
 */
export interface GenerationConfig {
  blueprintType: BlueprintType;
  bookmarkIds: string[];
  title?: string;
  customPrompt?: string;
  targetLength?: "short" | "medium" | "long";
  tone?: string;
}

/**
 * 生成结果
 */
export interface GenerationResult {
  reportId?: string;
  content?: string;
  citations?: Citation[];
  error?: {
    code: string;
    message: string;
    recoverable?: boolean;
  };
}

/**
 * Hook 返回值
 */
export interface UseGenerationReturn {
  progress: GenerationProgress;
  result: GenerationResult | null;
  generate: (config: GenerationConfig) => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

/**
 * useGeneration Hook
 */
export function useGeneration(): UseGenerationReturn {
  const [progress, setProgress] = useState<GenerationProgress>({
    status: "idle",
    stageProgress: 0,
    totalProgress: 0,
  });
  const [result, setResult] = useState<GenerationResult | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const generate = useCallback(async (config: GenerationConfig) => {
    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    setProgress({
      status: "preparing",
      stageProgress: 0,
      totalProgress: 0,
      message: "准备生成...",
    });
    setResult(null);

    try {
      const response = await fetch(API_KNOWLEDGE_STUDIO.generate, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
        signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "生成请求失败");
      }

      if (!response.body) {
        throw new Error("无法读取响应流");
      }

      setProgress((prev) => ({
        ...prev,
        status: "generating",
        message: "正在生成...",
      }));

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const chunk: StreamChunk = JSON.parse(line.slice(6));

              switch (chunk.type) {
                case "progress":
                  setProgress({
                    status: "generating",
                    stage: chunk.data.stage as GenerationStage,
                    stageProgress: chunk.data.stageProgress || 0,
                    totalProgress: chunk.data.totalProgress || 0,
                    message: getStageMessage(
                      chunk.data.stage as GenerationStage,
                    ),
                  });
                  break;

                case "done":
                  setProgress({
                    status: "success",
                    stageProgress: 100,
                    totalProgress: 100,
                    message: "生成完成！",
                  });
                  setResult({
                    reportId: chunk.data.reportId as string,
                    content: chunk.data.content as string,
                    citations: chunk.data.citations as Citation[],
                  });
                  break;

                case "error":
                  setProgress({
                    status: "error",
                    stageProgress: 0,
                    totalProgress: 0,
                    message: chunk.data.error?.message || "生成失败",
                  });
                  setResult({
                    error: {
                      code: chunk.data.error?.code || "UNKNOWN_ERROR",
                      message: chunk.data.error?.message || "生成失败",
                      recoverable: chunk.data.error?.recoverable ?? false,
                    },
                  });
                  break;
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setProgress({
          status: "idle",
          stageProgress: 0,
          totalProgress: 0,
          message: "已取消",
        });
        return;
      }

      setProgress({
        status: "error",
        stageProgress: 0,
        totalProgress: 0,
        message: error instanceof Error ? error.message : "生成失败",
      });
      setResult({
        error: {
          code: "GENERATION_ERROR",
          message: error instanceof Error ? error.message : "生成失败",
          recoverable: true,
        },
      });
    }
  }, []);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    cancel();
    setProgress({
      status: "idle",
      stageProgress: 0,
      totalProgress: 0,
    });
    setResult(null);
  }, [cancel]);

  return { progress, result, generate, cancel, reset };
}

/**
 * 获取阶段消息
 */
function getStageMessage(stage?: GenerationStage): string {
  switch (stage) {
    case "parsing":
      return "解析素材内容...";
    case "outline":
      return "生成文档大纲...";
    case "content":
      return "填充正文内容...";
    case "citations":
      return "添加引用标记...";
    case "finalizing":
      return "最终格式化...";
    default:
      return "正在生成...";
  }
}
