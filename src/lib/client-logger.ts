/**
 * 客户端安全的日志工具
 *
 * 在客户端组件中使用，避免 pino worker thread 问题
 * 生产环境静默处理，开发环境输出到 console
 */

const isDev = process.env.NODE_ENV === "development";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

/**
 * 格式化日志消息
 */
function formatMessage(
  level: LogLevel,
  context: LogContext | string,
  message?: string,
): string {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

  if (typeof context === "string") {
    return `${prefix} ${context}`;
  }

  const contextStr = Object.keys(context).length
    ? ` ${JSON.stringify(context)}`
    : "";
  return `${prefix}${contextStr} ${message || ""}`;
}

/**
 * 客户端日志器
 *
 * @example
 * ```typescript
 * import { clientLogger } from '@/lib/client-logger'
 *
 * // 简单日志
 * clientLogger.info('操作完成')
 *
 * // 带上下文的日志
 * clientLogger.error({ bookmarkId, error: err.message }, '删除失败')
 * ```
 */
/* eslint-disable no-console */
export const clientLogger = {
  debug(context: LogContext | string, message?: string): void {
    if (isDev) {
      console.debug(formatMessage("debug", context, message));
    }
  },

  info(context: LogContext | string, message?: string): void {
    if (isDev) {
      console.info(formatMessage("info", context, message));
    }
  },

  warn(context: LogContext | string, message?: string): void {
    if (isDev) {
      console.warn(formatMessage("warn", context, message));
    }
  },

  error(context: LogContext | string, message?: string): void {
    // 错误日志在生产环境也输出，便于问题追踪
    console.error(formatMessage("error", context, message));
  },

  /**
   * 开始一个控制台分组（仅开发环境）
   */
  group(label: string): void {
    if (isDev) {
      console.group(label);
    }
  },

  /**
   * 结束当前的控制台分组（仅开发环境）
   */
  groupEnd(): void {
    if (isDev) {
      console.groupEnd();
    }
  },
};
/* eslint-enable no-console */

export default clientLogger;
