/**
 * Classification Metrics
 * V4.2 分类系统监控指标
 *
 * @description 提供分类系统的监控指标收集和上报
 * - 分类性能指标
 * - 用户行为指标
 * - 系统健康指标
 * - A/B 测试指标
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { logger } from "@/lib/logger";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 指标类型
 */
export type MetricType = "counter" | "gauge" | "histogram" | "timing";

/**
 * 指标标签
 */
export interface MetricLabels {
  /** 托管模式 */
  trustMode?: "full_auto" | "semi_auto" | "manual";
  /** 分类来源 */
  source?: "embedding" | "source" | "tag" | "rule" | "ai" | "manual";
  /** 置信度级别 */
  confidenceLevel?: "high" | "medium" | "low";
  /** 实验变体 */
  experimentVariant?: string;
  /** 用户类型 */
  userType?: "new" | "existing" | "power";
  /** 设备类型 */
  device?: "desktop" | "mobile" | "tablet";
  /** 其他标签 */
  [key: string]: string | number | boolean | undefined;
}

/**
 * 指标事件
 */
export interface MetricEvent {
  /** 指标名称 */
  name: string;
  /** 指标类型 */
  type: MetricType;
  /** 指标值 */
  value: number;
  /** 指标标签 */
  labels?: MetricLabels;
  /** 时间戳 */
  timestamp: number;
  /** 用户 ID */
  userId?: string;
}

/**
 * 计时上下文
 */
export interface TimingContext {
  /** 开始时间 */
  startTime: number;
  /** 指标名称 */
  name: string;
  /** 标签 */
  labels?: MetricLabels;
}

// ============================================================================
// 指标名称常量
// ============================================================================

/**
 * 分类相关指标
 */
export const CLASSIFICATION_METRICS = {
  /** 分类请求总数 */
  REQUESTS_TOTAL: "classification_requests_total",
  /** 分类成功数 */
  SUCCESS_TOTAL: "classification_success_total",
  /** 分类失败数 */
  FAILURES_TOTAL: "classification_failures_total",
  /** 分类延迟 */
  LATENCY_MS: "classification_latency_ms",
  /** 置信度分布 */
  CONFIDENCE_DISTRIBUTION: "classification_confidence",
  /** 用户纠正数 */
  USER_CORRECTIONS_TOTAL: "user_corrections_total",
  /** 自动决策数 */
  AUTO_DECISIONS_TOTAL: "auto_decisions_total",
} as const;

/**
 * 托管模式相关指标
 */
export const TRUST_MODE_METRICS = {
  /** 模式分布 */
  MODE_DISTRIBUTION: "trust_mode_distribution",
  /** 模式切换数 */
  MODE_SWITCHES_TOTAL: "trust_mode_switches_total",
  /** 待确认消息数 */
  PENDING_CONFIRMATIONS: "pending_confirmations_gauge",
  /** 确认响应时间 */
  CONFIRMATION_RESPONSE_TIME_MS: "confirmation_response_time_ms",
  /** 确认接受率 */
  CONFIRMATION_ACCEPTANCE_RATE: "confirmation_acceptance_rate",
} as const;

/**
 * 文件夹操作相关指标
 */
export const FOLDER_METRICS = {
  /** 自动创建数 */
  AUTO_CREATE_TOTAL: "folder_auto_create_total",
  /** 自动合并数 */
  AUTO_MERGE_TOTAL: "folder_auto_merge_total",
  /** 自动拆分数 */
  AUTO_SPLIT_TOTAL: "folder_auto_split_total",
  /** 建议接受率 */
  SUGGESTION_ACCEPTANCE_RATE: "folder_suggestion_acceptance_rate",
} as const;

/**
 * 系统健康指标
 */
export const SYSTEM_METRICS = {
  /** AI 调用次数 */
  AI_CALLS_TOTAL: "ai_calls_total",
  /** AI 调用延迟 */
  AI_LATENCY_MS: "ai_latency_ms",
  /** 向量搜索次数 */
  VECTOR_SEARCH_TOTAL: "vector_search_total",
  /** 向量搜索延迟 */
  VECTOR_SEARCH_LATENCY_MS: "vector_search_latency_ms",
  /** 缓存命中率 */
  CACHE_HIT_RATE: "cache_hit_rate",
} as const;

// ============================================================================
// 指标收集器
// ============================================================================

/**
 * 指标缓冲区
 */
let metricsBuffer: MetricEvent[] = [];

/**
 * 缓冲区最大大小
 */
const MAX_BUFFER_SIZE = 100;

/**
 * 刷新间隔（毫秒）
 */
const FLUSH_INTERVAL_MS = 10000;

/**
 * 上次刷新时间
 */
let lastFlushTime = Date.now();

