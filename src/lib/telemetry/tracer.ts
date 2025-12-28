/**
 * OpenTelemetry Tracer 实现
 *
 * 轻量级追踪器实现，支持：
 * - Span 创建和管理
 * - 上下文传播
 * - 控制台输出（开发模式）
 * - OTLP 导出（生产模式）
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import { randomBytes } from "crypto";
import { logger } from "@/lib/logger";
import type {
  Span,
  Tracer,
  SpanAttributes,
  SpanAttributeValue,
  SpanEvent,
  SpanStatus,
  SpanContext,
  StartSpanOptions,
  TelemetryConfig,
} from "./types";
import { SpanStatusCode, SpanKind, DEFAULT_TELEMETRY_CONFIG } from "./types";

// ============================================
// Span 实现
// ============================================

/**
 * Span 实现类
 */
class SpanImpl implements Span {
  name: string;
  startTime: number;
  endTime?: number;
  status: SpanStatus = { code: SpanStatusCode.UNSET };
  attributes: SpanAttributes = {};
  context: SpanContext;
  parentSpanId?: string;
  events: SpanEvent[] = [];
  private kind: SpanKind;
  private ended = false;

  constructor(
    name: string,
    options: {
      traceId?: string;
      parentSpanId?: string;
      attributes?: SpanAttributes;
      kind?: SpanKind;
    } = {},
  ) {
    this.name = name;
    this.startTime = Date.now();
    this.parentSpanId = options.parentSpanId;
    this.kind = options.kind ?? SpanKind.INTERNAL;

    if (options.attributes) {
      this.attributes = { ...options.attributes };
    }

    this.context = {
      traceId: options.traceId || generateTraceId(),
      spanId: generateSpanId(),
      traceFlags: 1, // Sampled
    };
  }

  setAttribute(key: string, value: SpanAttributeValue): void {
    if (!this.ended) {
      this.attributes[key] = value;
    }
  }

  setAttributes(attributes: SpanAttributes): void {
    if (!this.ended) {
      Object.assign(this.attributes, attributes);
    }
  }

  setStatus(status: SpanStatus): void {
    if (!this.ended) {
      this.status = status;
    }
  }

  addEvent(name: string, attributes?: SpanAttributes): void {
    if (!this.ended) {
      this.events.push({
        name,
        timestamp: Date.now(),
        attributes,
      });
    }
  }

  recordException(error: Error): void {
    this.addEvent("exception", {
      "exception.type": error.name,
      "exception.message": error.message,
      "exception.stacktrace": error.stack || "",
    });
    this.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
  }

  end(): void {
    if (!this.ended) {
      this.endTime = Date.now();
      this.ended = true;

      // 通知 SpanProcessor
      globalSpanProcessor.onEnd(this);
    }
  }

  /**
   * 获取 Span 持续时间 (ms)
   */
  getDuration(): number {
    return (this.endTime ?? Date.now()) - this.startTime;
  }

  /**
   * 转换为可序列化对象
   */
  toJSON(): object {
    return {
      name: this.name,
      traceId: this.context.traceId,
      spanId: this.context.spanId,
      parentSpanId: this.parentSpanId,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.getDuration(),
      status: this.status,
      attributes: this.attributes,
      events: this.events,
      kind: SpanKind[this.kind],
    };
  }
}

// ============================================
// Span 上下文管理
// ============================================

/**
 * 当前活跃 Span 的存储（使用 AsyncLocalStorage 在 Node.js 中）
 */
let currentSpan: Span | null = null;

/**
 * 获取当前活跃的 Span
 */
export function getActiveSpan(): Span | null {
  return currentSpan;
}

/**
 * 设置当前活跃的 Span
 */
function setActiveSpan(span: Span | null): Span | null {
  const previous = currentSpan;
  currentSpan = span;
  return previous;
}

// ============================================
// Tracer 实现
// ============================================

/**
 * Tracer 实现类
 */
class TracerImpl implements Tracer {
  private name: string;
  private version: string;

  constructor(name: string, version: string = "1.0.0") {
    this.name = name;
    this.version = version;
  }

  startSpan(name: string, options: StartSpanOptions = {}): Span {
    const parentSpan = options.parent || getActiveSpan();

    const span = new SpanImpl(name, {
      traceId: parentSpan?.context.traceId,
      parentSpanId: parentSpan?.context.spanId,
      attributes: options.attributes,
      kind: options.kind,
    });

    // 通知 SpanProcessor
    globalSpanProcessor.onStart(span);

    return span;
  }

  startActiveSpan<T>(
    name: string,
    optionsOrFn: StartSpanOptions | ((span: Span) => T | Promise<T>),
    fn?: (span: Span) => T | Promise<T>,
  ): T | Promise<T> {
    const options = typeof optionsOrFn === "function" ? {} : optionsOrFn;
    const callback = typeof optionsOrFn === "function" ? optionsOrFn : fn!;

    const span = this.startSpan(name, options);
    const previousSpan = setActiveSpan(span);

    try {
      const result = callback(span);

      if (result instanceof Promise) {
        return result
          .then((value) => {
            if (span.status.code === SpanStatusCode.UNSET) {
              span.setStatus({ code: SpanStatusCode.OK });
            }
            span.end();
            setActiveSpan(previousSpan);
            return value;
          })
          .catch((error) => {
            span.recordException(error);
            span.end();
            setActiveSpan(previousSpan);
            throw error;
          });
      } else {
        if (span.status.code === SpanStatusCode.UNSET) {
          span.setStatus({ code: SpanStatusCode.OK });
        }
        span.end();
        setActiveSpan(previousSpan);
        return result;
      }
    } catch (error) {
      span.recordException(error as Error);
      span.end();
      setActiveSpan(previousSpan);
      throw error;
    }
  }
}

