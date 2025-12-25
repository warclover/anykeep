/**
 * OutputEnhancer - 输出增强模块
 *
 * 职责：
 * - 在流式输出完成前注入跟进建议
 * - 将输出记录到会话记忆
 * - 增强 done chunk（注入 conversationId 等）
 *
 * 从 UnifiedEngine 中拆分，遵循单一职责原则
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import { logger } from "@/lib/logger";
import type { IntentType } from "../router";
import type { MemoryManager } from "../../ai-memory";
import type { UnifiedOutputAdapter } from "../output/adapter";
import type { UnifiedStreamChunk } from "../output/types";
import type { EngineContext } from "./types";

// ============================================
// 类型定义
// ============================================

/**
 * OutputEnhancer 配置
 */
export interface OutputEnhancerConfig {
  /** 是否启用记忆功能 */
  enableMemory?: boolean;
  /** 是否启用建议注入 */
  enableSuggestions?: boolean;
  /** 是否启用调试模式 */
  debug?: boolean;
}

// ============================================
// OutputEnhancer 类
// ============================================

/**
 * 输出增强器
 *
 * 负责增强流式输出，包括注入跟进建议和记录到会话记忆
 */
export class OutputEnhancer {
  private config: Required<OutputEnhancerConfig>;

  constructor(
    private memoryManager: MemoryManager,
    private outputAdapter: UnifiedOutputAdapter,
    config: OutputEnhancerConfig = {},
  ) {
    this.config = {
      enableMemory: true,
      enableSuggestions: true,
      debug: false,
      ...config,
    };
  }

  /**
   * 增强输出流
   *
   * 组合应用建议注入和记忆记录
   *
   * @param generator - 原始输出生成器
   * @param context - 引擎上下文
   * @param intentType - 意图类型
   * @param subType - 意图子类型
   * @yields 增强后的统一流式输出块
   */
  async *enhance(
    generator: AsyncGenerator<UnifiedStreamChunk>,
    context: EngineContext,
    intentType: IntentType,
    subType?: string,
  ): AsyncGenerator<UnifiedStreamChunk> {
    // 按顺序应用增强：先建议，再记忆
    let enhanced = generator;

    if (this.config.enableSuggestions) {
      enhanced = this.withSuggestions(enhanced, intentType, subType);
    }

    if (this.config.enableMemory) {
      enhanced = this.withMemory(enhanced, context, intentType, subType);
    }

    yield* enhanced;
  }

  /**
   * 执行流程并在完成前注入跟进建议
   *
   * 在 done chunk 之前发送 suggestions chunk，基于意图类型和子类型
   *
   * @param generator - 输出生成器
   * @param intentType - 意图类型
   * @param subType - 意图子类型
   * @yields 带建议的统一流式输出块
   */
  async *withSuggestions(
    generator: AsyncGenerator<UnifiedStreamChunk>,
    intentType: IntentType,
    subType?: string,
  ): AsyncGenerator<UnifiedStreamChunk> {
    let suggestionsEmitted = false;

    for await (const chunk of generator) {
      // 在 done chunk 之前注入 suggestions
      if (chunk.type === "done" && !suggestionsEmitted) {
        // 只有成功完成时才发送建议
        if (chunk.data.success) {
          const suggestionsChunk = this.outputAdapter.createSuggestionsChunk(
            intentType,
            subType,
          );
          // 只有有建议时才发送
          if (
            suggestionsChunk.type === "suggestions" &&
            suggestionsChunk.data.suggestions.length > 0
          ) {
            yield suggestionsChunk;
            suggestionsEmitted = true;
          }
        }
      }

      yield chunk;
    }
  }

  /**
   * 执行流程并记录到会话记忆
   *
   * 收集文本内容并在完成时记录到 MemoryManager
   *
   * @param generator - 输出生成器
   * @param context - 引擎上下文
   * @param intentType - 意图类型
   * @param subType - 意图子类型
   * @yields 统一流式输出块（done chunk 包含 conversationId）
   */
  async *withMemory(
    generator: AsyncGenerator<UnifiedStreamChunk>,
    context: EngineContext,
    intentType: IntentType,
    subType?: string,
  ): AsyncGenerator<UnifiedStreamChunk> {
    // 如果没有会话 ID，直接透传
    if (!context.conversationId) {
      yield* generator;
      return;
    }

    let collectedContent = "";
    const relatedEntityIds: number[] = [];

    for await (const chunk of generator) {
      // 收集文本内容（类型安全检查）
      if (chunk.type === "text") {
        const textData = chunk.data as { text?: string };
        if (textData.text) {
          collectedContent += textData.text;
        }
      }

      // 收集相关实体 ID（从 tool-call 结果中）
      if (chunk.type === "tool-call") {
        const toolCallData = chunk.data as { result?: unknown };
        if (toolCallData.result && Array.isArray(toolCallData.result)) {
          // 如果结果是数组，尝试提取 ID
          for (const item of toolCallData.result) {
            if (typeof item === "object" && item !== null && "id" in item) {
              relatedEntityIds.push(item.id as number);
            }
          }
        }
      }

      // 完成时记录到记忆并注入 conversationId
      if (chunk.type === "done") {
        if (chunk.data.success) {
          // 记录助手消息
          this.memoryManager.recordAssistantMessage(
            context.conversationId,
            collectedContent || chunk.data.summary || "",
            intentType,
            subType,
          );

          // 记录输出摘要
          this.memoryManager.recordOutput(context.conversationId, {
            type: chunk.data.mode === "orchestration" ? "deliverable" : "text",
            summary:
              chunk.data.summary ||
              collectedContent.substring(0, 100) ||
              "操作完成",
            relatedEntityIds:
              relatedEntityIds.length > 0 ? relatedEntityIds : undefined,
            outputAt: Date.now(),
          });

          if (this.config.debug) {
            logger.debug(
              {
                conversationId: context.conversationId,
                contentLength: collectedContent.length,
                entityCount: relatedEntityIds.length,
              },
              "OutputEnhancer: Memory recorded for conversation",
            );
          }
        }

        // 注入 conversationId 到 done chunk
        yield {
          ...chunk,
          data: {
            ...chunk.data,
            conversationId: context.conversationId,
          },
        };
        continue;
      }

      yield chunk;
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<OutputEnhancerConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * 获取 MemoryManager 实例
   */
  getMemoryManager(): MemoryManager {
    return this.memoryManager;
  }
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建 OutputEnhancer 实例
 */
export function createOutputEnhancer(
  memoryManager: MemoryManager,
  outputAdapter: UnifiedOutputAdapter,
  config?: OutputEnhancerConfig,
): OutputEnhancer {
  return new OutputEnhancer(memoryManager, outputAdapter, config);
}
