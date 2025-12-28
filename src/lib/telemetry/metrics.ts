/**
 * 预定义应用指标
 *
 * 提供预配置的指标实例，用于收集关键性能数据：
 * - API 延迟和请求数
 * - AI Agent 响应时间和 Token 使用
 * - 工具调用成功率
 * - 数据库查询性能
 * - 缓存命中率
 *
 * @version 1.0.0
 * @since 2025-12-28
 *
 * @example
 * ```typescript
 * import { apiMetrics, agentMetrics, toolMetrics } from "@/lib/telemetry";
 *
 * // 记录 API 延迟
 * const endTimer = apiMetrics.latency.startTimer({ route: "/api/bookmarks" });
 * // ... 处理请求
 * endTimer();
 *
 * // 记录 AI Agent 响应
 * agentMetrics.responseTime.record(1500, { model: "deepseek-chat" });
 * agentMetrics.tokensUsed.add(500, { model: "deepseek-chat" });
 *
 * // 记录工具调用
 * toolMetrics.calls.inc({ tool: "search_bookmarks", status: "success" });
 * ```
 */

import { metricsCollector } from "./metrics-collector";
import { METRIC_NAMES, LATENCY_BUCKETS } from "./metrics-types";

// ============================================
// API 指标
// ============================================

/**
 * API 相关指标
 */
export const apiMetrics = {
  /**
   * API 请求延迟（毫秒）
   */
  latency: metricsCollector.createHistogram(
    METRIC_NAMES.API_LATENCY,
    "API request latency in milliseconds",
    { unit: "ms", buckets: LATENCY_BUCKETS },
  ),

  /**
   * API 请求总数
   */
  requests: metricsCollector.createCounter(
    METRIC_NAMES.API_REQUESTS_TOTAL,
    "Total number of API requests",
  ),

  /**
   * API 错误总数
   */
  errors: metricsCollector.createCounter(
    METRIC_NAMES.API_ERRORS_TOTAL,
    "Total number of API errors",
  ),
};

// ============================================
// AI Agent 指标
// ============================================

/**
 * AI Agent 相关指标
 */
export const agentMetrics = {
  /**
   * Agent 响应时间（毫秒）
   */
  responseTime: metricsCollector.createHistogram(
    METRIC_NAMES.AGENT_RESPONSE_TIME,
    "AI Agent response time in milliseconds",
    { unit: "ms", buckets: LATENCY_BUCKETS },
  ),

  /**
   * Agent 请求总数
   */
  requests: metricsCollector.createCounter(
    METRIC_NAMES.AGENT_REQUESTS_TOTAL,
    "Total number of AI Agent requests",
  ),

  /**
   * Token 使用量
   */
  tokensUsed: metricsCollector.createCounter(
    METRIC_NAMES.AGENT_TOKENS_USED,
    "Total tokens used by AI Agent",
  ),
};

// ============================================
// 工具调用指标
// ============================================

/**
 * AI 工具调用指标
 */
export const toolMetrics = {
  /**
   * 工具调用总数
   */
  calls: metricsCollector.createCounter(
    METRIC_NAMES.TOOL_CALLS_TOTAL,
    "Total number of tool calls",
  ),

  /**
   * 工具调用延迟（毫秒）
   */
  latency: metricsCollector.createHistogram(
    METRIC_NAMES.TOOL_LATENCY,
    "Tool call latency in milliseconds",
    { unit: "ms", buckets: LATENCY_BUCKETS },
  ),

  /**
   * 工具调用错误数
   */
  errors: metricsCollector.createCounter(
    METRIC_NAMES.TOOL_ERRORS_TOTAL,
    "Total number of tool call errors",
  ),
};

// ============================================
// 数据库指标
// ============================================

/**
 * 数据库相关指标
 */
export const dbMetrics = {
  /**
   * 数据库查询延迟（毫秒）
   */
  queryLatency: metricsCollector.createHistogram(
    METRIC_NAMES.DB_QUERY_LATENCY,
    "Database query latency in milliseconds",
    { unit: "ms", buckets: LATENCY_BUCKETS },
  ),

  /**
   * 数据库查询总数
   */
  queries: metricsCollector.createCounter(
    METRIC_NAMES.DB_QUERIES_TOTAL,
    "Total number of database queries",
  ),

  /**
   * 活跃连接数
   */
  activeConnections: metricsCollector.createGauge(
    METRIC_NAMES.DB_CONNECTIONS_ACTIVE,
    "Number of active database connections",
  ),
};

