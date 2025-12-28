/**
 * 预定义告警规则
 *
 * 基于架构改进计划定义的关键告警规则：
 * - API 性能监控
 * - AI Agent 响应监控
 * - 工具调用成功率
 * - 数据库性能
 * - 系统资源
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { AlertRule, NotificationChannelConfig } from "./alert-types";
import { METRIC_NAMES } from "./metrics-types";
import { DEFAULT_ALERT_THRESHOLDS } from "./metrics-types";

// ============================================
// API 性能告警规则
// ============================================

/**
 * API 延迟过高告警
 */
export const apiLatencyRule: AlertRule = {
  id: "api-latency-high",
  name: "API 延迟过高",
  description: "API P95 延迟超过阈值",
  condition: {
    metric: METRIC_NAMES.API_LATENCY,
    operator: "gt",
    threshold: DEFAULT_ALERT_THRESHOLDS.apiLatencyP95,
    duration: 300000, // 5 分钟
  },
  severity: "warning",
  enabled: true,
  messageTemplate:
    "API 延迟过高: 当前 P95 延迟 {{value}}ms 超过阈值 {{threshold}}ms",
  resolveTemplate: "API 延迟已恢复正常",
};

/**
 * API 错误率过高告警
 */
export const apiErrorRateRule: AlertRule = {
  id: "api-error-rate-high",
  name: "API 错误率过高",
  description: "API 5xx 错误率超过 5%",
  condition: {
    metric: METRIC_NAMES.API_ERRORS_TOTAL,
    operator: "gt",
    threshold: 0.05, // 5%
    duration: 300000, // 5 分钟
    labels: { error_type: "server" },
  },
  severity: "critical",
  enabled: true,
  messageTemplate: "API 服务器错误率过高: {{value}}% 超过阈值 {{threshold}}%",
  resolveTemplate: "API 错误率已恢复正常",
};

// ============================================
// AI Agent 告警规则
// ============================================

/**
 * AI Agent 响应慢告警
 */
export const agentSlowResponseRule: AlertRule = {
  id: "agent-slow-response",
  name: "AI Agent 响应缓慢",
  description: "AI Agent 平均响应时间超过阈值",
  condition: {
    metric: METRIC_NAMES.AGENT_RESPONSE_TIME,
    operator: "gt",
    threshold: DEFAULT_ALERT_THRESHOLDS.agentResponseTime,
    duration: 600000, // 10 分钟
  },
  severity: "warning",
  enabled: true,
  messageTemplate:
    "AI Agent 响应缓慢: 平均响应时间 {{value}}ms 超过阈值 {{threshold}}ms",
  resolveTemplate: "AI Agent 响应时间已恢复正常",
};

// ============================================
// 工具调用告警规则
// ============================================

/**
 * 工具调用失败率告警
 */
export const toolFailureRateRule: AlertRule = {
  id: "tool-failure-rate-high",
  name: "工具调用失败率过高",
  description: "AI 工具调用失败率超过阈值",
  condition: {
    metric: METRIC_NAMES.TOOL_ERRORS_TOTAL,
    operator: "gt",
    threshold: 100 - DEFAULT_ALERT_THRESHOLDS.toolSuccessRate, // 5% 失败率
    duration: 300000, // 5 分钟
  },
  severity: "warning",
  enabled: true,
  messageTemplate: "工具调用失败率过高: {{value}}% 超过阈值 {{threshold}}%",
  resolveTemplate: "工具调用失败率已恢复正常",
};

// ============================================
// 数据库告警规则
// ============================================

/**
 * 数据库查询慢告警
 */
export const dbSlowQueryRule: AlertRule = {
  id: "db-slow-query",
  name: "数据库查询缓慢",
  description: "数据库查询平均耗时超过阈值",
  condition: {
    metric: METRIC_NAMES.DB_QUERY_LATENCY,
    operator: "gt",
    threshold: DEFAULT_ALERT_THRESHOLDS.dbQueryLatency,
    duration: 300000, // 5 分钟
  },
  severity: "warning",
  enabled: true,
  messageTemplate:
    "数据库查询缓慢: 平均耗时 {{value}}ms 超过阈值 {{threshold}}ms",
  resolveTemplate: "数据库查询性能已恢复正常",
};

