/**
 * 遥测模块
 *
 * 提供分布式追踪和性能监控能力：
 * - Span 追踪
 * - 性能指标采集
 * - 日志关联
 *
 * @version 1.0.0
 * @since 2025-12-28
 *
 * @example
 * ```typescript
 * import { withSpan, withAIToolSpan, initTelemetry } from "@/lib/telemetry";
 *
 * // 初始化（应用启动时调用一次）
 * initTelemetry({ enabled: true });
 *
 * // 基本使用
 * const result = await withSpan('my.operation', async () => {
 *   // 你的代码
 * });
 *
 * // AI 工具追踪
 * const searchResult = await withAIToolSpan('search_bookmarks', async (span) => {
 *   const result = await searchBookmarks(query);
 *   span.setAttribute('result.count', result.length);
 *   return result;
 * });
 * ```
 */

// 类型导出
export type {
  Span,
  Tracer,
  SpanAttributes,
  SpanAttributeValue,
  SpanEvent,
  SpanStatus,
  SpanContext,
  StartSpanOptions,
  TelemetryConfig,
} from "./types";

export {
  SpanStatusCode,
  SpanKind,
  SPAN_NAMES,
  ATTR_KEYS,
  DEFAULT_TELEMETRY_CONFIG,
} from "./types";

// Tracer 导出
export {
  getTracer,
  getActiveSpan,
  initTelemetry,
  shutdownTelemetry,
} from "./tracer";

// Wrapper 导出
export {
  withSpan,
  withSpanSync,
  withApiSpan,
  withAIAgentSpan,
  withAIToolSpan,
  withDBSpan,
  withCacheSpan,
  withExternalSpan,
  addSpanEvent,
  setSpanAttributes,
  setSpanError,
  recordTokenUsage,
} from "./wrappers";

// 指标类型导出
export type {
  Counter,
  Histogram,
  Gauge,
  MetricLabels,
  MetricDataPoint,
  MetricsConfig,
  AlertThresholds,
} from "./metrics-types";

export {
  DEFAULT_METRICS_CONFIG,
  DEFAULT_ALERT_THRESHOLDS,
  METRIC_NAMES,
  METRIC_LABELS,
  LATENCY_BUCKETS,
  TOKEN_BUCKETS,
} from "./metrics-types";

// 指标收集器导出
export { metricsCollector, initMetrics } from "./metrics-collector";

// 预定义指标导出
export {
  apiMetrics,
  agentMetrics,
  toolMetrics,
  dbMetrics,
  cacheMetrics,
  systemMetrics,
  recordApiRequest,
  recordAgentResponse,
  recordToolCall,
  recordDbQuery,
  recordCacheAccess,
  updateSystemMetrics,
} from "./metrics";

// 告警类型导出
export type {
  AlertSeverity,
  AlertState,
  AlertCondition,
  AlertRule,
  AlertInstance,
  NotificationChannelType,
  NotificationChannelConfig,
  AlertManagerConfig,
  NotificationResult,
  AlertEvent,
} from "./alert-types";

export { DEFAULT_ALERT_MANAGER_CONFIG } from "./alert-types";

// 告警管理器导出
export { alertManager, initAlertManager } from "./alert-manager";

// 预定义告警规则导出
export {
  predefinedAlertRules,
  predefinedChannels,
  apiLatencyRule,
  apiErrorRateRule,
  agentSlowResponseRule,
  toolFailureRateRule,
  dbSlowQueryRule,
  heapUsageRule,
  cacheHitRateLowRule,
  createSlackChannel,
  createWebhookChannel,
  createAlertRule,
} from "./alert-rules";
