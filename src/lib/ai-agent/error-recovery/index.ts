/**
 * 错误恢复模块导出
 *
 * 提供智能错误恢复功能
 *
 * @module ai-agent/error-recovery
 * @version 1.0.0
 * @since 2025-12-26
 */

// 错误类型
export {
  AgentErrorType,
  type AgentError,
  type AgentErrorContext,
  type ErrorSeverity,
  ERROR_SEVERITY_MAP,
  createAgentError,
  isRecoverableError,
  getErrorSeverity,
  isToolError,
  isModelError,
  isNetworkError,
  isDataError,
} from "./error-types";

// 恢复策略
export {
  type RecoveryStrategy,
  type RetryConfig,
  ERROR_RECOVERY_MAPPING,
  DEFAULT_RETRY_CONFIG,
  ERROR_RETRY_CONFIG,
  TOOL_FALLBACK_MAP,
  getRecoveryStrategies,
  getRetryConfig,
  getFallbackTool,
  calculateRetryDelay,
  shouldRetry,
} from "./recovery-strategies";

// 恢复处理器
export {
  type RecoveryContext,
  type RecoveryResult,
  ErrorRecoveryHandler,
  errorRecoveryHandler,
  classifyError,
} from "./error-recovery-handler";
