/**
 * Debug Trace 基础设施
 *
 * 用于追踪 AI 路由过程的各个阶段，便于问题诊断和性能分析
 * 通过环境变量 AI_DEBUG_TRACE=true 启用
 *
 * CTO 硬性要求：必须能输出完整追踪日志
 *
 * @version 1.0.0
 * @since 2026-02-01
 */

import { logger } from "@/lib/logger";

// ============================================
// 类型定义
// ============================================

/**
 * 追踪阶段类型
 */
export type TraceStageType =
  | "preprocessing"
  | "cache_lookup"
  | "intent"
  | "complexity"
  | "routing"
  | "execution"
  | "enhancement"
  | "output";

/**
 * 追踪阶段记录
 */
export interface TraceStage {
  /** 阶段类型 */
  stage: TraceStageType;
  /** 阶段耗时（毫秒） */
  latencyMs: number;
  /** 输入数据 */
  input: unknown;
  /** 输出数据 */
  output: unknown;
  /** 决策说明 */
  decision?: string;
  /** 错误信息 */
  error?: string;
  /** 开始时间戳 */
  startTime: number;
  /** 结束时间戳 */
  endTime: number;
}

/**
 * 完整追踪记录
 */
export interface DebugTrace {
  /** 请求 ID */
  requestId: string;
  /** 用户 ID */
  userId?: string;
  /** 会话 ID */
  sessionId?: string;
  /** 追踪开始时间戳 */
  timestamp: number;
  /** 原始消息 */
  originalMessage: string;
  /** 各阶段记录 */
  stages: TraceStage[];
  /** 总耗时（毫秒） */
  totalLatencyMs: number;
  /** 最终结果摘要 */
  summary?: TraceSummary;
}

/**
 * 追踪结果摘要
 */
export interface TraceSummary {
  /** 最终意图 */
  intent: string;
  /** 意图子类型 */
  subType?: string;
  /** 置信度 */
  confidence: number;
  /** 执行模式 */
  mode: string;
  /** 推荐 Skill */
  suggestedSkill?: string;
  /** 缓存命中 */
  cacheHit: string;
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  errorMessage?: string;
}

// ============================================
// 环境变量控制
// ============================================

/**
 * 检查是否启用 Debug Trace
 */
export function isDebugTraceEnabled(): boolean {
  return process.env.AI_DEBUG_TRACE === "true";
}

/**
 * 获取 Debug Trace 日志级别
 */
export function getTraceLogLevel(): "debug" | "info" | "warn" {
  const level = process.env.AI_DEBUG_TRACE_LEVEL;
  if (level === "info" || level === "warn") {
    return level;
  }
  return "debug";
}

// ============================================
// DebugTracer 类
// ============================================

/**
 * Debug 追踪器
 *
 * 用于记录 AI 路由过程的各个阶段
 *
 * @example
 * ```typescript
 * const tracer = new DebugTracer(requestId);
 *
 * // 记录预处理阶段
 * tracer.startStage('preprocessing');
 * const preprocessed = await preprocessor.process(message);
 * tracer.endStage('preprocessing', { message }, { preprocessed }, '预处理完成');
 *
 * // 记录意图分析阶段
 * tracer.startStage('intent');
 * const intent = await classifier.classify(preprocessed);
 * tracer.endStage('intent', { preprocessed }, { intent }, '选择 skill: knowledge_search, 置信度: 0.87');
 *
 * // 获取追踪结果
 * const trace = tracer.getTrace();
 * console.log(tracer.diagnose());
 * ```
 */
export class DebugTracer {
  private trace: DebugTrace;
  private enabled: boolean;
  private currentStage: { type: TraceStageType; startTime: number } | null =
    null;

  constructor(
    requestId: string,
    options?: {
      userId?: string;
      sessionId?: string;
      originalMessage?: string;
    },
  ) {
    this.enabled = isDebugTraceEnabled();
    this.trace = {
      requestId,
      userId: options?.userId,
      sessionId: options?.sessionId,
      timestamp: Date.now(),
      originalMessage: options?.originalMessage ?? "",
      stages: [],
      totalLatencyMs: 0,
    };
  }

  /**
   * 开始记录一个阶段
   */
  startStage(stage: TraceStageType): void {
    if (!this.enabled) return;

    this.currentStage = {
      type: stage,
      startTime: performance.now(),
    };
  }

  /**
   * 结束当前阶段的记录
   */
  endStage(
    stage: TraceStageType,
    input: unknown,
    output: unknown,
    decision?: string,
    error?: string,
  ): void {
    if (!this.enabled) return;

    const endTime = performance.now();
    const startTime =
      this.currentStage?.type === stage
        ? this.currentStage.startTime
        : endTime - 1;

    const stageRecord: TraceStage = {
      stage,
      latencyMs: Math.round((endTime - startTime) * 100) / 100,
      input: this.sanitizeData(input),
      output: this.sanitizeData(output),
      decision,
      error,
      startTime,
      endTime,
    };

    this.trace.stages.push(stageRecord);
    this.trace.totalLatencyMs += stageRecord.latencyMs;
    this.currentStage = null;
  }

  /**
   * 快捷方法：记录一个阶段（自动计时）
   */
  async traceStage<T>(
    stage: TraceStageType,
    input: unknown,
    executor: () => Promise<T>,
    decisionFn?: (result: T) => string,
  ): Promise<T> {
    if (!this.enabled) {
      return executor();
    }

    this.startStage(stage);
    try {
      const result = await executor();
      const decision = decisionFn ? decisionFn(result) : undefined;
      this.endStage(stage, input, result, decision);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.endStage(stage, input, null, undefined, error);
      throw err;
    }
  }

