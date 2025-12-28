/**
 * 错误边界类型定义
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { ErrorInfo, ReactNode } from "react";

/**
 * 错误边界 Props
 */
export interface ErrorBoundaryProps {
  /** 子组件 */
  children: ReactNode;
  /** 自定义降级 UI */
  fallback?: ReactNode;
  /** 功能模块名称（用于错误分类） */
  feature?: string;
  /** 错误回调 */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** 是否显示详细错误（开发环境默认开启） */
  showDetails?: boolean;
}

/**
 * 错误边界 State
 */
export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * 降级 UI Props
 */
export interface FallbackUIProps {
  /** 错误对象 */
  error: Error | null;
  /** 错误信息 */
  errorInfo?: ErrorInfo | null;
  /** 功能模块名称 */
  feature?: string;
  /** 是否显示详细错误 */
  showDetails?: boolean;
  /** 重试回调 */
  onRetry?: () => void;
  /** 是否为紧凑模式 */
  compact?: boolean;
}

/**
 * 错误上报数据
 */
export interface ErrorReportData {
  /** 错误消息 */
  message: string;
  /** 错误堆栈 */
  stack?: string;
  /** 组件堆栈 */
  componentStack?: string;
  /** 功能模块 */
  feature?: string;
  /** 用户 ID */
  userId?: string;
  /** 页面 URL */
  url?: string;
  /** 用户代理 */
  userAgent?: string;
  /** 时间戳 */
  timestamp: string;
}
