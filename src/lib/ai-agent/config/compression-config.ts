/**
 * 上下文压缩配置
 *
 * 定义对话压缩功能的默认配置和配置获取函数
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import type { CompressionConfig } from "../context/compression-types";

// =============================================================================
// 默认配置
// =============================================================================

/**
 * 默认压缩配置
 *
 * 针对 AnyKeep 轻量化应用场景优化：
 * - 12 轮 / 80% Token 双条件触发
 * - 保留最近 6 轮原文
 * - 使用 fast 层（deepseek-chat）执行压缩
 */
export const DEFAULT_COMPRESSION_CONFIG: CompressionConfig = {
  trigger: {
    /** 12 轮触发：AnyKeep 用户平均对话 10-20 轮 */
    turnThreshold: 12,

    /** 80% Token 使用率触发：平衡压缩时机 */
    tokenUsageThreshold: 0.8,

    /** 至少 6 轮才考虑压缩：保护短对话 */
    minTurnsBeforeCompression: 6,
  },

  retention: {
    /** 保留最近 6 轮：确保指代词解析和上下文连贯性 */
    keepRecentTurns: 6,

    /** 摘要注入到 System Prompt */
    summaryPosition: "system",
  },

  execution: {
    /** 使用 fast 层：deepseek-chat，成本低 */
    tierId: "fast",

    /** 最大摘要 800 tokens */
    maxSummaryTokens: 800,

    /** 低温度保证一致性 */
    temperature: 0.3,
  },

  /** 默认启用 */
  enabled: true,
};

// =============================================================================
// 配置获取函数
// =============================================================================

/**
 * 获取压缩配置
 *
 * 支持通过环境变量覆盖默认配置：
 * - ENABLE_CONVERSATION_COMPRESSION: 功能开关 (默认 true)
 * - COMPRESSION_TURN_THRESHOLD: 轮次阈值 (默认 12)
 * - COMPRESSION_TOKEN_THRESHOLD: Token 阈值 (默认 0.80)
 * - COMPRESSION_KEEP_TURNS: 保留轮次 (默认 6)
 * - COMPRESSION_MAX_SUMMARY_TOKENS: 最大摘要长度 (默认 800)
 *
 * @returns 合并后的压缩配置
 */
export function getCompressionConfig(): CompressionConfig {
  return {
    ...DEFAULT_COMPRESSION_CONFIG,

    trigger: {
      ...DEFAULT_COMPRESSION_CONFIG.trigger,
      turnThreshold: parseInt(
        process.env.COMPRESSION_TURN_THRESHOLD || "12",
        10,
      ),
      tokenUsageThreshold: parseFloat(
        process.env.COMPRESSION_TOKEN_THRESHOLD || "0.80",
      ),
      minTurnsBeforeCompression: parseInt(
        process.env.COMPRESSION_MIN_TURNS || "6",
        10,
      ),
    },

    retention: {
      ...DEFAULT_COMPRESSION_CONFIG.retention,
      keepRecentTurns: parseInt(process.env.COMPRESSION_KEEP_TURNS || "6", 10),
    },

    execution: {
      ...DEFAULT_COMPRESSION_CONFIG.execution,
      maxSummaryTokens: parseInt(
        process.env.COMPRESSION_MAX_SUMMARY_TOKENS || "800",
        10,
      ),
    },

    enabled: process.env.ENABLE_CONVERSATION_COMPRESSION !== "false",
  };
}

// =============================================================================
// 配置验证
// =============================================================================

/**
 * 验证压缩配置是否有效
 *
 * @param config 待验证的配置
 * @returns 验证结果
 */
export function validateCompressionConfig(config: CompressionConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // 触发配置验证
  if (config.trigger.turnThreshold < 1) {
    errors.push("turnThreshold 必须大于 0");
  }
  if (
    config.trigger.tokenUsageThreshold <= 0 ||
    config.trigger.tokenUsageThreshold > 1
  ) {
    errors.push("tokenUsageThreshold 必须在 (0, 1] 范围内");
  }
  if (config.trigger.minTurnsBeforeCompression < 1) {
    errors.push("minTurnsBeforeCompression 必须大于 0");
  }
  if (
    config.trigger.minTurnsBeforeCompression >= config.trigger.turnThreshold
  ) {
    errors.push("minTurnsBeforeCompression 必须小于 turnThreshold");
  }

  // 保留配置验证
  if (config.retention.keepRecentTurns < 1) {
    errors.push("keepRecentTurns 必须大于 0");
  }
  if (config.retention.keepRecentTurns >= config.trigger.turnThreshold) {
    errors.push("keepRecentTurns 必须小于 turnThreshold");
  }

  // 执行配置验证
  if (config.execution.maxSummaryTokens < 100) {
    errors.push("maxSummaryTokens 必须至少为 100");
  }
  if (config.execution.temperature < 0 || config.execution.temperature > 2) {
    errors.push("temperature 必须在 [0, 2] 范围内");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// =============================================================================
// 常量导出
// =============================================================================

/**
 * 压缩功能 Feature Flag 环境变量名
 */
export const COMPRESSION_FEATURE_FLAG = "ENABLE_CONVERSATION_COMPRESSION";

/**
 * 必需的压缩摘要段落
 */
export const REQUIRED_SUMMARY_SECTIONS = [
  "用户目标",
  "已完成操作",
  "重要上下文",
  "待处理事项",
] as const;

/**
 * 压缩摘要段落正则匹配模式
 */
export const SUMMARY_SECTION_PATTERNS: Record<string, RegExp> = {
  用户目标: /#{1,3}\s*\d*\.?\s*用户目标/i,
  已完成操作: /#{1,3}\s*\d*\.?\s*已完成操作/i,
  重要上下文: /#{1,3}\s*\d*\.?\s*重要上下文/i,
  待处理事项: /#{1,3}\s*\d*\.?\s*待处理事项/i,
};
