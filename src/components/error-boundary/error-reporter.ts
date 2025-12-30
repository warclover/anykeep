/**
 * 错误上报服务
 *
 * 统一处理错误本地日志存储
 * Sentry 错误上报通过全局配置 (sentry.client.config.ts) 自动处理
 *
 * @version 1.2.0
 * @since 2025-12-28
 * @updated 2025-12-30 - 移除 Sentry 手动导入，避免客户端 hydration 错误
 *                       Sentry 通过全局配置自动捕获错误，无需手动调用
 */

import type { ErrorInfo } from "react";
import type { ErrorReportData } from "./types";

/**
 * 上报错误
 *
 * Sentry 通过全局配置 (sentry.client.config.ts) 自动捕获 React 错误
 * 此函数仅负责本地日志和存储
 */
export function reportError(
  error: Error,
  errorInfo?: ErrorInfo | null,
  context?: {
    feature?: string;
    userId?: string;
    extra?: Record<string, unknown>;
  },
): void {
  // 构建错误报告数据
  const reportData: ErrorReportData = {
    message: error.message,
    stack: error.stack,
    componentStack: errorInfo?.componentStack ?? undefined,
    feature: context?.feature,
    userId: context?.userId,
    url: typeof window !== "undefined" ? window.location.href : undefined,
    userAgent:
      typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    timestamp: new Date().toISOString(),
  };

  // 开发环境控制台输出
  if (process.env.NODE_ENV === "development") {
    console.error("🚨 Error Boundary Caught Error:", {
      error,
      componentStack: errorInfo?.componentStack,
      context,
    });
  }

  // 本地存储最近错误（用于调试）
  // 生产环境错误由 Sentry 全局配置自动捕获
  storeRecentError(reportData);
}

/**
 * 存储最近的错误记录（保留最近 10 条）
 */
function storeRecentError(data: ErrorReportData): void {
  if (typeof window === "undefined") return;

  try {
    const key = "anykeep_recent_errors";
    const stored = localStorage.getItem(key);
    const errors: ErrorReportData[] = stored ? JSON.parse(stored) : [];

    // 添加新错误
    errors.unshift(data);

    // 保留最近 10 条
    const trimmed = errors.slice(0, 10);

    localStorage.setItem(key, JSON.stringify(trimmed));
  } catch {
    // 忽略存储错误
  }
}

/**
 * 获取最近的错误记录
 */
export function getRecentErrors(): ErrorReportData[] {
  if (typeof window === "undefined") return [];

  try {
    const key = "anykeep_recent_errors";
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * 清除错误记录
 */
export function clearRecentErrors(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem("anykeep_recent_errors");
  } catch {
    // 忽略
  }
}
