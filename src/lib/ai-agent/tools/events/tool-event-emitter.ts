/**
 * AI Agent 工具调用事件发射器
 *
 * 在工具执行的关键节点发布事件，支持：
 * - 工具调用开始/完成事件
 * - 重试事件
 * - 确认请求/响应事件
 *
 * @version 1.0.0
 * @since 2026-01-06
 */

import { eventBus } from "@/lib/shared/event-bus";
import {
  AIAgentToolEvents,
  type ToolCallStartedEvent,
  type ToolCallCompletedEvent,
  type ToolCallRetryEvent,
  type ToolConfirmationRequestedEvent,
  type ToolConfirmationRespondedEvent,
} from "@/lib/shared/event-bus/event-types";
import { logger } from "@/lib/logger";

// ============================================
// 类型定义
// ============================================

/**
 * 工具事件发射器配置
 */
export interface ToolEventEmitterConfig {
  /** 是否启用事件发射 */
  enabled?: boolean;
  /** 是否包含参数摘要 */
  includeParamsSummary?: boolean;
  /** 是否包含结果摘要 */
  includeResultSummary?: boolean;
}

/**
 * 工具调用开始参数
 */
export interface ToolCallStartParams {
  userId: string;
  toolName: string;
  toolCategory: string;
  requestId?: string;
  requiresConfirmation: boolean;
  riskLevel: "low" | "medium" | "high";
  params?: Record<string, unknown>;
}

/**
 * 工具调用完成参数
 */
export interface ToolCallCompleteParams {
  userId: string;
  toolName: string;
  toolCategory: string;
  success: boolean;
  durationMs: number;
  resultSummary?: string;
  errorMessage?: string;
  errorCode?: string;
  retryable?: boolean;
}

/**
 * 工具调用重试参数
 */
export interface ToolCallRetryParams {
  userId: string;
  toolName: string;
  retryCount: number;
  maxRetries: number;
  lastError: string;
  retryDelayMs: number;
}

/**
 * 工具确认请求参数
 */
export interface ToolConfirmationRequestParams {
  userId: string;
  toolName: string;
  confirmationId: string;
  operationDescription: string;
  impactDescription?: string;
  estimatedAffectedCount?: number;
}

/**
 * 工具确认响应参数
 */
export interface ToolConfirmationResponseParams {
  userId: string;
  toolName: string;
  confirmationId: string;
  confirmed: boolean;
  responseTimeMs: number;
}

// ============================================
// 默认配置
// ============================================

const DEFAULT_CONFIG: Required<ToolEventEmitterConfig> = {
  enabled: true,
  includeParamsSummary: true,
  includeResultSummary: true,
};

// ============================================
// 工具类
// ============================================

/**
 * 清理参数中的敏感信息
 */
