/**
 * OpenTelemetry 类型定义
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

/**
 * Span 属性类型
 */
export type SpanAttributeValue =
  | string
  | number
  | boolean
  | string[]
  | number[];

/**
 * Span 属性记录
 */
export type SpanAttributes = Record<string, SpanAttributeValue>;

/**
 * Span 状态码
 */
export enum SpanStatusCode {
  UNSET = 0,
  OK = 1,
  ERROR = 2,
}

/**
 * Span 状态
 */
export interface SpanStatus {
  code: SpanStatusCode;
  message?: string;
}

/**
 * Span 上下文（用于链接追踪）
 */
export interface SpanContext {
  traceId: string;
  spanId: string;
  traceFlags: number;
}

/**
 * Span 接口
 */
export interface Span {
  /** Span 名称 */
  name: string;
  /** 开始时间 (ms) */
  startTime: number;
  /** 结束时间 (ms) */
  endTime?: number;
  /** 状态 */
  status: SpanStatus;
  /** 属性 */
  attributes: SpanAttributes;
  /** Span 上下文 */
  context: SpanContext;
  /** 父 Span ID */
  parentSpanId?: string;
  /** 事件列表 */
  events: SpanEvent[];

  /** 设置属性 */
  setAttribute(key: string, value: SpanAttributeValue): void;
  /** 批量设置属性 */
  setAttributes(attributes: SpanAttributes): void;
  /** 设置状态 */
  setStatus(status: SpanStatus): void;
  /** 添加事件 */
  addEvent(name: string, attributes?: SpanAttributes): void;
  /** 记录异常 */
  recordException(error: Error): void;
  /** 结束 Span */
  end(): void;
}

/**
 * Span 事件
 */
export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: SpanAttributes;
}

/**
 * Tracer 接口
 */
export interface Tracer {
  /** 创建新 Span */
  startSpan(name: string, options?: StartSpanOptions): Span;
  /** 创建并激活 Span（设置为当前上下文） */
  startActiveSpan<T>(
    name: string,
    fn: (span: Span) => T | Promise<T>,
  ): T | Promise<T>;
  startActiveSpan<T>(
    name: string,
    options: StartSpanOptions,
    fn: (span: Span) => T | Promise<T>,
  ): T | Promise<T>;
}

/**
 * 创建 Span 的选项
 */
export interface StartSpanOptions {
  /** 初始属性 */
  attributes?: SpanAttributes;
  /** 父 Span */
  parent?: Span;
  /** Span 类型 */
  kind?: SpanKind;
}

/**
 * Span 类型
 */
export enum SpanKind {
  INTERNAL = 0,
  SERVER = 1,
  CLIENT = 2,
  PRODUCER = 3,
  CONSUMER = 4,
}

/**
 * 遥测配置
 */
export interface TelemetryConfig {
  /** 服务名称 */
  serviceName: string;
  /** 服务版本 */
  serviceVersion: string;
  /** 是否启用 */
  enabled: boolean;
  /** OTLP 端点 */
  otlpEndpoint?: string;
  /** 采样率 (0-1) */
  sampleRate?: number;
  /** 是否在控制台输出 */
  consoleExport?: boolean;
}

/**
 * 默认配置
 */
export const DEFAULT_TELEMETRY_CONFIG: TelemetryConfig = {
  serviceName: "anykeep",
  serviceVersion: "1.0.0",
  enabled: process.env.ENABLE_TELEMETRY === "true",
  otlpEndpoint: process.env.OTLP_ENDPOINT,
  sampleRate: 1.0,
  consoleExport: process.env.NODE_ENV === "development",
};

/**
 * 常用 Span 名称前缀
 */
export const SPAN_NAMES = {
  /** API 路由 */
  API: "api",
  /** AI Agent */
  AI_AGENT: "ai.agent",
  /** AI 工具 */
  AI_TOOL: "ai.tool",
  /** 数据库操作 */
  DB: "db",
  /** 缓存操作 */
  CACHE: "cache",
  /** 外部服务调用 */
  EXTERNAL: "external",
} as const;

/**
 * 常用属性键
 */
export const ATTR_KEYS = {
  // 用户相关
  USER_ID: "user.id",
  SESSION_ID: "session.id",

  // AI 相关
  AI_MODEL: "ai.model",
  AI_PROVIDER: "ai.provider",
  AI_TOKENS_INPUT: "ai.tokens.input",
  AI_TOKENS_OUTPUT: "ai.tokens.output",
  AI_TOOL_NAME: "ai.tool.name",
  AI_TOOL_SUCCESS: "ai.tool.success",

  // HTTP 相关
  HTTP_METHOD: "http.method",
  HTTP_URL: "http.url",
  HTTP_STATUS_CODE: "http.status_code",
  HTTP_ROUTE: "http.route",

  // 数据库相关
  DB_SYSTEM: "db.system",
  DB_OPERATION: "db.operation",
  DB_TABLE: "db.table",

  // 错误相关
  ERROR_TYPE: "error.type",
  ERROR_MESSAGE: "error.message",
} as const;
