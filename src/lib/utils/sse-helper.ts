/**
 * Server-Sent Events (SSE) 工具函数
 *
 * 提供统一的 SSE 事件发送逻辑，减少代码重复
 *
 * @module @/lib/utils/sse-helper
 * @version 1.0.0
 * @since 2026-01-14
 */

import type { TextEncoder } from "util";
import { logger } from "@/lib/logger";

/**
 * 创建 SSE 事件发送函数
 *
 * @param controller ReadableStream 控制器
 * @param encoder TextEncoder 实例
 * @returns 发送事件的函数
 *
 * @example
 * ```typescript
 * const encoder = new TextEncoder();
 * const stream = new ReadableStream({
 *   async start(controller) {
 *     const sendEvent = createSSESender<MyChunkType>(controller, encoder);
 *     sendEvent({ type: "progress", data: { percent: 50 } });
 *   },
 * });
 * ```
 */
export function createSSESender<T>(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
): (chunk: T) => void {
  return (chunk: T) => {
    const data = JSON.stringify(chunk);
    controller.enqueue(encoder.encode(`data: ${data}\n\n`));
  };
}

/**
 * 创建带错误处理的 SSE 发送函数
 *
 * @param controller ReadableStream 控制器
 * @param encoder TextEncoder 实例
 * @param onError 错误处理回调（可选）
 * @returns 发送事件的函数
 *
 * @example
 * ```typescript
 * const sendEvent = createSSESenderWithError(
 *   controller,
 *   encoder,
 *   (error) => logger.error({ error }, "SSE send failed")
 * );
 * ```
 */
export function createSSESenderWithError<T>(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  onError?: (error: Error) => void,
): (chunk: T) => void {
  return (chunk: T) => {
    try {
      const data = JSON.stringify(chunk);
      controller.enqueue(encoder.encode(`data: ${data}\n\n`));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (onError) {
        onError(err);
      } else {
        logger.error({ err }, "SSE send error:");
      }
    }
  };
}

/**
 * 发送 SSE 错误事件
 *
 * @param controller ReadableStream 控制器
 * @param encoder TextEncoder 实例
 * @param error 错误对象或消息
 * @param closeStream 是否关闭流（默认: false）
 *
 * @example
 * ```typescript
 * try {
 *   // ... 处理逻辑
 * } catch (error) {
 *   sendSSEError(controller, encoder, error, true);
 * }
 * ```
 */
export function sendSSEError(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  error: Error | string,
  closeStream = false,
): void {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorChunk = {
    type: "error",
    error: errorMessage,
    timestamp: new Date().toISOString(),
  };
  const data = JSON.stringify(errorChunk);
  controller.enqueue(encoder.encode(`data: ${data}\n\n`));

  if (closeStream) {
    controller.close();
  }
}

/**
 * 发送 SSE 完成事件并关闭流
 *
 * @param controller ReadableStream 控制器
 * @param encoder TextEncoder 实例
 * @param data 可选的完成数据
 *
 * @example
 * ```typescript
 * sendSSEDone(controller, encoder, { result: "success" });
 * ```
 */
export function sendSSEDone<T = unknown>(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  data?: T,
): void {
  const doneChunk = {
    type: "done",
    ...(data && { data }),
    timestamp: new Date().toISOString(),
  };
  const jsonData = JSON.stringify(doneChunk);
  controller.enqueue(encoder.encode(`data: ${jsonData}\n\n`));
  controller.close();
}
