/**
 * 错误上报服务
 *
 * 统一处理错误上报到 Sentry 和本地日志
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import * as Sentry from "@sentry/nextjs";
import type { ErrorInfo } from "react";
import type { ErrorReportData } from "./types";

/**
 * 上报错误到 Sentry
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

  // 生产环境上报到 Sentry
  if (process.env.NODE_ENV === "production") {
    Sentry.withScope((scope) => {
      // 设置标签
      if (context?.feature) {
        scope.setTag("feature", context.feature);
      }

      // 设置用户
      if (context?.userId) {
        scope.setUser({ id: context.userId });
      }

      // 设置额外数据
      scope.setExtras({
        componentStack: errorInfo?.componentStack,
        url: reportData.url,
        ...context?.extra,
      });

      // 设置错误级别
      scope.setLevel("error");

      // 捕获异常
      Sentry.captureException(error);
    });
  }

  // 本地存储最近错误（用于调试）
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
