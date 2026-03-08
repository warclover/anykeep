/**
 * 智能分类 v5.0 - Logger Service
 *
 * 基础日志服务，提供统一的日志记录接口
 */

import { LogLevel } from "./types";
import type { LogContext, LogEntry, LoggerConfig } from "./types";

/**
 * Logger Service 类
 */
export class LoggerService {
  private config: LoggerConfig;
  private context: LogContext;

  constructor(config?: Partial<LoggerConfig>, context?: LogContext) {
    this.config = {
      minLevel: config?.minLevel ?? LogLevel.INFO,
      enableConsole: config?.enableConsole ?? true,
      enableFile: config?.enableFile ?? false,
      filePath: config?.filePath,
    };
    this.context = context ?? {};
  }

  /**
   * 创建子 Logger（带上下文）
   */
  child(context: LogContext): LoggerService {
    return new LoggerService(this.config, { ...this.context, ...context });
  }

  /**
   * Debug 日志
   */
  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Info 日志
   */
  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Warn 日志
   */
  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Error 日志
   */
  error(message: string, error?: Error, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, { ...context, error });
  }

  /**
   * 核心日志方法
   */
  private log(level: LogLevel, message: string, context?: LogContext): void {
    // 检查日志级别
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context: { ...this.context, ...context },
    };

    // 输出到控制台
    if (this.config.enableConsole) {
      this.logToConsole(entry);
    }

    // TODO(@backlog): 输出到文件（如果需要）
    if (this.config.enableFile && this.config.filePath) {
      // 实现文件日志
    }
  }

  /**
   * 检查是否应该记录该级别的日志
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = [
      LogLevel.DEBUG,
      LogLevel.INFO,
      LogLevel.WARN,
      LogLevel.ERROR,
    ];
    const minLevelIndex = levels.indexOf(this.config.minLevel);
    const currentLevelIndex = levels.indexOf(level);
    return currentLevelIndex >= minLevelIndex;
  }

  /**
   * 输出到控制台
   */
  private logToConsole(entry: LogEntry): void {
    const { level, message, timestamp, context } = entry;
    const timeStr = timestamp.toISOString();
    const contextStr =
      Object.keys(context ?? {}).length > 0 ? JSON.stringify(context) : "";

    const logMessage = `[${timeStr}] [${level.toUpperCase()}] ${message} ${contextStr}`;

    switch (level) {
      case "debug":
        // eslint-disable-next-line no-console
        console.debug(logMessage);
        break;
      case "info":
        console.info(logMessage);
        break;
      case "warn":
        // eslint-disable-next-line no-console
        console.warn(logMessage);
        break;
      case "error":
        console.error(logMessage);
        if (context?.error instanceof Error) {
          console.error(context.error.stack);
        }
        break;
    }
  }
}

/**
 * 创建默认 Logger 实例
 * @param contextOrModule - LogContext 对象或模块名字符串
 */
export function createLogger(
  contextOrModule?: LogContext | string,
): LoggerService {
  // 如果传入的是字符串，转换为 LogContext 对象
  const context =
    typeof contextOrModule === "string"
      ? { module: contextOrModule }
      : contextOrModule;

  return new LoggerService(
    {
      minLevel: (process.env.LOG_LEVEL as LogLevel) ?? "info",
      enableConsole: true,
    },
    context,
  );
}