// ============================================
// 缓存指标
// ============================================

/**
 * 缓存相关指标
 */
export const cacheMetrics = {
  /**
   * 缓存命中数
   */
  hits: metricsCollector.createCounter(
    METRIC_NAMES.CACHE_HIT_TOTAL,
    "Total number of cache hits",
  ),

  /**
   * 缓存未命中数
   */
  misses: metricsCollector.createCounter(
    METRIC_NAMES.CACHE_MISS_TOTAL,
    "Total number of cache misses",
  ),

  /**
   * 缓存大小
   */
  size: metricsCollector.createGauge(
    METRIC_NAMES.CACHE_SIZE,
    "Current cache size",
  ),
};

// ============================================
// 系统指标
// ============================================

/**
 * 系统/进程指标
 */
export const systemMetrics = {
  /**
   * 已使用堆内存（字节）
   */
  heapUsed: metricsCollector.createGauge(
    METRIC_NAMES.HEAP_USED,
    "Heap memory used in bytes",
  ),

  /**
   * 总堆内存（字节）
   */
  heapTotal: metricsCollector.createGauge(
    METRIC_NAMES.HEAP_TOTAL,
    "Total heap memory in bytes",
  ),

  /**
   * 进程运行时间（秒）
   */
  uptime: metricsCollector.createGauge(
    METRIC_NAMES.UPTIME,
    "Process uptime in seconds",
  ),
};

// ============================================
// 便捷函数
// ============================================

/**
 * 记录 API 请求
 */
export function recordApiRequest(
  route: string,
  method: string,
  statusCode: number,
  durationMs: number,
): void {
  const labels = { route, method, status_code: statusCode.toString() };
  apiMetrics.latency.record(durationMs, labels);
  apiMetrics.requests.inc(labels);

  if (statusCode >= 400) {
    apiMetrics.errors.inc({
      route,
      method,
      status_code: statusCode.toString(),
      error_type: statusCode >= 500 ? "server" : "client",
    });
  }
}

/**
 * 记录 AI Agent 响应
 */
export function recordAgentResponse(
  model: string,
  durationMs: number,
  tokensUsed: number,
  success: boolean,
): void {
  const labels = { model, status: success ? "success" : "error" };
  agentMetrics.responseTime.record(durationMs, labels);
  agentMetrics.requests.inc(labels);

  if (tokensUsed > 0) {
    agentMetrics.tokensUsed.add(tokensUsed, { model });
  }
}

/**
 * 记录工具调用
 */
export function recordToolCall(
  toolName: string,
  durationMs: number,
  success: boolean,
  errorType?: string,
): void {
  const labels = { tool: toolName, status: success ? "success" : "error" };
  toolMetrics.calls.inc(labels);
  toolMetrics.latency.record(durationMs, labels);

  if (!success) {
    toolMetrics.errors.inc({
      tool: toolName,
      error_type: errorType ?? "unknown",
    });
  }
}

/**
 * 记录数据库查询
 */
export function recordDbQuery(
  operation: string,
  table: string,
  durationMs: number,
  success: boolean,
): void {
  const labels = { operation, table, status: success ? "success" : "error" };
  dbMetrics.queryLatency.record(durationMs, labels);
  dbMetrics.queries.inc(labels);
}

/**
 * 记录缓存访问
 */
export function recordCacheAccess(layer: string, hit: boolean): void {
  const labels = { cache_layer: layer };
  if (hit) {
    cacheMetrics.hits.inc(labels);
  } else {
    cacheMetrics.misses.inc(labels);
  }
}

/**
 * 更新系统指标
 */
export function updateSystemMetrics(): void {
  if (typeof process !== "undefined" && process.memoryUsage) {
    const memory = process.memoryUsage();
    systemMetrics.heapUsed.set(memory.heapUsed);
    systemMetrics.heapTotal.set(memory.heapTotal);
  }

  if (typeof process !== "undefined" && process.uptime) {
    systemMetrics.uptime.set(process.uptime());
  }
}
