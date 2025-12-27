/**
 * 对话上下文压缩器
 *
 * 职责：
 * - 检查是否需要压缩对话上下文
 * - 执行压缩（调用 LLM 生成摘要）
 * - 返回压缩后的消息数组
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { generateText } from "ai";
import { aiProviderRouter, getTierProviderConfig } from "@/lib/ai-providers";
import { logger } from "@/lib/logger";
import { getCompressionConfig } from "../config/compression-config";
import {
  getCompressionMessages,
  mergeSystemPromptWithSummary,
} from "./compression-prompt";
import {
  estimateMessagesTokens,
  validateCompressionSummary,
  validateCompressionEffect,
  calculateTurns,
  calculateTokenUsageRatio,
} from "./compression-validator";
import type {
  CompressionConfig,
  CompressionContext,
  CompressionCheckResult,
  CompressionResult,
  CompressionMetrics,
  ConversationMessage,
} from "./compression-types";

// =============================================================================
// ConversationCompressor 类
// =============================================================================

/**
 * 对话上下文压缩器
 *
 * 使用示例：
 * ```typescript
 * const compressor = new ConversationCompressor();
 *
 * // 检查是否需要压缩
 * const check = compressor.shouldCompress(messages, maxContextTokens);
 *
 * if (check.needed) {
 *   // 执行压缩
 *   const result = await compressor.compress(messages, {
 *     userId: 'user-123',
 *     conversationId: 'conv-456',
 *     baseSystemPrompt: 'You are a helpful assistant...',
 *   });
 *
 *   if (result.success) {
 *     // 使用压缩后的消息
 *     const newMessages = result.messages;
 *     const summary = result.summary;
 *   }
 * }
 * ```
 */
export class ConversationCompressor {
  private config: CompressionConfig;

  constructor(config?: Partial<CompressionConfig>) {
    this.config = {
      ...getCompressionConfig(),
      ...config,
    };
  }

  // ===========================================================================
  // 公共方法
  // ===========================================================================

  /**
   * 检查是否需要压缩
   *
   * 触发条件（满足任一即触发）：
   * 1. 对话轮次达到阈值
   * 2. Token 使用率达到阈值
   *
   * 保护条件：
   * - 对话轮次必须大于 minTurnsBeforeCompression
   *
   * @param messages 当前消息数组
   * @param maxContextTokens 最大上下文 Token 数（用于计算使用率）
   * @returns 检查结果
   */
  shouldCompress(
    messages: ConversationMessage[],
    maxContextTokens: number = 8000,
  ): CompressionCheckResult {
    // 功能开关检查
    if (!this.config.enabled) {
      return {
        needed: false,
        reason: "压缩功能已禁用",
        currentTurns: 0,
      };
    }

    const currentTurns = calculateTurns(messages);
    const tokenUsageRatio = calculateTokenUsageRatio(
      messages,
      maxContextTokens,
    );

    // 保护条件：轮次过少不触发
    if (currentTurns < this.config.trigger.minTurnsBeforeCompression) {
      return {
        needed: false,
        reason: `对话轮次 (${currentTurns}) 未达到最小阈值 (${this.config.trigger.minTurnsBeforeCompression})`,
        currentTurns,
        tokenUsageRatio,
      };
    }

    // 条件1：轮次触发
    if (currentTurns >= this.config.trigger.turnThreshold) {
      return {
        needed: true,
        reason: `对话轮次 (${currentTurns}) 达到阈值 (${this.config.trigger.turnThreshold})`,
        currentTurns,
        tokenUsageRatio,
      };
    }

    // 条件2：Token 使用率触发
    if (tokenUsageRatio >= this.config.trigger.tokenUsageThreshold) {
      return {
        needed: true,
        reason: `Token 使用率 (${(tokenUsageRatio * 100).toFixed(1)}%) 达到阈值 (${this.config.trigger.tokenUsageThreshold * 100}%)`,
        currentTurns,
        tokenUsageRatio,
      };
    }

    return {
      needed: false,
      reason: "未达到压缩触发条件",
      currentTurns,
      tokenUsageRatio,
    };
  }

