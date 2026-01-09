/**
 * AI Agent 安全模块
 *
 * 提供高风险操作确认、安全拦截等功能
 *
 * @module ai-agent/safety
 * @version 1.0.0
 * @since 2026-01-09
 */

// 确认拦截器
export {
  ConfirmationInterceptor,
  confirmationInterceptor,
  createConfirmationInterceptor,
  type InterceptCheckResult,
  type InterceptResult,
  type ConfirmationInterceptorConfig,
} from "./confirmation-interceptor";