// ============================================
// 系统资源告警规则
// ============================================

/**
 * 堆内存使用率告警
 */
export const heapUsageRule: AlertRule = {
  id: "heap-usage-high",
  name: "堆内存使用率过高",
  description: "Node.js 堆内存使用率超过阈值",
  condition: {
    metric: METRIC_NAMES.HEAP_USED,
    operator: "gt",
    threshold: DEFAULT_ALERT_THRESHOLDS.heapUsagePercent,
    duration: 600000, // 10 分钟
  },
  severity: "warning",
  enabled: true,
  messageTemplate: "堆内存使用率过高: {{value}}% 超过阈值 {{threshold}}%",
  resolveTemplate: "堆内存使用率已恢复正常",
};

// ============================================
// 缓存告警规则
// ============================================

/**
 * 缓存命中率过低告警
 */
export const cacheHitRateLowRule: AlertRule = {
  id: "cache-hit-rate-low",
  name: "缓存命中率过低",
  description: "缓存命中率低于阈值",
  condition: {
    metric: METRIC_NAMES.CACHE_HIT_TOTAL,
    operator: "lt",
    threshold: 50, // 50% 命中率
    duration: 600000, // 10 分钟
  },
  severity: "info",
  enabled: true,
  messageTemplate: "缓存命中率过低: {{value}}% 低于阈值 {{threshold}}%",
  resolveTemplate: "缓存命中率已恢复正常",
};

// ============================================
// 预定义规则集合
// ============================================

/**
 * 所有预定义告警规则
 */
export const predefinedAlertRules: AlertRule[] = [
  apiLatencyRule,
  apiErrorRateRule,
  agentSlowResponseRule,
  toolFailureRateRule,
  dbSlowQueryRule,
  heapUsageRule,
  cacheHitRateLowRule,
];

// ============================================
// 预定义通知渠道
// ============================================

/**
 * 控制台通知渠道（开发环境）
 */
export const consoleChannel: NotificationChannelConfig = {
  id: "console",
  name: "Console",
  type: "console",
  enabled: process.env.NODE_ENV === "development",
  severities: ["critical", "warning", "info"],
};

/**
 * 预定义通知渠道
 */
export const predefinedChannels: NotificationChannelConfig[] = [consoleChannel];

// ============================================
// 工厂函数
// ============================================

/**
 * 创建 Slack 通知渠道
 */
export function createSlackChannel(
  id: string,
  webhookUrl: string,
  options?: {
    name?: string;
    channel?: string;
    severities?: ("critical" | "warning" | "info")[];
  },
): NotificationChannelConfig {
  return {
    id,
    name: options?.name ?? "Slack",
    type: "slack",
    enabled: true,
    severities: options?.severities ?? ["critical", "warning"],
    webhookUrl,
    channel: options?.channel,
  };
}

/**
 * 创建 Webhook 通知渠道
 */
export function createWebhookChannel(
  id: string,
  url: string,
  options?: {
    name?: string;
    method?: "POST" | "PUT";
    headers?: Record<string, string>;
    authType?: "none" | "basic" | "bearer";
    authCredentials?: string;
    severities?: ("critical" | "warning" | "info")[];
  },
): NotificationChannelConfig {
  return {
    id,
    name: options?.name ?? "Webhook",
    type: "webhook",
    enabled: true,
    severities: options?.severities ?? ["critical", "warning"],
    url,
    method: options?.method ?? "POST",
    headers: options?.headers,
    authType: options?.authType ?? "none",
    authCredentials: options?.authCredentials,
  };
}

/**
 * 创建自定义告警规则
 */
export function createAlertRule(
  id: string,
  name: string,
  condition: AlertRule["condition"],
  options?: Partial<Omit<AlertRule, "id" | "name" | "condition">>,
): AlertRule {
  return {
    id,
    name,
    description: options?.description ?? name,
    condition,
    severity: options?.severity ?? "warning",
    enabled: options?.enabled ?? true,
    labels: options?.labels,
    messageTemplate: options?.messageTemplate,
    resolveTemplate: options?.resolveTemplate,
  };
}