// ============================================
// Span Processor
// ============================================

/**
 * Span 处理器接口
 */
interface SpanProcessor {
  onStart(span: Span): void;
  onEnd(span: Span): void;
  shutdown(): Promise<void>;
}

/**
 * 控制台 Span 处理器（开发模式）
 */
class ConsoleSpanProcessor implements SpanProcessor {
  onStart(_span: Span): void {
    // 不在开始时输出
  }

  onEnd(span: Span): void {
    const spanImpl = span as SpanImpl;
    const duration = spanImpl.getDuration();
    const isError = span.status.code === SpanStatusCode.ERROR;

    // 简洁的日志格式
    const logData = {
      span: span.name,
      traceId: span.context.traceId.slice(0, 8),
      duration: `${duration}ms`,
      status: isError ? "ERROR" : "OK",
      ...span.attributes,
    };

    if (isError) {
      logger.warn(logData, `Span completed with error`);
    } else if (duration > 1000) {
      logger.warn(logData, `Slow span detected`);
    } else {
      logger.debug(logData, `Span completed`);
    }
  }

  async shutdown(): Promise<void> {
    // 无需清理
  }
}

/**
 * 批量 Span 处理器（生产模式）
 */
class BatchSpanProcessor implements SpanProcessor {
  private buffer: Span[] = [];
  private readonly maxBatchSize = 100;
  private readonly flushIntervalMs = 5000;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private endpoint: string;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
    this.startFlushTimer();
  }

  onStart(_span: Span): void {
    // 无操作
  }

  onEnd(span: Span): void {
    this.buffer.push(span);

    if (this.buffer.length >= this.maxBatchSize) {
      this.flush();
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      if (this.buffer.length > 0) {
        this.flush();
      }
    }, this.flushIntervalMs);
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const spans = [...this.buffer];
    this.buffer = [];

    try {
      // 转换为 OTLP 格式
      const exportData = {
        resourceSpans: [
          {
            resource: {
              attributes: [
                { key: "service.name", value: { stringValue: "anykeep" } },
              ],
            },
            scopeSpans: [
              {
                spans: spans.map((span) => this.toOTLPSpan(span)),
              },
            ],
          },
        ],
      };

      await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(exportData),
      });
    } catch (error) {
      logger.error({ error }, "Failed to export spans");
      // 重新加入缓冲区
      this.buffer.unshift(...spans);
    }
  }

  private toOTLPSpan(span: Span): object {
    const _spanImpl = span as SpanImpl;
    return {
      traceId: span.context.traceId,
      spanId: span.context.spanId,
      parentSpanId: span.parentSpanId,
      name: span.name,
      startTimeUnixNano: span.startTime * 1_000_000,
      endTimeUnixNano: (span.endTime ?? Date.now()) * 1_000_000,
      status: {
        code: span.status.code,
        message: span.status.message,
      },
      attributes: Object.entries(span.attributes).map(([key, value]) => ({
        key,
        value: this.toOTLPValue(value),
      })),
    };
  }

  private toOTLPValue(value: SpanAttributeValue): {
    stringValue?: string;
    intValue?: number;
    boolValue?: boolean;
  } {
    if (typeof value === "string") {
      return { stringValue: value };
    } else if (typeof value === "number") {
      return { intValue: value };
    } else if (typeof value === "boolean") {
      return { boolValue: value };
    }
    return { stringValue: String(value) };
  }

  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flush();
  }
}

/**
 * 空操作 Span 处理器（遥测禁用时）
 */
class NoopSpanProcessor implements SpanProcessor {
  onStart(_span: Span): void {
    // 空操作处理器 - 不执行任何操作
  }
  onEnd(_span: Span): void {
    // 空操作处理器 - 不执行任何操作
  }
  async shutdown(): Promise<void> {
    // 空操作处理器 - 不执行任何操作
  }
}

// ============================================
// 全局实例
// ============================================

let globalSpanProcessor: SpanProcessor = new NoopSpanProcessor();
let globalTracer: Tracer | null = null;
let telemetryConfig: TelemetryConfig = DEFAULT_TELEMETRY_CONFIG;

/**
 * 初始化遥测系统
 */
export function initTelemetry(config?: Partial<TelemetryConfig>): void {
  telemetryConfig = { ...DEFAULT_TELEMETRY_CONFIG, ...config };

  if (!telemetryConfig.enabled) {
    globalSpanProcessor = new NoopSpanProcessor();
    logger.info("Telemetry disabled");
    return;
  }

  if (telemetryConfig.otlpEndpoint) {
    globalSpanProcessor = new BatchSpanProcessor(telemetryConfig.otlpEndpoint);
    logger.info(
      { endpoint: telemetryConfig.otlpEndpoint },
      "Telemetry initialized with OTLP exporter",
    );
  } else if (telemetryConfig.consoleExport) {
    globalSpanProcessor = new ConsoleSpanProcessor();
    logger.info("Telemetry initialized with console exporter");
  }
}

/**
 * 获取 Tracer 实例
 */
export function getTracer(
  name: string = "anykeep",
  version: string = "1.0.0",
): Tracer {
  if (!globalTracer) {
    globalTracer = new TracerImpl(name, version);
  }
  return globalTracer;
}

/**
 * 关闭遥测系统
 */
export async function shutdownTelemetry(): Promise<void> {
  await globalSpanProcessor.shutdown();
}

// ============================================
// 辅助函数
// ============================================

/**
 * 生成 Trace ID (32 字符十六进制)
 */
function generateTraceId(): string {
  return randomBytes(16).toString("hex");
}

/**
 * 生成 Span ID (16 字符十六进制)
 */
function generateSpanId(): string {
  return randomBytes(8).toString("hex");
}