  /**
   * 添加阶段记录（完整记录）
   */
  addStage(stage: TraceStage): void {
    if (!this.enabled) return;
    this.trace.stages.push(stage);
    this.trace.totalLatencyMs += stage.latencyMs;
  }

  /**
   * 设置追踪摘要
   */
  setSummary(summary: TraceSummary): void {
    if (!this.enabled) return;
    this.trace.summary = summary;
  }

  /**
   * 获取完整追踪记录
   */
  getTrace(): DebugTrace {
    return { ...this.trace };
  }

  /**
   * 快速诊断：定位问题出在哪个阶段
   */
  diagnose(): string {
    if (!this.enabled) {
      return "Debug trace disabled";
    }

    // 检查是否有失败阶段
    const failedStage = this.trace.stages.find((s) => s.error);
    if (failedStage) {
      return `❌ 失败阶段: ${failedStage.stage}, 原因: ${failedStage.error}`;
    }

    // 找出最慢的阶段
    if (this.trace.stages.length === 0) {
      return "⚠️ 无阶段记录";
    }

    const slowestStage = this.trace.stages.reduce((a, b) =>
      a.latencyMs > b.latencyMs ? a : b,
    );

    const lines: string[] = [
      `✅ 总耗时: ${this.trace.totalLatencyMs.toFixed(2)}ms`,
      `📊 最慢阶段: ${slowestStage.stage} (${slowestStage.latencyMs.toFixed(2)}ms)`,
    ];

    if (this.trace.summary) {
      lines.push(
        `🎯 意图: ${this.trace.summary.intent}${this.trace.summary.subType ? `:${this.trace.summary.subType}` : ""}`,
      );
      lines.push(
        `📈 置信度: ${(this.trace.summary.confidence * 100).toFixed(0)}%`,
      );
      lines.push(`🔧 模式: ${this.trace.summary.mode}`);
      if (this.trace.summary.suggestedSkill) {
        lines.push(`💡 Skill: ${this.trace.summary.suggestedSkill}`);
      }
      lines.push(`💾 缓存: ${this.trace.summary.cacheHit}`);
    }

    return lines.join("\n");
  }

  /**
   * 输出追踪日志
   */
  log(): void {
    if (!this.enabled) return;

    const level = getTraceLogLevel();
    const logFn =
      level === "info"
        ? logger.info
        : level === "warn"
          ? logger.warn
          : logger.debug;

    logFn.call(
      logger,
      {
        requestId: this.trace.requestId,
        totalLatencyMs: this.trace.totalLatencyMs,
        stageCount: this.trace.stages.length,
        stages: this.trace.stages.map((s) => ({
          stage: s.stage,
          latencyMs: s.latencyMs,
          decision: s.decision,
          error: s.error,
        })),
        summary: this.trace.summary,
      },
      "AI Routing Debug Trace",
    );
  }

  /**
   * 获取阶段耗时分布
   */
  getLatencyBreakdown(): Record<TraceStageType, number> {
    const breakdown: Partial<Record<TraceStageType, number>> = {};

    for (const stage of this.trace.stages) {
      breakdown[stage.stage] = (breakdown[stage.stage] || 0) + stage.latencyMs;
    }

    return breakdown as Record<TraceStageType, number>;
  }

  /**
   * 检查是否有错误
   */
  hasError(): boolean {
    return this.trace.stages.some((s) => s.error);
  }

  /**
   * 获取所有错误
   */
  getErrors(): Array<{ stage: TraceStageType; error: string }> {
    return this.trace.stages
      .filter((s) => s.error)
      .map((s) => ({ stage: s.stage, error: s.error ?? "" }));
  }

  /**
   * 清理敏感数据
   */
  private sanitizeData(data: unknown): unknown {
    if (data === null || data === undefined) {
      return data;
    }

    // 如果是字符串，截断过长的内容
    if (typeof data === "string") {
      return data.length > 500 ? data.substring(0, 500) + "..." : data;
    }

    // 如果是数组，限制长度
    if (Array.isArray(data)) {
      if (data.length > 10) {
        return [...data.slice(0, 10), `... and ${data.length - 10} more`];
      }
      return data.map((item) => this.sanitizeData(item));
    }

    // 如果是对象，递归处理
    if (typeof data === "object") {
      const sanitized: Record<string, unknown> = {};
      const entries = Object.entries(data as Record<string, unknown>);

      // 限制字段数量
      const limitedEntries = entries.slice(0, 20);

      for (const [key, value] of limitedEntries) {
        // 跳过敏感字段
        if (
          key.toLowerCase().includes("password") ||
          key.toLowerCase().includes("secret") ||
          key.toLowerCase().includes("token")
        ) {
          sanitized[key] = "[REDACTED]";
        } else {
          sanitized[key] = this.sanitizeData(value);
        }
      }

      if (entries.length > 20) {
        sanitized["..."] = `${entries.length - 20} more fields`;
      }

      return sanitized;
    }

    return data;
  }
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建 Debug Tracer 实例
 */
export function createDebugTracer(
  requestId: string,
  options?: {
    userId?: string;
    sessionId?: string;
    originalMessage?: string;
  },
): DebugTracer {
  return new DebugTracer(requestId, options);
}

/**
 * 生成请求 ID
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `req_${timestamp}_${random}`;
}

// ============================================
// 导出
// ============================================

export type { TraceStageType as DebugTraceStageType };
