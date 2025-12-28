/**
 * 引用增强器
 *
 * 整合索引器、标注器和渲染器，提供完整的引用处理能力
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import { logger } from "@/lib/logger";
import type {
  Citation,
  CitationChunkData,
  CitationEnricherConfig,
  CitationEnrichResult,
  SearchResultItem,
} from "./types";
import { createCitationConfig } from "./types";
import type { CitationIndexer } from "./citation-indexer";
import { getCitationIndexer } from "./citation-indexer";
import type { CitationAnnotator } from "./citation-annotator";
import { getCitationAnnotator } from "./citation-annotator";
import type { CitationRenderer } from "./citation-renderer";
import { getCitationRenderer } from "./citation-renderer";

// ============================================================================
// CitationEnricher 类
// ============================================================================

/**
 * 引用增强器
 *
 * 提供完整的引用处理流程：
 * 1. 处理搜索结果，建立引用索引
 * 2. 在 AI 响应中标注引用
 * 3. 追加引用列表
 */
export class CitationEnricher {
  private indexer: CitationIndexer;
  private annotator: CitationAnnotator;
  private renderer: CitationRenderer;
  private config: Required<CitationEnricherConfig>;

  constructor(
    config: CitationEnricherConfig = {},
    indexer?: CitationIndexer,
    annotator?: CitationAnnotator,
    renderer?: CitationRenderer,
  ) {
    this.config = createCitationConfig(config);
    this.indexer = indexer || getCitationIndexer();
    this.annotator = annotator || getCitationAnnotator();
    this.renderer = renderer || getCitationRenderer();
  }

  /**
   * 处理搜索结果，建立引用索引
   *
   * @param conversationId - 会话 ID
   * @param searchResults - 搜索结果
   * @param query - 搜索查询
   * @returns 引用块数据（用于流式输出）
   */
  processSearchResults(
    conversationId: string,
    searchResults: SearchResultItem[],
    query?: string,
  ): CitationChunkData {
    // 过滤低置信度结果
    const filteredResults = searchResults.filter(
      (r) => r.score === undefined || r.score >= this.config.minConfidence,
    );

    // 建立索引
    this.indexer.indexSearchResults(conversationId, filteredResults, query);

    // 获取所有引用
    const citations = this.indexer.getAllCitations(conversationId);

    logger.debug(
      {
        conversationId: conversationId.slice(0, 8) + "...",
        query: query?.slice(0, 30),
        inputCount: searchResults.length,
        filteredCount: filteredResults.length,
        totalCitations: citations.length,
      },
      "CitationEnricher: Processed search results",
    );

    return {
      indexed: true,
      totalCitations: citations.length,
      citationSummary: citations.map((c) => ({
        index: c.index,
        title: c.title,
        bookmarkId: c.bookmarkId,
      })),
      query,
    };
  }

  /**
   * 增强 AI 响应文本
   *
   * @param text - 原始响应文本
   * @param conversationId - 会话 ID
   * @returns 增强结果
   */
  enrichResponse(text: string, conversationId: string): CitationEnrichResult {
    const citations = this.indexer.getAllCitations(conversationId);

    if (citations.length === 0) {
      return {
        enrichedText: text,
        citations: [],
        hasCitations: false,
        stats: { total: 0, inlineCount: 0, listCount: 0 },
      };
    }

    let enrichedText = text;
    let inlineCount = 0;

    // 自动标注
    if (this.config.autoAnnotate) {
      const annotationResult = this.annotator.annotate(enrichedText, citations);
      enrichedText = annotationResult.annotatedText;
      inlineCount = annotationResult.usedCitations.length;
    }

    // 提取已有的引用
    const existingCitations =
      this.annotator.extractExistingCitations(enrichedText);
    const usedCitations = citations.filter((c) =>
      existingCitations.includes(c.index),
    );

    // 追加引用列表
    let listCount = 0;
    if (this.config.appendReferences && usedCitations.length > 0) {
      const renderResult = this.renderer.renderReferences(usedCitations, {
        title: this.config.referencesTitle,
        showPlatform: true,
        showSummary: false,
      });
      enrichedText += renderResult.content;
      listCount = renderResult.count;
    }

    logger.debug(
      {
        conversationId: conversationId.slice(0, 8) + "...",
        totalCitations: citations.length,
        usedCitations: usedCitations.length,
        inlineCount,
        listCount,
      },
      "CitationEnricher: Enriched response",
    );

    return {
      enrichedText,
      citations: usedCitations,
      hasCitations: usedCitations.length > 0,
      stats: {
        total: usedCitations.length,
        inlineCount,
        listCount,
      },
    };
  }

  /**
   * 检查会话是否有可用引用
   *
   * @param conversationId - 会话 ID
   * @returns 是否有引用
   */
  hasCitations(conversationId: string): boolean {
    return this.indexer.hasCitations(conversationId);
  }

  /**
   * 获取会话的所有引用
   *
   * @param conversationId - 会话 ID
   * @returns 引用列表
   */
  getCitations(conversationId: string): Citation[] {
    return this.indexer.getAllCitations(conversationId);
  }

  /**
   * 根据引用编号获取引用
   *
   * @param conversationId - 会话 ID
   * @param index - 引用编号
   * @returns 引用对象
   */
  getCitationByIndex(conversationId: string, index: number): Citation | null {
    return this.indexer.getCitationByIndex(conversationId, index);
  }

  /**
   * 清除会话的引用
   *
   * @param conversationId - 会话 ID
   */
  clearCitations(conversationId: string): void {
    this.indexer.clearConversation(conversationId);
  }

  /**
   * 更新配置
   *
   * @param config - 新配置
   */
  updateConfig(config: Partial<CitationEnricherConfig>): void {
    this.config = createCitationConfig({
      ...this.config,
      ...config,
    });
  }

  /**
   * 获取当前配置
   */
  getConfig(): Required<CitationEnricherConfig> {
    return { ...this.config };
  }
}

// ============================================================================
// 单例实例
// ============================================================================

/** 全局引用增强器实例 */
let globalEnricher: CitationEnricher | null = null;

/**
 * 获取全局引用增强器实例
 */
export function getCitationEnricher(): CitationEnricher {
  if (!globalEnricher) {
    globalEnricher = new CitationEnricher();
  }
  return globalEnricher;
}

/**
 * 重置全局引用增强器（仅用于测试）
 */
export function resetCitationEnricher(): void {
  globalEnricher = null;
}
