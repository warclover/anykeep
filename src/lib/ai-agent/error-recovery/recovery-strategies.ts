/**
 * 错误恢复策略配置
 *
 * 定义错误类型到恢复策略的映射
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import { AgentErrorType } from "./error-types";

// =============================================================================
// 恢复策略类型
// =============================================================================

/**
 * 恢复策略类型
 */
export type RecoveryStrategy =
  | "retry" // 重试（适用于临时性错误）
  | "fallback_tool" // 换用备选工具
  | "refresh_context" // 刷新上下文后重试
  | "ask_user" // 请求用户澄清
  | "graceful_degrade" // 优雅降级（返回部分结果）
  | "abort"; // 终止并报错

// =============================================================================
// 恢复策略映射
// =============================================================================

/**
 * 错误类型 → 恢复策略 映射
 *
 * 每个错误类型对应一个有序的策略列表，按优先级从高到低排列
 */
export const ERROR_RECOVERY_MAPPING: Record<
  AgentErrorType,
  RecoveryStrategy[]
> = {
  // ========================================
  // 工具错误
  // ========================================

  [AgentErrorType.TOOL_NOT_FOUND]: ["fallback_tool", "ask_user"],
  [AgentErrorType.TOOL_PARAM_INVALID]: ["ask_user", "abort"],
  [AgentErrorType.TOOL_EXECUTION_FAILED]: [
    "retry",
    "fallback_tool",
    "graceful_degrade",
  ],
  [AgentErrorType.TOOL_TIMEOUT]: ["retry", "graceful_degrade"],

  // ========================================
  // 数据错误
  // ========================================

  [AgentErrorType.RESOURCE_NOT_FOUND]: ["refresh_context", "ask_user"],
  [AgentErrorType.PERMISSION_DENIED]: ["ask_user", "abort"],
  [AgentErrorType.DATA_CONFLICT]: ["refresh_context", "ask_user"],
  [AgentErrorType.DATA_VALIDATION_FAILED]: ["ask_user", "abort"],

  // ========================================
  // 模型错误
  // ========================================

  [AgentErrorType.MODEL_RATE_LIMIT]: ["retry", "graceful_degrade"],
  [AgentErrorType.MODEL_CONTEXT_OVERFLOW]: ["graceful_degrade", "abort"],
  [AgentErrorType.MODEL_RESPONSE_INVALID]: ["retry", "fallback_tool"],
  [AgentErrorType.MODEL_UNAVAILABLE]: ["retry", "abort"],

  // ========================================
  // 网络错误
  // ========================================

  [AgentErrorType.NETWORK_TIMEOUT]: ["retry", "abort"],
  [AgentErrorType.NETWORK_UNAVAILABLE]: ["abort"],

  // ========================================
  // 通用错误
  // ========================================

  [AgentErrorType.UNKNOWN]: ["graceful_degrade", "abort"],
};

// =============================================================================
// 重试配置
// =============================================================================

/**
 * 重试配置
 */
export interface RetryConfig {
  /** 最大重试次数 */
  maxRetries: number;
  /** 基础延迟（毫秒） */
  baseDelayMs: number;
  /** 退避乘数（指数退避） */
  backoffMultiplier: number;
  /** 最大延迟（毫秒） */
  maxDelayMs: number;
}

/**
 * 默认重试配置
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 2,
  baseDelayMs: 500,
  backoffMultiplier: 2, // 指数退避: 500ms, 1000ms, 2000ms
  maxDelayMs: 5000,
};

/**
 * 按错误类型的重试配置
 */
export const ERROR_RETRY_CONFIG: Partial<Record<AgentErrorType, RetryConfig>> =
  {
    // 工具超时：更多重试，更长等待
    [AgentErrorType.TOOL_TIMEOUT]: {
      maxRetries: 3,
      baseDelayMs: 1000,
      backoffMultiplier: 1.5,
      maxDelayMs: 8000,
    },

    // 模型限流：更长等待
    [AgentErrorType.MODEL_RATE_LIMIT]: {
      maxRetries: 3,
      baseDelayMs: 2000,
      backoffMultiplier: 2,
      maxDelayMs: 10000,
    },

    // 网络超时：快速重试
    [AgentErrorType.NETWORK_TIMEOUT]: {
      maxRetries: 2,
      baseDelayMs: 300,
      backoffMultiplier: 2,
      maxDelayMs: 3000,
    },
  };

// =============================================================================
// 工具备选映射
// =============================================================================

/**
 * 工具备选映射
 *
 * 当主工具失败时，尝试使用备选工具
 */
export const TOOL_FALLBACK_MAP: Record<string, string> = {
  // 文件夹查询失败 → 列出最近
  list_by_folder: "list_recent",
  // 搜索失败 → 列出最近
  search_bookmarks: "list_recent",
  // 详细统计失败 → 简单计数
  get_stats: "count_total",
  // 按平台列表失败 → 列出最近
  list_by_platform: "list_recent",
  // 智能列表内容失败 → 列出智能列表
  get_smart_list_items: "list_smart_lists",
};

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 获取错误的恢复策略列表
 */
export function getRecoveryStrategies(
  errorType: AgentErrorType,
): RecoveryStrategy[] {
  return ERROR_RECOVERY_MAPPING[errorType] ?? ["graceful_degrade", "abort"];
}

/**
 * 获取错误的重试配置
 */
export function getRetryConfig(errorType: AgentErrorType): RetryConfig {
  return ERROR_RETRY_CONFIG[errorType] ?? DEFAULT_RETRY_CONFIG;
}

/**
 * 获取工具的备选工具
 */
export function getFallbackTool(toolName: string): string | undefined {
  return TOOL_FALLBACK_MAP[toolName];
}

/**
 * 计算重试延迟（指数退避）
 */
export function calculateRetryDelay(
  retryCount: number,
  config: RetryConfig,
): number {
  const delay =
    config.baseDelayMs * Math.pow(config.backoffMultiplier, retryCount);
  return Math.min(delay, config.maxDelayMs);
}

/**
 * 检查是否应该重试
 */
export function shouldRetry(
  errorType: AgentErrorType,
  currentRetryCount: number,
): boolean {
  const strategies = getRecoveryStrategies(errorType);
  if (!strategies.includes("retry")) {
    return false;
  }

  const config = getRetryConfig(errorType);
  return currentRetryCount < config.maxRetries;
}