/**
 * 分类指标收集器
 */
class ClassificationMetricsCollector {
  private enabled: boolean;

  constructor() {
    this.enabled = process.env.NEXT_PUBLIC_METRICS_ENABLED === "true" ||
                   process.env.NODE_ENV === "development";
  }

  // ============================================================================
  // 基础方法
  // ============================================================================

  /**
   * 记录计数器指标
   */
  counter(name: string, value: number = 1, labels?: MetricLabels, userId?: string): void {
    this.record({
      name,
      type: "counter",
      value,
      labels,
      timestamp: Date.now(),
      userId,
    });
  }

  /**
   * 记录仪表盘指标
   */
  gauge(name: string, value: number, labels?: MetricLabels, userId?: string): void {
    this.record({
      name,
      type: "gauge",
      value,
      labels,
      timestamp: Date.now(),
      userId,
    });
  }

  /**
   * 记录直方图指标
   */
  histogram(name: string, value: number, labels?: MetricLabels, userId?: string): void {
    this.record({
      name,
      type: "histogram",
      value,
      labels,
      timestamp: Date.now(),
      userId,
    });
  }

  /**
   * 开始计时
   */
  startTiming(name: string, labels?: MetricLabels): TimingContext {
    return {
      startTime: Date.now(),
      name,
      labels,
    };
  }

  /**
   * 结束计时并记录
   */
  endTiming(context: TimingContext, userId?: string): number {
    const duration = Date.now() - context.startTime;
    this.record({
      name: context.name,
      type: "timing",
      value: duration,
      labels: context.labels,
      timestamp: Date.now(),
      userId,
    });
    return duration;
  }

  // ============================================================================
  // 分类专用方法
  // ============================================================================

  /**
   * 记录分类请求
   */
  recordClassificationRequest(
    userId: string,
    labels?: Pick<MetricLabels, "trustMode" | "source" | "experimentVariant">
  ): TimingContext {
    this.counter(CLASSIFICATION_METRICS.REQUESTS_TOTAL, 1, labels, userId);
    return this.startTiming(CLASSIFICATION_METRICS.LATENCY_MS, labels);
  }

  /**
   * 记录分类成功
   */
  recordClassificationSuccess(
    userId: string,
    confidence: number,
    timingContext: TimingContext,
    labels?: MetricLabels
  ): void {
    this.counter(CLASSIFICATION_METRICS.SUCCESS_TOTAL, 1, labels, userId);
    this.histogram(CLASSIFICATION_METRICS.CONFIDENCE_DISTRIBUTION, confidence, labels, userId);
    this.endTiming(timingContext, userId);

    // 记录置信度级别
    const confidenceLevel = confidence >= 80 ? "high" : confidence >= 60 ? "medium" : "low";
    this.counter(CLASSIFICATION_METRICS.SUCCESS_TOTAL, 1, { ...labels, confidenceLevel }, userId);
  }

  /**
   * 记录分类失败
   */
  recordClassificationFailure(
    userId: string,
    error: string,
    timingContext: TimingContext,
    labels?: MetricLabels
  ): void {
    this.counter(CLASSIFICATION_METRICS.FAILURES_TOTAL, 1, { ...labels, error }, userId);
    this.endTiming(timingContext, userId);
  }

  /**
   * 记录用户纠正
   */
  recordUserCorrection(
    userId: string,
    originalConfidence: number,
    labels?: Pick<MetricLabels, "trustMode" | "source">
  ): void {
    this.counter(CLASSIFICATION_METRICS.USER_CORRECTIONS_TOTAL, 1, {
      ...labels,
      confidenceLevel: originalConfidence >= 80 ? "high" : originalConfidence >= 60 ? "medium" : "low",
    }, userId);
  }

  /**
   * 记录自动决策
   */
  recordAutoDecision(
    userId: string,
    labels?: Pick<MetricLabels, "trustMode" | "source" | "confidenceLevel">
  ): void {
    this.counter(CLASSIFICATION_METRICS.AUTO_DECISIONS_TOTAL, 1, labels, userId);
  }

  // ============================================================================
  // 托管模式专用方法
  // ============================================================================

  /**
   * 记录托管模式切换
   */
  recordModeSwitchEvent(
    userId: string,
    fromMode: string,
    toMode: string
  ): void {
    this.counter(TRUST_MODE_METRICS.MODE_SWITCHES_TOTAL, 1, {
      fromMode,
      toMode,
    } as MetricLabels, userId);
  }

  /**
   * 记录待确认消息数量
   */
  recordPendingConfirmations(userId: string, count: number, trustMode: string): void {
    this.gauge(TRUST_MODE_METRICS.PENDING_CONFIRMATIONS, count, {
      trustMode: trustMode as MetricLabels["trustMode"],
    }, userId);
  }