  /**
   * 执行压缩
   *
   * 压缩流程：
   * 1. 分割消息：待压缩部分 + 保留部分
   * 2. 调用 LLM 生成压缩摘要
   * 3. 验证摘要质量
   * 4. 构建新的消息数组
   *
   * @param messages 当前完整消息数组
   * @param context 压缩执行上下文
   * @returns 压缩结果
   */
  async compress(
    messages: ConversationMessage[],
    context: CompressionContext,
  ): Promise<CompressionResult> {
    const startTime = performance.now();

    // 功能开关检查
    if (!this.config.enabled) {
      return {
        success: false,
        messages,
        reason: "压缩功能已禁用",
      };
    }

    try {
      logger.info(
        {
          userId: context.userId,
          conversationId: context.conversationId,
          traceId: context.traceId,
          messageCount: messages.length,
          turnsCount: calculateTurns(messages),
        },
        "ConversationCompressor: Starting compression",
      );

      // 1. 分割消息
      const { toCompress, toKeep } = this.splitMessages(messages);

      // 没有需要压缩的消息
      if (toCompress.length === 0) {
        return {
          success: false,
          messages,
          reason: "没有需要压缩的消息",
        };
      }

      // 2. 调用 LLM 生成摘要
      const summary = await this.generateSummary(toCompress, context);

      // 3. 验证摘要质量
      const validation = validateCompressionSummary(
        summary,
        this.config.execution.maxSummaryTokens,
      );

      if (!validation.isValid) {
        logger.warn(
          {
            userId: context.userId,
            conversationId: context.conversationId,
            reason: validation.reason,
            missingSections: validation.missingSections,
          },
          "ConversationCompressor: Summary validation failed",
        );

        return {
          success: false,
          messages,
          reason: validation.reason,
        };
      }

      // 4. 构建新的消息数组
      const compressedMessages = this.buildCompressedMessages(
        toKeep,
        summary,
        context.baseSystemPrompt,
      );

      // 5. 验证压缩效果
      const effectValidation = validateCompressionEffect(
        messages,
        compressedMessages,
        summary,
      );

      if (!effectValidation.isEffective) {
        logger.warn(
          {
            userId: context.userId,
            conversationId: context.conversationId,
            reason: effectValidation.reason,
            originalTokens: effectValidation.originalTokens,
            compressedTokens: effectValidation.compressedTokens,
            compressionRatio: effectValidation.compressionRatio,
          },
          "ConversationCompressor: Compression not effective",
        );

        return {
          success: false,
          messages,
          reason: effectValidation.reason,
        };
      }

      // 6. 构建指标
      const executionTimeMs = Math.round(performance.now() - startTime);
      const metrics: CompressionMetrics = {
        originalMessageCount: messages.length,
        compressedMessageCount: compressedMessages.length,
        originalTokens: effectValidation.originalTokens,
        compressedTokens: effectValidation.compressedTokens,
        compressionRatio: effectValidation.compressionRatio,
        executionTimeMs,
        compressedAt: new Date(),
      };

      logger.info(
        {
          userId: context.userId,
          conversationId: context.conversationId,
          traceId: context.traceId,
          ...metrics,
        },
        "ConversationCompressor: Compression completed successfully",
      );

      return {
        success: true,
        messages: compressedMessages,
        summary,
        metrics,
      };
    } catch (error) {
      const executionTimeMs = Math.round(performance.now() - startTime);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(
        {
          userId: context.userId,
          conversationId: context.conversationId,
          traceId: context.traceId,
          error: errorMessage,
          executionTimeMs,
        },
        "ConversationCompressor: Compression failed",
      );

      return {
        success: false,
        messages,
        reason: `压缩执行失败: ${errorMessage}`,
        error: error instanceof Error ? error : new Error(errorMessage),
      };
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): CompressionConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<CompressionConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  // ===========================================================================
  // 私有方法
  // ===========================================================================

  /**
   * 分割消息：待压缩部分 + 保留部分
   *
   * 根据 keepRecentTurns 配置，保留最近 N 轮对话
   *
   * @param messages 完整消息数组
   * @returns 分割后的消息
   */
  private splitMessages(messages: ConversationMessage[]): {
    toCompress: ConversationMessage[];
    toKeep: ConversationMessage[];
  } {
    const keepTurns = this.config.retention.keepRecentTurns;

    // 分离系统消息和对话消息
    const systemMessages = messages.filter((m) => m.role === "system");
    const dialogMessages = messages.filter((m) => m.role !== "system");

    // 计算需要保留的消息数量
    // 一轮 = 1 条用户消息 + 1 条助手消息
    const keepMessageCount = keepTurns * 2;

    // 如果对话消息不足以分割，全部保留
    if (dialogMessages.length <= keepMessageCount) {
      return {
        toCompress: [],
        toKeep: messages,
      };
    }

    // 分割对话消息
    const splitIndex = dialogMessages.length - keepMessageCount;
    const toCompressDialog = dialogMessages.slice(0, splitIndex);
    const toKeepDialog = dialogMessages.slice(splitIndex);

    return {
      toCompress: toCompressDialog,
      toKeep: [...systemMessages, ...toKeepDialog],
    };
  }

  /**
   * 调用 LLM 生成压缩摘要
   *
   * @param messages 待压缩的消息
   * @param context 压缩上下文
   * @returns 生成的摘要
   */
  private async generateSummary(
    messages: ConversationMessage[],
    context: CompressionContext,
  ): Promise<string> {
    // 获取压缩用的模型
    const tierConfig = getTierProviderConfig(this.config.execution.tierId);
    const model = aiProviderRouter.getModel(tierConfig.name, tierConfig.model);

    if (!model) {
      throw new Error(
        `Failed to get model for tier: ${this.config.execution.tierId}`,
      );
    }

    // 构建压缩请求消息
    const compressionMessages = getCompressionMessages(messages);

    logger.debug(
      {
        userId: context.userId,
        conversationId: context.conversationId,
        tierId: this.config.execution.tierId,
        model: tierConfig.model,
        inputTokens: estimateMessagesTokens(messages),
      },
      "ConversationCompressor: Calling LLM for compression",
    );

    // 调用 LLM
    const result = await generateText({
      model,
      messages: compressionMessages,
      temperature: this.config.execution.temperature,
      maxOutputTokens: this.config.execution.maxSummaryTokens,
    });

    logger.debug(
      {
        userId: context.userId,
        conversationId: context.conversationId,
        outputTokens: result.usage?.outputTokens,
        finishReason: result.finishReason,
      },
      "ConversationCompressor: LLM compression completed",
    );

    return result.text;
  }

  /**
   * 构建压缩后的消息数组
   *
   * 根据 summaryPosition 配置决定摘要注入位置：
   * - "system": 注入到 System Prompt
   * - "first_user": 作为首条用户消息
   *
   * @param keptMessages 保留的消息
   * @param summary 压缩摘要
   * @param baseSystemPrompt 基础系统提示
   * @returns 压缩后的消息数组
   */
  private buildCompressedMessages(
    keptMessages: ConversationMessage[],
    summary: string,
    baseSystemPrompt: string,
  ): ConversationMessage[] {
    const result: ConversationMessage[] = [];

    if (this.config.retention.summaryPosition === "system") {
      // 摘要注入到 System Prompt
      const mergedSystemPrompt = mergeSystemPromptWithSummary(
        baseSystemPrompt,
        summary,
      );

      result.push({
        role: "system",
        content: mergedSystemPrompt,
        timestamp: new Date(),
      });

      // 添加保留的非系统消息
      const dialogMessages = keptMessages.filter((m) => m.role !== "system");
      result.push(...dialogMessages);
    } else {
      // 摘要作为首条用户消息
      const systemMessages = keptMessages.filter((m) => m.role === "system");
      const dialogMessages = keptMessages.filter((m) => m.role !== "system");

      // 保留原始系统消息
      result.push(...systemMessages);

      // 添加摘要作为首条消息
      result.push({
        role: "user",
        content: `[对话历史摘要]\n\n${summary}\n\n---\n请基于以上摘要继续对话。`,
        timestamp: new Date(),
      });

      // 添加保留的对话消息
      result.push(...dialogMessages);
    }

    return result;
  }
}

// =============================================================================
// 导出
// =============================================================================

/**
 * 默认压缩器实例
 */
export const conversationCompressor = new ConversationCompressor();