function sanitizeParams(
  params: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!params) return undefined;

  const sanitized: Record<string, unknown> = {};
  const sensitiveKeys = [
    "password",
    "secret",
    "token",
    "key",
    "credential",
    "auth",
  ];

  for (const [key, value] of Object.entries(params)) {
    const lowerKey = key.toLowerCase();

    // 检查是否为敏感字段
    if (sensitiveKeys.some((sk) => lowerKey.includes(sk))) {
      sanitized[key] = "***";
      continue;
    }

    // 截断过长的字符串
    if (typeof value === "string" && value.length > 100) {
      sanitized[key] = value.substring(0, 100) + "...";
      continue;
    }

    // 截断过大的数组
    if (Array.isArray(value) && value.length > 10) {
      sanitized[key] = `[Array(${value.length})]`;
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}

// ============================================
// ToolEventEmitter Class
// ============================================

/**
 * 工具事件发射器
 *
 * @example
 * ```typescript
 * const emitter = new ToolEventEmitter();
 *
 * // 工具开始执行
 * emitter.emitCallStarted({
 *   userId: 'user-123',
 *   toolName: 'create_folder',
 *   toolCategory: 'action',
 *   requiresConfirmation: false,
 *   riskLevel: 'medium',
 * });
 *
 * // 工具执行完成
 * emitter.emitCallCompleted({
 *   userId: 'user-123',
 *   toolName: 'create_folder',
 *   toolCategory: 'action',
 *   success: true,
 *   durationMs: 150,
 * });
 * ```
 */
export class ToolEventEmitter {
  private config: Required<ToolEventEmitterConfig>;

  constructor(config: ToolEventEmitterConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 发射工具调用开始事件
   */
  emitCallStarted(params: ToolCallStartParams): void {
    if (!this.config.enabled) return;

    const event: ToolCallStartedEvent = {
      userId: params.userId,
      toolName: params.toolName,
      toolCategory: params.toolCategory,
      requestId: params.requestId,
      requiresConfirmation: params.requiresConfirmation,
      riskLevel: params.riskLevel,
      paramsSummary: this.config.includeParamsSummary
        ? sanitizeParams(params.params)
        : undefined,
      timestamp: new Date().toISOString(),
    };

    try {
      eventBus.emit(AIAgentToolEvents.CALL_STARTED, event);
      logger.debug(
        {
          toolName: params.toolName,
          userId: params.userId,
        },
        "ToolEventEmitter: call_started emitted",
      );
    } catch (error) {
      logger.warn(
        { error, toolName: params.toolName },
        "ToolEventEmitter: Failed to emit call_started",
      );
    }
  }

  /**
   * 发射工具调用完成事件
   */
  emitCallCompleted(params: ToolCallCompleteParams): void {
    if (!this.config.enabled) return;

    const event: ToolCallCompletedEvent = {
      userId: params.userId,
      toolName: params.toolName,
      toolCategory: params.toolCategory,
      success: params.success,
      durationMs: params.durationMs,
      resultSummary: this.config.includeResultSummary
        ? params.resultSummary
        : undefined,
      errorMessage: params.errorMessage,
      errorCode: params.errorCode,
      retryable: params.retryable,
      timestamp: new Date().toISOString(),
    };

    try {
      eventBus.emit(AIAgentToolEvents.CALL_COMPLETED, event);
      logger.debug(
        {
          toolName: params.toolName,
          userId: params.userId,
          success: params.success,
          durationMs: params.durationMs,
        },
        "ToolEventEmitter: call_completed emitted",
      );
    } catch (error) {
      logger.warn(
        { error, toolName: params.toolName },
        "ToolEventEmitter: Failed to emit call_completed",
      );
    }
  }

  /**
   * 发射工具调用重试事件
   */
  emitCallRetry(params: ToolCallRetryParams): void {
    if (!this.config.enabled) return;

    const event: ToolCallRetryEvent = {
      userId: params.userId,
      toolName: params.toolName,
      retryCount: params.retryCount,
      maxRetries: params.maxRetries,
      lastError: params.lastError,
      retryDelayMs: params.retryDelayMs,
      timestamp: new Date().toISOString(),
    };

    try {
      eventBus.emit(AIAgentToolEvents.CALL_RETRY, event);
      logger.debug(
        {
          toolName: params.toolName,
          userId: params.userId,
          retryCount: params.retryCount,
        },
        "ToolEventEmitter: call_retry emitted",
      );
    } catch (error) {
      logger.warn(
        { error, toolName: params.toolName },
        "ToolEventEmitter: Failed to emit call_retry",
      );
    }
  }

  /**
   * 发射工具确认请求事件
   */
  emitConfirmationRequested(params: ToolConfirmationRequestParams): void {
    if (!this.config.enabled) return;

    const event: ToolConfirmationRequestedEvent = {
      userId: params.userId,
      toolName: params.toolName,
      confirmationId: params.confirmationId,
      operationDescription: params.operationDescription,
      impactDescription: params.impactDescription,
      estimatedAffectedCount: params.estimatedAffectedCount,
      timestamp: new Date().toISOString(),
    };

    try {
      eventBus.emit(AIAgentToolEvents.CONFIRMATION_REQUESTED, event);
      logger.debug(
        {
          toolName: params.toolName,
          userId: params.userId,
          confirmationId: params.confirmationId,
        },
        "ToolEventEmitter: confirmation_requested emitted",
      );
    } catch (error) {
      logger.warn(
        { error, toolName: params.toolName },
        "ToolEventEmitter: Failed to emit confirmation_requested",
      );
    }
  }

  /**
   * 发射工具确认响应事件
   */
  emitConfirmationResponded(params: ToolConfirmationResponseParams): void {
    if (!this.config.enabled) return;

    const event: ToolConfirmationRespondedEvent = {
      userId: params.userId,
      toolName: params.toolName,
      confirmationId: params.confirmationId,
      confirmed: params.confirmed,
      responseTimeMs: params.responseTimeMs,
      timestamp: new Date().toISOString(),
    };

    try {
      eventBus.emit(AIAgentToolEvents.CONFIRMATION_RESPONDED, event);
      logger.debug(
        {
          toolName: params.toolName,
          userId: params.userId,
          confirmed: params.confirmed,
        },
        "ToolEventEmitter: confirmation_responded emitted",
      );
    } catch (error) {
      logger.warn(
        { error, toolName: params.toolName },
        "ToolEventEmitter: Failed to emit confirmation_responded",
      );
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ToolEventEmitterConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// ============================================
// 单例导出
// ============================================

/**
 * 全局工具事件发射器实例
 */
export const toolEventEmitter = new ToolEventEmitter();

/**
 * 创建工具事件发射器的工厂函数
 */
export function createToolEventEmitter(
  config?: ToolEventEmitterConfig,
): ToolEventEmitter {
  return new ToolEventEmitter(config);
}
