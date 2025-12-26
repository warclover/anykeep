/**
 * AI Agent 错误类型定义
 *
 * 提供结构化的错误分类，支持智能恢复策略
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

// =============================================================================
// 错误类型枚举
// =============================================================================

/**
 * AI Agent 错误类型枚举
 */
export enum AgentErrorType {
  // ========================================
  // 工具调用错误
  // ========================================

  /** 工具不存在 */
  TOOL_NOT_FOUND = "TOOL_NOT_FOUND",
  /** 工具参数无效 */
  TOOL_PARAM_INVALID = "TOOL_PARAM_INVALID",
  /** 工具执行失败 */
  TOOL_EXECUTION_FAILED = "TOOL_EXECUTION_FAILED",
  /** 工具调用超时 */
  TOOL_TIMEOUT = "TOOL_TIMEOUT",

  // ========================================
  // 数据错误
  // ========================================

  /** 资源不存在（书签/文件夹不存在） */
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
  /** 无权限访问 */
  PERMISSION_DENIED = "PERMISSION_DENIED",
  /** 数据冲突 */
  DATA_CONFLICT = "DATA_CONFLICT",
  /** 数据验证失败 */
  DATA_VALIDATION_FAILED = "DATA_VALIDATION_FAILED",

  // ========================================
  // 模型错误
  // ========================================

  /** 模型请求频率限制 */
  MODEL_RATE_LIMIT = "MODEL_RATE_LIMIT",
  /** 上下文溢出 */
  MODEL_CONTEXT_OVERFLOW = "MODEL_CONTEXT_OVERFLOW",
  /** 模型响应无效 */
  MODEL_RESPONSE_INVALID = "MODEL_RESPONSE_INVALID",
  /** 模型不可用 */
  MODEL_UNAVAILABLE = "MODEL_UNAVAILABLE",

  // ========================================
  // 网络错误
  // ========================================

  /** 网络超时 */
  NETWORK_TIMEOUT = "NETWORK_TIMEOUT",
  /** 网络不可用 */
  NETWORK_UNAVAILABLE = "NETWORK_UNAVAILABLE",

  // ========================================
  // 通用错误
  // ========================================

  /** 未知错误 */
  UNKNOWN = "UNKNOWN",
}

// =============================================================================
// 错误上下文
// =============================================================================

/**
 * 错误上下文信息
 */
export interface AgentErrorContext {
  /** 工具名称（如果是工具错误） */
  toolName?: string;
  /** 工具参数 */
  params?: unknown;
  /** 原始错误 */
  originalError?: Error;
  /** 重试次数 */
  retryCount?: number;
  /** 请求 ID */
  requestId?: string;
  /** 用户 ID */
  userId?: string;
  /** 额外信息 */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// 结构化错误
// =============================================================================

/**
 * 结构化错误信息
 */
export interface AgentError {
  /** 错误类型 */
  type: AgentErrorType;
  /** 错误消息 */
  message: string;
  /** 错误上下文 */
  context?: AgentErrorContext;
  /** 是否可恢复 */
  recoverable: boolean;
  /** 建议的操作 */
  suggestedAction?: string;
  /** 错误发生时间 */
  timestamp: Date;
}

// =============================================================================
// 错误严重级别
// =============================================================================

/**
 * 错误严重级别
 */
export type ErrorSeverity = "low" | "medium" | "high" | "critical";

/**
 * 错误类型到严重级别映射
 */
export const ERROR_SEVERITY_MAP: Record<AgentErrorType, ErrorSeverity> = {
  // 低严重级别：通常可以自动恢复
  [AgentErrorType.TOOL_TIMEOUT]: "low",
  [AgentErrorType.NETWORK_TIMEOUT]: "low",
  [AgentErrorType.MODEL_RATE_LIMIT]: "low",

  // 中等严重级别：可能需要用户干预
  [AgentErrorType.TOOL_PARAM_INVALID]: "medium",
  [AgentErrorType.RESOURCE_NOT_FOUND]: "medium",
  [AgentErrorType.DATA_VALIDATION_FAILED]: "medium",
  [AgentErrorType.TOOL_EXECUTION_FAILED]: "medium",
  [AgentErrorType.MODEL_RESPONSE_INVALID]: "medium",
  [AgentErrorType.DATA_CONFLICT]: "medium",

  // 高严重级别：需要用户干预
  [AgentErrorType.TOOL_NOT_FOUND]: "high",
  [AgentErrorType.PERMISSION_DENIED]: "high",
  [AgentErrorType.MODEL_CONTEXT_OVERFLOW]: "high",

  // 关键严重级别：系统级问题
  [AgentErrorType.MODEL_UNAVAILABLE]: "critical",
  [AgentErrorType.NETWORK_UNAVAILABLE]: "critical",
  [AgentErrorType.UNKNOWN]: "critical",
};

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 创建 AgentError 实例
 */
export function createAgentError(
  type: AgentErrorType,
  message: string,
  options?: {
    context?: AgentErrorContext;
    recoverable?: boolean;
    suggestedAction?: string;
  },
): AgentError {
  return {
    type,
    message,
    context: options?.context,
    recoverable: options?.recoverable ?? isRecoverableError(type),
    suggestedAction: options?.suggestedAction,
    timestamp: new Date(),
  };
}

/**
 * 判断错误类型是否可恢复
 */
export function isRecoverableError(type: AgentErrorType): boolean {
  const recoverableTypes = new Set([
    AgentErrorType.TOOL_TIMEOUT,
    AgentErrorType.TOOL_EXECUTION_FAILED,
    AgentErrorType.NETWORK_TIMEOUT,
    AgentErrorType.MODEL_RATE_LIMIT,
    AgentErrorType.MODEL_RESPONSE_INVALID,
    AgentErrorType.RESOURCE_NOT_FOUND,
    AgentErrorType.DATA_CONFLICT,
  ]);
  return recoverableTypes.has(type);
}

/**
 * 获取错误严重级别
 */
export function getErrorSeverity(type: AgentErrorType): ErrorSeverity {
  return ERROR_SEVERITY_MAP[type] ?? "medium";
}

/**
 * 检查是否为工具相关错误
 */
export function isToolError(type: AgentErrorType): boolean {
  return type.startsWith("TOOL_");
}

/**
 * 检查是否为模型相关错误
 */
export function isModelError(type: AgentErrorType): boolean {
  return type.startsWith("MODEL_");
}

/**
 * 检查是否为网络相关错误
 */
export function isNetworkError(type: AgentErrorType): boolean {
  return type.startsWith("NETWORK_");
}

/**
 * 检查是否为数据相关错误
 */
export function isDataError(type: AgentErrorType): boolean {
  return (
    type === AgentErrorType.RESOURCE_NOT_FOUND ||
    type === AgentErrorType.PERMISSION_DENIED ||
    type === AgentErrorType.DATA_CONFLICT ||
    type === AgentErrorType.DATA_VALIDATION_FAILED
  );
}