  /**
   * 记录确认响应
   */
  recordConfirmationResponse(
    userId: string,
    accepted: boolean,
    responseTimeMs: number,
    trustMode: string
  ): void {
    this.histogram(TRUST_MODE_METRICS.CONFIRMATION_RESPONSE_TIME_MS, responseTimeMs, {
      trustMode: trustMode as MetricLabels["trustMode"],
      accepted: accepted.toString(),
    } as MetricLabels, userId);
  }

  // ============================================================================
  // 文件夹操作专用方法
  // ============================================================================

  /**
   * 记录文件夹自动创建
   */
  recordFolderAutoCreate(userId: string, trustMode: string): void {
    this.counter(FOLDER_METRICS.AUTO_CREATE_TOTAL, 1, {
      trustMode: trustMode as MetricLabels["trustMode"],
    }, userId);
  }

  /**
   * 记录文件夹自动合并
   */
  recordFolderAutoMerge(userId: string, trustMode: string): void {
    this.counter(FOLDER_METRICS.AUTO_MERGE_TOTAL, 1, {
      trustMode: trustMode as MetricLabels["trustMode"],
    }, userId);
  }

  // ============================================================================
  // 系统指标方法
  // ============================================================================

  /**
   * 记录 AI 调用
   */
  recordAICall(latencyMs: number, success: boolean, model?: string): void {
    this.counter(SYSTEM_METRICS.AI_CALLS_TOTAL, 1, { success: success.toString(), model } as MetricLabels);
    this.histogram(SYSTEM_METRICS.AI_LATENCY_MS, latencyMs, { success: success.toString(), model } as MetricLabels);
  }

  /**
   * 记录向量搜索
   */
  recordVectorSearch(latencyMs: number, resultCount: number): void {
    this.counter(SYSTEM_METRICS.VECTOR_SEARCH_TOTAL, 1, { resultCount: resultCount.toString() } as MetricLabels);
    this.histogram(SYSTEM_METRICS.VECTOR_SEARCH_LATENCY_MS, latencyMs);
  }

  // ============================================================================
  // 内部方法
  // ============================================================================

  /**
   * 记录指标到缓冲区
   */
  private record(event: MetricEvent): void {
    if (!this.enabled) {
      return;
    }

    metricsBuffer.push(event);

    // 检查是否需要刷新
    if (
      metricsBuffer.length >= MAX_BUFFER_SIZE ||
      Date.now() - lastFlushTime >= FLUSH_INTERVAL_MS
    ) {
      this.flush();
    }
  }

  /**
   * 刷新缓冲区
   */
  async flush(): Promise<void> {
    if (metricsBuffer.length === 0) {
      return;
    }

    const events = [...metricsBuffer];
    metricsBuffer = [];
    lastFlushTime = Date.now();

    try {
      // 在开发环境记录到日志
      if (process.env.NODE_ENV === "development") {
        logger.debug({ count: events.length }, "Flushing metrics");
        // 可以在这里添加更详细的日志
      }

      // TODO: 发送到指标收集服务（如 Prometheus, DataDog, 或自定义后端）
      // await this.sendToMetricsService(events);
    } catch (error) {
      logger.error({ error, count: events.length }, "Failed to flush metrics");
      // 失败时将事件放回缓冲区（但不超过最大大小）
      if (metricsBuffer.length < MAX_BUFFER_SIZE) {
        metricsBuffer.push(...events.slice(0, MAX_BUFFER_SIZE - metricsBuffer.length));
      }
    }
  }

  /**
   * 获取缓冲区中的指标（用于调试）
   */
  getBufferedMetrics(): MetricEvent[] {
    return [...metricsBuffer];
  }

  /**
   * 清空缓冲区（用于测试）
   */
  clearBuffer(): void {
    metricsBuffer = [];
  }
}

// ============================================================================
// 单例导出
// ============================================================================

/**
 * 分类指标收集器实例
 */
export const classificationMetrics = new ClassificationMetricsCollector();

// ============================================================================
// 便捷装饰器（用于方法性能监控）
// ============================================================================

/**
 * 性能监控装饰器
 * @example
 * ```typescript
 * class MyService {
 *   @withTiming('my_operation_latency')
 *   async myMethod() {
 *     // ...
 *   }
 * }
 * ```
 */
export function withTiming(metricName: string, labels?: MetricLabels) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const timing = classificationMetrics.startTiming(metricName, labels);
      try {
        const result = await originalMethod.apply(this, args);
        classificationMetrics.endTiming(timing);
        return result;
      } catch (error) {
        classificationMetrics.endTiming(timing);
        throw error;
      }
    };

    return descriptor;
  };
}
