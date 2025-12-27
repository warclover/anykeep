/**
 * 上下文压缩类型定义
 *
 * 定义对话压缩功能相关的所有类型
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import type { ModelTierId } from "@/lib/ai-providers/model-tier-config";

// =============================================================================
// 配置类型
// =============================================================================

/**
 * 压缩触发配置
 */
export interface CompressionTriggerConfig {
  /** 轮次阈值：对话达到多少轮触发压缩检查 */
  turnThreshold: number;

  /** Token 使用率阈值：达到多少比例触发压缩 (0-1) */
  tokenUsageThreshold: number;

  /** 最小轮次保护：少于此轮次不触发压缩 */
  minTurnsBeforeCompression: number;
}

/**
 * 消息保留策略配置
 */
export interface CompressionRetentionConfig {
  /** 压缩后保留最近 N 轮原始消息 */
  keepRecentTurns: number;

  /** 压缩摘要注入位置 */
  summaryPosition: "system" | "first_user";
}

/**
 * 压缩执行配置
 */
export interface CompressionExecutionConfig {
  /** 使用的模型层级 */
  tierId: ModelTierId;

  /** 最大摘要 Token 数 */
  maxSummaryTokens: number;

  /** LLM 温度参数 */
  temperature: number;
}

/**
 * 完整压缩配置
 */
export interface CompressionConfig {
  /** 触发条件配置 */
  trigger: CompressionTriggerConfig;

  /** 保留策略配置 */
  retention: CompressionRetentionConfig;

  /** 执行选项配置 */
  execution: CompressionExecutionConfig;

  /** 功能开关 */
  enabled: boolean;
}

// =============================================================================
// 消息类型
// =============================================================================

/**
 * 对话消息
 */
export interface ConversationMessage {
  /** 消息角色 */
  role: "user" | "assistant" | "system";

  /** 消息内容 */
  content: string;

  /** 消息时间戳 */
  timestamp?: Date;

  /** 消息 ID */
  id?: string;
}

// =============================================================================
// 压缩结果类型
// =============================================================================

/**
 * 压缩检查结果
 */
export interface CompressionCheckResult {
  /** 是否需要压缩 */
  needed: boolean;

  /** 触发原因 */
  reason: string;

  /** 当前轮次数 */
  currentTurns: number;

  /** 当前 Token 使用率 */
  tokenUsageRatio?: number;
}

/**
 * 压缩执行指标
 */
export interface CompressionMetrics {
  /** 原始消息数量 */
  originalMessageCount: number;

  /** 压缩后消息数量 */
  compressedMessageCount: number;

  /** 原始估算 Token 数 */
  originalTokens: number;

  /** 压缩后估算 Token 数 */
  compressedTokens: number;

  /** 压缩比率 (0-1)，值越小压缩效果越好 */
  compressionRatio: number;

  /** 执行耗时（毫秒） */
  executionTimeMs: number;

  /** 压缩时间戳 */
  compressedAt: Date;
}

/**
 * 压缩执行结果
 */
export interface CompressionResult {
  /** 是否成功 */
  success: boolean;

  /** 压缩后的消息数组 */
  messages: ConversationMessage[];

  /** 压缩摘要（仅成功时有值） */
  summary?: string;

  /** 压缩指标（仅成功时有值） */
  metrics?: CompressionMetrics;

  /** 失败原因（仅失败时有值） */
  reason?: string;

  /** 错误详情（仅失败时有值） */
  error?: Error;
}

// =============================================================================
// 上下文类型
// =============================================================================

/**
 * 压缩执行上下文
 */
export interface CompressionContext {
  /** 用户 ID */
  userId: string;

  /** 会话 ID */
  conversationId: string;

  /** 基础系统提示 */
  baseSystemPrompt: string;

  /** 动态上下文（可选） */
  dynamicContext?: Record<string, unknown>;

  /** 追踪 ID（可选，用于日志关联） */
  traceId?: string;
}

// =============================================================================
// 验证类型
// =============================================================================

/**
 * 压缩摘要验证结果
 */
export interface CompressionValidationResult {
  /** 是否有效 */
  isValid: boolean;

  /** 验证失败原因（仅无效时有值） */
  reason?: string;

  /** 缺失的必需段落（仅无效时有值） */
  missingSections?: string[];

  /** 摘要 Token 数 */
  summaryTokens?: number;
}

// =============================================================================
// 事件类型
// =============================================================================

/**
 * 压缩事件类型
 */
export type CompressionEventType =
  | "compression_check"
  | "compression_triggered"
  | "compression_started"
  | "compression_completed"
  | "compression_failed"
  | "compression_skipped";

/**
 * 压缩事件数据
 */
export interface CompressionEvent {
  /** 事件类型 */
  type: CompressionEventType;

  /** 用户 ID */
  userId: string;

  /** 会话 ID */
  conversationId: string;

  /** 事件时间戳 */
  timestamp: Date;

  /** 触发信息 */
  trigger?: {
    reason: string;
    currentTurns: number;
    tokenUsageRatio?: number;
  };

  /** 压缩指标 */
  metrics?: CompressionMetrics;

  /** 错误信息 */
  error?: string;
}
