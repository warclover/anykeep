/**
 * SSE Stream Emitter - 流式事件发射器
 * @module knowledge-studio/streaming
 * @description SSE 流式输出支持，遵循 5 阶段进度协议
 */

import type {
  StreamChunk,
  StreamEventType,
  GenerationStage,
  SSEEvent,
  Citation,
  RecoverableError,
} from "../types";

/**
 * StreamEmitter 配置
 */
export interface StreamEmitterConfig {
  requestId: string;
  onWrite: (data: string) => void;
  onClose?: () => void;
}

/**
 * StreamEmitter - SSE 流式事件发射器
 *
 * 职责：
 * 1. 格式化 SSE 事件
 * 2. 发送进度更新
 * 3. 发送文本片段
 * 4. 发送引用信息
 * 5. 处理错误和完成事件
 */
export class StreamEmitter {
  private config: StreamEmitterConfig;
  private closed = false;

  constructor(config: StreamEmitterConfig) {
    this.config = config;
  }

  /**
   * 发送文本片段
   */
  emitText(text: string): void {
    this.emit("text", { text });
  }

  /**
   * 发送进度更新
   */
  emitProgress(
    stage: GenerationStage,
    stageProgress: number,
    totalProgress: number,
  ): void {
    this.emit("progress", {
      stage,
      stageProgress,
      totalProgress,
    });
  }

  /**
   * 发送阶段变更
   */
  emitStage(stage: GenerationStage): void {
    this.emit("stage", { stage });
  }

  /**
   * 发送引用信息
   */
  emitCitation(citation: Citation): void {
    this.emit("citation", { citation });
  }

  /**
   * 发送错误
   */
  emitError(error: RecoverableError): void {
    this.emit("error", { error });
  }

  /**
   * 发送完成事件
   */
  emitDone(metadata?: Record<string, unknown>): void {
    this.emit("done", metadata || {});
    this.close();
  }

  /**
   * 关闭流
   */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.config.onClose?.();
  }

  /**
   * 检查流是否已关闭
   */
  isClosed(): boolean {
    return this.closed;
  }

  /**
   * 发送 SSE 事件
   */
  private emit(type: StreamEventType, data: Record<string, unknown>): void {
    if (this.closed) return;

    const chunk: StreamChunk = {
      type,
      data: data as StreamChunk["data"],
      timestamp: new Date().toISOString(),
      requestId: this.config.requestId,
    };

    const event: SSEEvent = {
      event: `generation:${type}`,
      data: chunk,
    };

    // 格式化 SSE 输出
    const sseFormatted = `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
    this.config.onWrite(sseFormatted);
  }
}

/**
 * 创建 SSE 响应
 */
export function createSSEResponse(
  requestId: string,
  handler: (emitter: StreamEmitter) => Promise<void>,
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emitter = new StreamEmitter({
        requestId,
        onWrite: (data) => {
          controller.enqueue(encoder.encode(data));
        },
        onClose: () => {
          controller.close();
        },
      });

      try {
        await handler(emitter);
        if (!emitter.isClosed()) {
          emitter.emitDone();
        }
      } catch (error) {
        emitter.emitError({
          code: "STREAM_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
          recoverable: false,
        });
        emitter.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Request-Id": requestId,
    },
  });
}

/**
 * SSE 客户端解析器
 */
export function parseSSEEvent(eventString: string): SSEEvent | null {
  const lines = eventString.split("\n");
  let event = "";
  let data = "";

  for (const line of lines) {
    if (line.startsWith("event: ")) {
      event = line.slice(7);
    } else if (line.startsWith("data: ")) {
      data = line.slice(6);
    }
  }

  if (!event || !data) return null;

  try {
    return {
      event: event as SSEEvent["event"],
      data: JSON.parse(data),
    };
  } catch {
    return null;
  }
}
