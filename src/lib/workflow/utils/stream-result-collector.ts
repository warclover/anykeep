/**
 * 流式结果收集器
 *
 * 将 AsyncGenerator<UnifiedStreamChunk> 转换为同步可用的结果
 * 解决 UnifiedEngine.execute() 返回类型与工作流同步需求的不兼容问题
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import { logger } from "@/lib/logger";
import type { UnifiedStreamChunk } from "@/lib/ai-skills/output/types";

/**
 * 收集后的结果
 */
export interface CollectedResult {
  /** 合并的文本内容 */
  text: string;
  /** 所有交付物 */
  deliverables: Array<{ format: string; content: unknown }>;
  /** 最终状态 */
  status: "completed" | "failed";
  /** 错误信息（如果失败） */
  error?: string;
  /** 原始 chunks（调试用） */
  rawChunks: UnifiedStreamChunk[];
}

/**
 * 收集选项
 */
export interface CollectOptions {
  /** 超时时间（毫秒），默认 60000 */
  timeout?: number;
  /** 进度回调 */
  onProgress?: (chunk: UnifiedStreamChunk) => void;
  /** 是否保留原始 chunks */
  keepRawChunks?: boolean;
  /** 取消信号 */
  signal?: AbortSignal;
}

/**
 * 收集流式结果
 *
 * @param stream - UnifiedEngine.execute() 返回的 AsyncGenerator
 * @param options - 收集选项
 * @returns 收集后的同步结果
 */
export async function collectStreamResult(
  stream: AsyncGenerator<UnifiedStreamChunk>,
  options: CollectOptions = {},
): Promise<CollectedResult> {
  const {
    timeout = 60000,
    onProgress,
    keepRawChunks = false,
    signal,
  } = options;
  const startTime = performance.now();

  const result: CollectedResult = {
    text: "",
    deliverables: [],
    status: "completed",
    rawChunks: [],
  };

  const textParts: string[] = [];

  try {
    // 设置超时
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timeoutId = setTimeout(
        () => reject(new Error("Stream collection timeout")),
        timeout,
      );

      // 如果有取消信号，在取消时清除超时
      if (signal) {
        signal.addEventListener("abort", () => {
          clearTimeout(timeoutId);
          reject(new Error("Stream collection cancelled"));
        });
      }
    });

    // 收集流
    const collectPromise = (async () => {
      for await (const chunk of stream) {
        // 检查超时
        if (performance.now() - startTime > timeout) {
          throw new Error("Stream collection timeout");
        }

        // 检查取消
        if (signal?.aborted) {
          throw new Error("Stream collection cancelled");
        }

        // 保存原始 chunk（如果需要）
        if (keepRawChunks) {
          result.rawChunks.push(chunk);
        }

        // 进度回调
        if (onProgress) {
          onProgress(chunk);
        }

        // 处理不同类型的 chunk
        switch (chunk.type) {
          case "text":
            if (chunk.data?.text) {
              textParts.push(chunk.data.text);
            }
            break;

          case "deliverable":
            if (chunk.data?.format && chunk.data?.content !== undefined) {
              result.deliverables.push({
                format: chunk.data.format,
                content: chunk.data.content,
              });
            }
            break;

          case "error":
            result.status = "failed";
            result.error = chunk.data?.message || "Unknown error";
            break;

          case "done":
            // 流结束，检查是否成功
            if (chunk.data?.success === false) {
              result.status = "failed";
            }
            break;

          default:
            // 其他类型（routing, progress, thinking 等）忽略
            break;
        }
      }
    })();

    await Promise.race([collectPromise, timeoutPromise]);

    // 合并文本
    result.text = textParts.join("");

    logger.debug(
      {
        textLength: result.text.length,
        deliverablesCount: result.deliverables.length,
        durationMs: Math.round(performance.now() - startTime),
      },
      "StreamResultCollector: Collection completed",
    );

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(
      {
        error: errorMessage,
        durationMs: Math.round(performance.now() - startTime),
      },
      "StreamResultCollector: Collection failed",
    );

    return {
      text: textParts.join(""),
      deliverables: result.deliverables,
      status: "failed",
      error: errorMessage,
      rawChunks: result.rawChunks,
    };
  }
}

/**
 * 从收集结果中提取主要交付物
 *
 * @param result - 收集结果
 * @returns 主要交付物内容，或 null
 */
export function extractPrimaryDeliverable(
  result: CollectedResult,
): unknown | null {
  if (result.deliverables.length === 0) {
    return null;
  }

  // 优先返回 JSON 格式
  const jsonDeliverable = result.deliverables.find((d) => d.format === "json");
  if (jsonDeliverable) {
    return jsonDeliverable.content;
  }

  // 其次返回第一个
  return result.deliverables[0].content;
}

/**
 * 检查收集结果是否成功
 */
export function isCollectionSuccess(result: CollectedResult): boolean {
  return result.status === "completed" && !result.error;
}
