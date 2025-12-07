/**
 * 结构化日志系统
 *
 * 使用 Pino 提供高性能、结构化的日志记录功能
 *
 * @example
 * ```typescript
 * import { logger } from '@/lib/logger'
 *
 * // 基础日志
 * logger.info('Application started')
 * logger.error('Failed to connect to database')
 *
 * // 结构化日志（带上下文）
 * logger.info({ userId, action: 'login' }, 'User logged in')
 * logger.error({ error, bookmarkId }, 'Failed to create bookmark')
 * ```
 */

import pino from "pino";

/**
 * 日志级别
 * - trace: 最详细的调试信息
 * - debug: 调试信息
 * - info: 一般信息（默认）
 * - warn: 警告信息
 * - error: 错误信息
 * - fatal: 致命错误
 */
const LOG_LEVEL = process.env.LOG_LEVEL || "info";

/**
 * 创建 Pino 日志实例
 *
 * 开发环境: 使用同步模式避免 Next.js 热更新冲突
 * 生产环境: 输出 JSON 格式，便于日志聚合和分析
 *
 * 注意：pino-pretty transport 在 Next.js dev 模式下会导致 worker thread 错误，
 * 因此在开发环境使用同步模式输出 JSON。
 */
export const logger = pino({
  level: LOG_LEVEL,

  // 浏览器环境配置
  browser: {
    asObject: true,
    serialize: true,
  },

  // 禁用 transport 避免 worker thread 问题
  // 开发环境下使用 JSON 输出（可通过 pino-pretty CLI 管道美化）
  transport: undefined,

  // 格式化配置
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },

  // 基础字段
  base:
    process.env.NODE_ENV === "production"
      ? {
          env: process.env.NODE_ENV,
        }
      : undefined,

  // 时间戳格式
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * 创建子日志实例（带命名空间）
 *
 * @example
 * ```typescript
 * const crawlerLogger = createLogger('crawler')
 * crawlerLogger.info({ url }, 'Starting crawl')
 * ```
 */
export function createLogger(namespace: string) {
  return logger.child({ namespace });
}

/**
 * 日志工具函数
 */
export const logUtils = {
  /**
   * 记录 API 请求
   */
  logRequest: (method: string, path: string, userId?: string) => {
    logger.info(
      {
        type: "api_request",
        method,
        path,
        userId,
      },
      `API Request: ${method} ${path}`,
    );
  },

  /**
   * 记录 API 响应
   */
  logResponse: (
    method: string,
    path: string,
    statusCode: number,
    duration: number,
  ) => {
    logger.info(
      {
        type: "api_response",
        method,
        path,
        statusCode,
        duration,
      },
      `API Response: ${method} ${path} ${statusCode} (${duration}ms)`,
    );
  },

  /**
   * 记录数据库查询
   */
  logQuery: (table: string, operation: string, duration?: number) => {
    logger.debug(
      {
        type: "db_query",
        table,
        operation,
        duration,
      },
      `Database: ${operation} on ${table}${duration ? ` (${duration}ms)` : ""}`,
    );
  },

  /**
   * 记录错误（带堆栈）
   */
  logError: (error: unknown, context?: Record<string, unknown>) => {
    const errorObj = error instanceof Error ? error : new Error(String(error));

    logger.error(
      {
        type: "error",
        error: {
          message: errorObj.message,
          name: errorObj.name,
          stack: errorObj.stack,
        },
        ...context,
      },
      `Error: ${errorObj.message}`,
    );
  },
};

/**
 * 默认导出
 */
export default logger;
