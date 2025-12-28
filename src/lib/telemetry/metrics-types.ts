/**
 * 性能指标类型定义
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

// ============================================
// 指标类型
// ============================================

/**
 * 指标类型
 */
export type MetricType = "counter" | "histogram" | "gauge";

/**
 * 指标标签
 */
export type MetricLabels = Record<string, string | number | boolean>;

/**
 * 计数器指标
 */
export interface Counter {
  /** 增加计数 */
  add(value: number, labels?: MetricLabels): void;
  /** 增加 1 */
  inc(labels?: MetricLabels): void;
}

/**
 * 直方图指标（用于记录延迟分布）
 */
export interface Histogram {
  /** 记录一个值 */
  record(value: number, labels?: MetricLabels): void;
  /** 开始计时，返回结束函数 */
  startTimer(labels?: MetricLabels): () => number;
}

/**
 * 仪表盘指标（用于记录当前值）
 */
export interface Gauge {
  /** 设置值 */
  set(value: number, labels?: MetricLabels): void;
  /** 增加值 */
  inc(value?: number, labels?: MetricLabels): void;
  /** 减少值 */
  dec(value?: number, labels?: MetricLabels): void;
}

/**
 * 指标定义
 */
export interface MetricDefinition {
  /** 指标名称 */
  name: string;
  /** 指标描述 */
  description: string;
  /** 指标类型 */
  type: MetricType;
  /** 单位 */
  unit?: string;
  /** 直方图桶边界 */
  buckets?: number[];
}

/**
 * 指标数据点
 */
export interface MetricDataPoint {
  /** 指标名称 */
  name: string;
  /** 指标类型 */
  type: MetricType;
  /** 值 */
  value: number;
  /** 标签 */
  labels: MetricLabels;
  /** 时间戳 */
  timestamp: number;
  /** 直方图桶（仅直方图类型） */
  buckets?: { bound: number; count: number }[];
}

// ============================================
// 指标配置
// ============================================

/**
 * 指标收集器配置
 */
export interface MetricsConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 服务名称 */
  serviceName: string;
  /** 收集间隔（毫秒） */
  collectInterval: number;
  /** 是否导出到控制台 */
  consoleExport: boolean;
  /** OTLP 端点（可选） */
  otlpEndpoint?: string;
}

/**
 * 默认配置
 */
export const DEFAULT_METRICS_CONFIG: MetricsConfig = {
  enabled: true,
  serviceName: "anykeep",
  collectInterval: 60000, // 1 分钟
  consoleExport: process.env.NODE_ENV === "development",
};

// ============================================
// 告警阈值
// ============================================

/**
 * 告警阈值配置
 */
export interface AlertThresholds {
  /** API P95 延迟阈值（毫秒） */
  apiLatencyP95: number;
  /** AI Agent 平均响应时间阈值（毫秒） */
  agentResponseTime: number;
  /** 工具调用成功率阈值（百分比） */
  toolSuccessRate: number;
  /** 数据库查询耗时阈值（毫秒） */
  dbQueryLatency: number;
  /** 堆内存使用率阈值（百分比） */
  heapUsagePercent: number;
}

/**
 * 默认告警阈值
 */
export const DEFAULT_ALERT_THRESHOLDS: AlertThresholds = {
  apiLatencyP95: 3000, // 3 秒
  agentResponseTime: 15000, // 15 秒
  toolSuccessRate: 95, // 95%
  dbQueryLatency: 500, // 500 毫秒
  heapUsagePercent: 80, // 80%
};

// ============================================
// 指标名称常量
// ============================================

/**
 * 预定义指标名称
 */
export const METRIC_NAMES = {
  // API 指标
  API_LATENCY: "api.latency",
  API_REQUESTS_TOTAL: "api.requests.total",
  API_ERRORS_TOTAL: "api.errors.total",

  // AI Agent 指标
  AGENT_RESPONSE_TIME: "ai.agent.response_time",
  AGENT_REQUESTS_TOTAL: "ai.agent.requests.total",
  AGENT_TOKENS_USED: "ai.agent.tokens.used",

  // 工具调用指标
  TOOL_CALLS_TOTAL: "ai.tool.calls.total",
  TOOL_LATENCY: "ai.tool.latency",
  TOOL_ERRORS_TOTAL: "ai.tool.errors.total",

  // 数据库指标
  DB_QUERY_LATENCY: "db.query.latency",
  DB_QUERIES_TOTAL: "db.queries.total",
  DB_CONNECTIONS_ACTIVE: "db.connections.active",

  // 缓存指标
  CACHE_HIT_TOTAL: "cache.hit.total",
  CACHE_MISS_TOTAL: "cache.miss.total",
  CACHE_SIZE: "cache.size",

  // 系统指标
  HEAP_USED: "process.heap.used",
  HEAP_TOTAL: "process.heap.total",
  UPTIME: "process.uptime",
} as const;

/**
 * 标签键常量
 */
export const METRIC_LABELS = {
  // 通用
  STATUS: "status",
  ERROR_TYPE: "error_type",

  // API
  ROUTE: "route",
  METHOD: "method",
  STATUS_CODE: "status_code",

  // AI
  MODEL: "model",
  TOOL_NAME: "tool_name",
  INTENT: "intent",

  // 数据库
  OPERATION: "operation",
  TABLE: "table",

  // 缓存
  CACHE_LAYER: "cache_layer",
} as const;

// ============================================
// 直方图桶配置
// ============================================

/**
 * 延迟直方图桶边界（毫秒）
 */
export const LATENCY_BUCKETS = [
  5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000,
];

/**
 * Token 计数直方图桶边界
 */
export const TOKEN_BUCKETS = [
  100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000,
];
