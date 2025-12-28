/**
 * KnowledgeAgent 上下文压缩模块
 *
 * 职责：
 * - 检测是否需要压缩对话历史
 * - 执行 LLM 驱动的智能压缩
 * - 支持降级策略
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import { logger } from "@/lib/logger";
import type { AgentConfig } from "./types";
import {
  ConversationCompressor,
  type ConversationMessage,
  executeWithFallback,
  type FallbackLevel,
} from "../context";
import { FeatureFlags } from "../config";

const log = logger.child({ namespace: "agent-compression" });

/**
 * 压缩上下文
 */
export interface CompressionContext {
  userId: string;
  conversationId?: string;
  baseSystemPrompt?: string;
}

/**
 * Agent 压缩结果（区别于 context 模块的 CompressionResult）
 */
export interface AgentCompressionResult {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  summary?: string;
  compressed: boolean;
  fallbackLevel?: FallbackLevel;
  fallbackReason?: string;
  metrics?: {
    originalTokens: number;
    compressedTokens: number;
    compressionRatio: number;
  };
}

/**
 * KnowledgeAgent 压缩管理器
 */
export class KnowledgeAgentCompressor {
  private compressor: ConversationCompressor;

  constructor(private config: AgentConfig) {
    this.compressor = new ConversationCompressor();
  }

  /**
   * 检查并压缩消息历史（如果需要）
   *
   * @param messageHistory 前端传递的消息历史
   * @param context 压缩所需的上下文
   * @param maxContextTokens 最大上下文 Token 数
   * @returns 压缩结果
   */
  async compressIfNeeded(
    messageHistory: Array<{ role: "user" | "assistant"; content: string }>,
    context: CompressionContext,
    maxContextTokens: number = 8000,
  ): Promise<AgentCompressionResult> {
    // 检查 Feature Flag
    if (!FeatureFlags.ENABLE_CONVERSATION_COMPRESSION) {
      return { messages: messageHistory, compressed: false };
    }

    // 转换为 ConversationMessage 格式
    const conversationMessages: ConversationMessage[] = messageHistory.map(
      (msg) => ({
        role: msg.role,
        content: msg.content,
      }),
    );

    // 检查是否需要压缩
    const check = this.compressor.shouldCompress(
      conversationMessages,
      maxContextTokens,
    );

    if (!check.needed) {
      log.debug(
        {
          userId: context.userId,
          conversationId: context.conversationId,
          reason: check.reason,
          currentTurns: check.currentTurns,
          tokenUsageRatio: check.tokenUsageRatio,
        },
        "Compression not needed",
      );
      return { messages: messageHistory, compressed: false };
    }

    log.info(
      {
        userId: context.userId,
        conversationId: context.conversationId,
        reason: check.reason,
        currentTurns: check.currentTurns,
        tokenUsageRatio: check.tokenUsageRatio,
      },
      "Starting message compression with fallback support",
    );

    // 使用带降级策略的压缩执行器
    const fallbackResult = await executeWithFallback(
      conversationMessages,
      async () => {
        return this.compressor.compress(conversationMessages, {
          userId: context.userId,
          conversationId: context.conversationId || crypto.randomUUID(),
          baseSystemPrompt:
            context.baseSystemPrompt || this.config.systemPrompt,
        });
      },
      undefined, // 使用默认降级配置
      {
        userId: context.userId,
        conversationId: context.conversationId,
      },
    );

    // 转换回前端消息格式（排除系统消息）
    const resultMessages = fallbackResult.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    log.info(
      {
        userId: context.userId,
        conversationId: context.conversationId,
        originalCount: messageHistory.length,
        resultCount: resultMessages.length,
        fallbackLevel: fallbackResult.level,
        compressed: fallbackResult.compressed,
        compressionRatio: fallbackResult.metrics?.compressionRatio,
      },
      "Message compression completed",
    );

    return {
      messages: resultMessages,
      summary: fallbackResult.summary,
      compressed: fallbackResult.compressed,
      fallbackLevel: fallbackResult.level,
      fallbackReason: fallbackResult.fallbackReason,
      metrics: fallbackResult.metrics
        ? {
            originalTokens: fallbackResult.metrics.originalTokens,
            compressedTokens: fallbackResult.metrics.finalTokens,
            compressionRatio: fallbackResult.metrics.compressionRatio,
          }
        : undefined,
    };
  }

  /**
   * 获取底层压缩器实例
   */
  getCompressor(): ConversationCompressor {
    return this.compressor;
  }
}
