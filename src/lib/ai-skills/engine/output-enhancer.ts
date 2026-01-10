/**
 * OutputEnhancer - 输出增强模块
 *
 * 职责：
 * - 在流式输出完成前注入跟进建议
 * - 将输出记录到会话记忆
 * - 增强 done chunk（注入 conversationId 等）
 * - 引用追踪：检测搜索结果并自动添加引用标注
 *
 * 从 UnifiedEngine 中拆分，遵循单一职责原则
 *
 * @version 1.1.0
 * @since 2025-12-26
 * @updated 2025-12-28 - 集成引用追踪系统
 */

import { logger } from "@/lib/logger";
import type { IntentType } from "../router";
import type { MemoryManager } from "../../ai-memory";
import type { UnifiedOutputAdapter } from "../output/adapter";
import type { UnifiedStreamChunk, CitationChunk } from "../output/types";
import type { EngineContext } from "./types";
import type { CitationEnricher } from "../../ai-agent/citation";
import {
  getCitationEnricher,
  type SearchResultItem,
} from "../../ai-agent/citation";
import { FeatureFlags } from "../../ai-agent/config/feature-flags";

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
  /** 是否启用引用追踪 */
  enableCitations?: boolean;
  /** 是否启用调试模式 */
  debug?: boolean;
}

/** 搜索相关的工具名称 */
const SEARCH_TOOL_NAMES = ["search"] as const;

// ============================================
// OutputEnhancer 类
// ============================================

/**
 * 输出增强器
 *
 * 负责增强流式输出，包括注入跟进建议、记录到会话记忆和引用追踪
 */
export class OutputEnhancer {
  private config: Required<OutputEnhancerConfig>;
  private citationEnricher: CitationEnricher;

  constructor(
    private memoryManager: MemoryManager,
    private outputAdapter: UnifiedOutputAdapter,
    config: OutputEnhancerConfig = {},
  ) {
    this.config = {
      enableMemory: true,
      enableSuggestions: true,
      enableCitations: true,
      debug: false,
      ...config,
    };
    this.citationEnricher = getCitationEnricher();
  }

  /**
   * 增强输出流
   *
   * 组合应用引用追踪、建议注入和记忆记录
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
    // 按顺序应用增强：先引用追踪，再建议，最后记忆
    let enhanced = generator;

    // 引用追踪需要在建议之前处理，以便在 done 之前增强文本
    if (
      this.config.enableCitations &&
      FeatureFlags.ENABLE_CITATION_TRACKING &&
      context.conversationId
    ) {
      enhanced = this.withCitations(enhanced, context);
    }

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
   * 引用追踪增强
   *
   * 检测搜索工具调用结果，建立引用索引，并在完成时增强响应文本
   *
   * @param generator - 输出生成器
   * @param context - 引擎上下文
   * @yields 带引用追踪的统一流式输出块
   */
  async *withCitations(
    generator: AsyncGenerator<UnifiedStreamChunk>,
    context: EngineContext,
  ): AsyncGenerator<UnifiedStreamChunk> {
    if (!context.conversationId) {
      yield* generator;
      return;
    }

    const conversationId = context.conversationId;
    let collectedText = "";
    let citationChunkEmitted = false;
    let lastSearchQuery: string | undefined;

    for await (const chunk of generator) {
      // 检测搜索工具调用，建立引用索引
      if (chunk.type === "tool-call") {
        const { toolName, args, result, status } = chunk.data;

        // 只处理已完成的搜索工具调用
        if (
          status === "completed" &&
          SEARCH_TOOL_NAMES.includes(
            toolName as (typeof SEARCH_TOOL_NAMES)[number],
          ) &&
          result
        ) {
          // 提取查询参数
          const queryArg = args as { query?: string; keyword?: string };
          lastSearchQuery = queryArg.query || queryArg.keyword;

          // 从结果中提取搜索结果项
          const searchResults = this.extractSearchResults(result);

          if (searchResults.length > 0) {
            // 处理搜索结果，建立引用索引
            const citationData = this.citationEnricher.processSearchResults(
              conversationId,
              searchResults,
              lastSearchQuery,
            );

            // 发送引用块
            if (!citationChunkEmitted && citationData.totalCitations > 0) {
              const citationChunk: CitationChunk = {
                type: "citation",
                data: {
                  indexed: citationData.indexed,
                  totalCitations: citationData.totalCitations,
                  citationSummary: citationData.citationSummary,
                  conversationId,
                  query: lastSearchQuery,
                },
              };
              yield citationChunk;
              citationChunkEmitted = true;

              if (this.config.debug) {
                logger.debug(
                  {
                    conversationId: conversationId.slice(0, 8) + "...",
                    totalCitations: citationData.totalCitations,
                    query: lastSearchQuery?.slice(0, 30),
                  },
                  "OutputEnhancer: Citation index created",
                );
              }
            }
          }
        }
      }

      // 收集文本内容用于增强
      if (chunk.type === "text") {
        const textData = chunk.data as { text?: string };
        if (textData.text) {
          collectedText += textData.text;
        }
      }

      // 在 done chunk 之前增强文本（如果有引用）
      if (chunk.type === "done") {
        // 只有在有引用时才增强
        if (
          this.citationEnricher.hasCitations(conversationId) &&
          collectedText
        ) {
          const enrichResult = this.citationEnricher.enrichResponse(
            collectedText,
            conversationId,
          );

          // 如果增强后文本有变化，更新 summary
          if (
            enrichResult.hasCitations &&
            enrichResult.enrichedText !== collectedText
          ) {
            if (this.config.debug) {
              logger.debug(
                {
                  conversationId: conversationId.slice(0, 8) + "...",
                  originalLength: collectedText.length,
                  enrichedLength: enrichResult.enrichedText.length,
                  citationsUsed: enrichResult.stats.total,
                },
                "OutputEnhancer: Response enriched with citations",
              );
            }

            // 将增强后的摘要注入到 done chunk
            yield {
              ...chunk,
              data: {
                ...chunk.data,
                summary: enrichResult.enrichedText,
              },
            };
            continue;
          }
        }
      }

      yield chunk;
    }
  }

  /**
   * 从工具调用结果中提取搜索结果项
   *
   * @param result - 工具调用结果
   * @returns 搜索结果项数组
   */
  private extractSearchResults(result: unknown): SearchResultItem[] {
    if (!result || typeof result !== "object") {
      return [];
    }

    const resultObj = result as Record<string, unknown>;

    // 尝试从 results 字段提取
    if (Array.isArray(resultObj.results)) {
      return resultObj.results
        .filter(
          (item): item is Record<string, unknown> =>
            typeof item === "object" && item !== null && "id" in item,
        )
        .map((item) => ({
          bookmarkId: Number(item.id),
          title: String(item.title || ""),
          url: String(item.url || ""),
          summary: item.summary ? String(item.summary) : undefined,
          platform: item.platform ? String(item.platform) : undefined,
          score: typeof item.score === "number" ? item.score : undefined,
        }));
    }

    // 尝试从 bookmarks 字段提取
    if (Array.isArray(resultObj.bookmarks)) {
      return resultObj.bookmarks
        .filter(
          (item): item is Record<string, unknown> =>
            typeof item === "object" && item !== null && "id" in item,
        )
        .map((item) => ({
          bookmarkId: Number(item.id),
          title: String(item.title || ""),
          url: String(item.url || ""),
          summary: item.summary ? String(item.summary) : undefined,
          platform: item.platform ? String(item.platform) : undefined,
          score: typeof item.score === "number" ? item.score : undefined,
        }));
    }

    return [];
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
