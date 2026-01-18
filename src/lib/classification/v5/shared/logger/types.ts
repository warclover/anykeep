/**
 * 智能分类 v5.0 - Logger Service 类型定义
 */

/**
 * 日志级别
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * 日志上下文
 */
export interface LogContext {
  /** 用户ID */
  userId?: string;
  /** 书签ID */
  bookmarkId?: string;
  /** 文件夹ID */
  folderId?: string;
  /** 请求ID（用于追踪） */
  requestId?: string;
  /** 额外的上下文数据 */
  [key: string]: unknown;
}

/**
 * 日志条目
 */
export interface LogEntry {
  /** 日志级别 */
  level: LogLevel;
  /** 日志消息 */
  message: string;
  /** 时间戳 */
  timestamp: Date;
  /** 上下文信息 */
  context?: LogContext;
  /** 错误对象（如果有） */
  error?: Error;
}

/**
 * Logger 配置
 */
export interface LoggerConfig {
  /** 最小日志级别 */
  minLevel: LogLevel;
  /** 是否启用控制台输出 */
  enableConsole: boolean;
  /** 是否启用文件输出 */
  enableFile?: boolean;
  /** 日志文件路径 */
  filePath?: string;
}
