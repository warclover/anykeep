/**
 * 压缩结果验证器
 *
 * 验证 LLM 生成的压缩摘要是否符合要求
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import type {
  CompressionValidationResult,
  ConversationMessage,
} from "./compression-types";
import {
  REQUIRED_SUMMARY_SECTIONS,
  SUMMARY_SECTION_PATTERNS,
} from "../config/compression-config";

// =============================================================================
// Token 估算
// =============================================================================

/**
 * 估算文本的 Token 数量
 *
 * 简化的估算算法（中英文混合场景）：
 * - 中文：约 1.5 字符/token
 * - 英文：约 4 字符/token
 * - 混合场景取平均：约 2.5 字符/token
 *
 * @param text 待估算的文本
 * @returns 估算的 Token 数
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  // 统计中文字符数
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;

  // 中文约 1.5 字符/token，其他约 4 字符/token
  return Math.ceil(chineseChars / 1.5 + otherChars / 4);
}

/**
 * 估算消息数组的总 Token 数
 *
 * @param messages 消息数组
 * @returns 总 Token 数
 */
export function estimateMessagesTokens(
  messages: ConversationMessage[],
): number {
  return messages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
}

// =============================================================================
// 摘要验证
// =============================================================================

/**
 * 检查摘要是否包含必需的段落
 *
 * @param summary 压缩摘要
 * @returns 缺失的段落列表
 */
function findMissingSections(summary: string): string[] {
  const missing: string[] = [];

  for (const section of REQUIRED_SUMMARY_SECTIONS) {
    const pattern = SUMMARY_SECTION_PATTERNS[section];
    if (!pattern.test(summary)) {
      missing.push(section);
    }
  }

  return missing;
}

/**
 * 检查摘要长度是否合理
 *
 * @param summary 压缩摘要
 * @param maxTokens 最大允许 Token 数
 * @returns 是否超过限制
 */
function isSummaryTooLong(summary: string, maxTokens: number): boolean {
  const tokens = estimateTokens(summary);
  return tokens > maxTokens;
}

/**
 * 检查摘要是否过短（可能是无效压缩）
 *
 * @param summary 压缩摘要
 * @param minTokens 最小 Token 数
 * @returns 是否过短
 */
function isSummaryTooShort(summary: string, minTokens: number = 50): boolean {
  const tokens = estimateTokens(summary);
  return tokens < minTokens;
}

/**
 * 验证压缩摘要
 *
 * 验证规则：
 * 1. 摘要不能为空
 * 2. 必须包含 4 个必需段落
 * 3. 长度不能超过最大限制
 * 4. 长度不能过短
 *
 * @param summary 压缩摘要
 * @param maxTokens 最大允许 Token 数
 * @returns 验证结果
 */
export function validateCompressionSummary(
  summary: string,
  maxTokens: number = 800,
): CompressionValidationResult {
  // 检查空摘要
  if (!summary || summary.trim().length === 0) {
    return {
      isValid: false,
      reason: "压缩摘要为空",
    };
  }

  const trimmedSummary = summary.trim();
  const summaryTokens = estimateTokens(trimmedSummary);

  // 检查过短
  if (isSummaryTooShort(trimmedSummary)) {
    return {
      isValid: false,
      reason: "压缩摘要过短，可能是无效压缩",
      summaryTokens,
    };
  }

  // 检查过长
  if (isSummaryTooLong(trimmedSummary, maxTokens)) {
    return {
      isValid: false,
      reason: `压缩摘要过长（${summaryTokens} tokens > ${maxTokens} tokens）`,
      summaryTokens,
    };
  }

  // 检查必需段落
  const missingSections = findMissingSections(trimmedSummary);
  if (missingSections.length > 0) {
    // 允许最多缺失 1 个段落（LLM 可能用不同的措辞）
    if (missingSections.length > 1) {
      return {
        isValid: false,
        reason: `压缩摘要缺少必需段落: ${missingSections.join(", ")}`,
        missingSections,
        summaryTokens,
      };
    }
  }

  return {
    isValid: true,
    summaryTokens,
    missingSections: missingSections.length > 0 ? missingSections : undefined,
  };
}

// =============================================================================
// 压缩效果验证
// =============================================================================

/**
 * 验证压缩效果
 *
 * 检查压缩是否有效（压缩后比压缩前更短）
 *
 * @param originalMessages 原始消息
 * @param compressedMessages 压缩后消息
 * @param summary 压缩摘要
 * @returns 验证结果和压缩比率
 */
export function validateCompressionEffect(
  originalMessages: ConversationMessage[],
  compressedMessages: ConversationMessage[],
  summary: string,
): {
  isEffective: boolean;
  originalTokens: number;
  compressedTokens: number;
  compressionRatio: number;
  reason?: string;
} {
  const originalTokens = estimateMessagesTokens(originalMessages);
  const compressedTokens =
    estimateMessagesTokens(compressedMessages) + estimateTokens(summary);
  const compressionRatio =
    originalTokens > 0 ? compressedTokens / originalTokens : 1;

  // 如果压缩后反而更长，认为压缩无效
  if (compressionRatio >= 1) {
    return {
      isEffective: false,
      originalTokens,
      compressedTokens,
      compressionRatio,
      reason: "压缩后长度未减少",
    };
  }

  // 如果压缩比率过高（节省不到 20%），发出警告但仍认为有效
  if (compressionRatio > 0.8) {
    return {
      isEffective: true,
      originalTokens,
      compressedTokens,
      compressionRatio,
      reason: "压缩效果有限（节省不到 20%）",
    };
  }

  return {
    isEffective: true,
    originalTokens,
    compressedTokens,
    compressionRatio,
  };
}

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 计算对话轮次数
 *
 * 一轮 = 一次用户消息 + 一次助手消息
 *
 * @param messages 消息数组
 * @returns 轮次数
 */
export function calculateTurns(messages: ConversationMessage[]): number {
  // 过滤掉系统消息
  const dialogMessages = messages.filter((m) => m.role !== "system");

  // 计算用户消息数量作为轮次数
  return dialogMessages.filter((m) => m.role === "user").length;
}

/**
 * 计算 Token 使用率
 *
 * @param messages 消息数组
 * @param maxContextTokens 最大上下文 Token 数
 * @returns 使用率 (0-1)
 */
export function calculateTokenUsageRatio(
  messages: ConversationMessage[],
  maxContextTokens: number,
): number {
  const currentTokens = estimateMessagesTokens(messages);
  return maxContextTokens > 0 ? currentTokens / maxContextTokens : 0;
}
