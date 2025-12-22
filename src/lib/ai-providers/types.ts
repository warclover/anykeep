/**
 * AI Provider 类型定义
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

import type { LanguageModel } from "ai";

/**
 * Provider 名称枚举
 */
export type ProviderName = "deepseek" | "openai" | "anthropic" | "local";

/**
 * 任务类型（用于路由决策）
 */
export type AITaskType =
  | "chat" // 普通对话
  | "summary" // 摘要生成
  | "classify" // 内容分类
  | "reasoning" // 复杂推理
  | "vision" // 图像理解
  | "embedding" // 向量生成
  | "tool_calling"; // 工具调用

/**
 * Provider 配置
 */
export interface ProviderConfig {
  /** Provider 名称 */
  name: ProviderName;
  /** API Key 环境变量名 */
  apiKeyEnv: string;
  /** 基础 URL（可选） */
  baseUrl?: string;
  /** 默认模型 */
  defaultModel: string;
  /** 支持的任务类型 */
  supportedTasks: AITaskType[];
  /** 优先级（数字越小优先级越高） */
  priority: number;
  /** 是否启用 */
  enabled: boolean;
  /** 成本系数（相对于 DeepSeek） */
  costFactor: number;
  /** 最大 Token 数 */
  maxTokens: number;
  /** 是否支持 Tool Calling */
  supportsToolCalling: boolean;
  /** 是否支持流式响应 */
  supportsStreaming: boolean;
}

/**
 * 电路断路器状态
 * - closed: 正常状态，允许所有请求
 * - open: 断开状态，拒绝所有请求
 * - half-open: 半开状态，允许少量测试请求
 */
export type CircuitState = "closed" | "open" | "half-open";

/**
 * 电路断路器配置
 */
export interface CircuitBreakerConfig {
  /** 触发断开的失败阈值 */
  failureThreshold: number;
  /** 断开后的冷却时间（毫秒） */
  cooldownMs: number;
  /** 半开状态允许的测试请求数 */
  halfOpenRequests: number;
  /** 成功恢复所需的连续成功次数 */
  recoveryThreshold: number;
}

/**
 * Provider 健康状态
 */
export interface ProviderHealth {
  name: ProviderName;
  status: "healthy" | "degraded" | "unhealthy";
  latencyMs?: number;
  lastCheckedAt: Date;
  errorMessage?: string;
  consecutiveFailures: number;
  /** 电路断路器状态 */
  circuitState: CircuitState;
  /** 电路断开时间 */
  circuitOpenedAt?: Date;
  /** 半开状态下的测试请求计数 */
  halfOpenRequestCount: number;
  /** 半开状态下的成功计数 */
  halfOpenSuccessCount: number;
}

/**
 * Provider 选择结果
 */
export interface ProviderSelection {
  provider: ProviderConfig;
  model: LanguageModel;
  reason: string;
}

/**
 * 路由决策输入
 */
export interface RoutingDecisionInput {
  taskType: AITaskType;
  preferredProvider?: ProviderName;
  requiresToolCalling?: boolean;
  requiresStreaming?: boolean;
  maxCostFactor?: number;
  minTokenLimit?: number;
}

/**
 * Provider 使用统计
 */
export interface ProviderUsageStats {
  name: ProviderName;
  requestCount: number;
  successCount: number;
  errorCount: number;
  totalTokens: number;
  avgLatencyMs: number;
  lastUsedAt?: Date;
}
