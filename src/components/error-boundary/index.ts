/**
 * 错误边界模块导出
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

// 错误边界组件
export { GlobalErrorBoundary } from "./global-error-boundary";
export { FeatureErrorBoundary } from "./feature-error-boundary";
export { AIErrorBoundary } from "./ai-error-boundary";

// 降级 UI 组件
export {
  GlobalFallbackUI,
  FeatureFallbackUI,
  AIFallbackUI,
} from "./fallback-ui";

// 错误上报服务
export {
  reportError,
  getRecentErrors,
  clearRecentErrors,
} from "./error-reporter";

// 类型导出
export type {
  ErrorBoundaryProps,
  ErrorBoundaryState,
  FallbackUIProps,
  ErrorReportData,
} from "./types";
