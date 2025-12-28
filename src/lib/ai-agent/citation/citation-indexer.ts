/**
 * 引用索引器
 *
 * 为搜索结果建立引用索引，支持会话级别的引用管理
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import { logger } from "@/lib/logger";
import type { Citation, CitationIndex, SearchResultItem } from "./types";
import { createCitationIndex, searchResultToCitation } from "./types";

// ============================================================================
// CitationIndexer 类
// ============================================================================

/**
 * 引用索引器
 *
 * 管理会话级别的引用索引，支持：
 * - 从搜索结果建立索引
 * - 查询引用
 * - 去重处理
 */
export class CitationIndexer {
  /** 会话 -> 引用索引映射 */
  private indexes: Map<string, CitationIndex> = new Map();

  /** 索引过期时间 (ms)，默认 1 小时 */
  private readonly expirationMs: number;

  constructor(expirationMs: number = 60 * 60 * 1000) {
    this.expirationMs = expirationMs;
  }

  /**
   * 为搜索结果建立引用索引
   *
   * @param conversationId - 会话 ID
   * @param searchResults - 搜索结果列表
   * @param query - 搜索查询（可选，用于日志）
   * @returns 更新后的引用索引
   */
  indexSearchResults(
    conversationId: string,
    searchResults: SearchResultItem[],
    query?: string,
  ): CitationIndex {
    // 获取或创建索引
    let index = this.indexes.get(conversationId);
    if (!index) {
      index = createCitationIndex(conversationId);
      this.indexes.set(conversationId, index);
    }

    let newCitationsCount = 0;

    for (const result of searchResults) {
      // 检查是否已存在
      if (index.bookmarkToIndex.has(result.bookmarkId)) {
        // 已存在，跳过
        continue;
      }

      // 创建新引用
      const citation = searchResultToCitation(result, index.nextIndex);
      index.citations.set(index.nextIndex, citation);
      index.bookmarkToIndex.set(result.bookmarkId, index.nextIndex);
      index.nextIndex++;
      newCitationsCount++;
    }

    index.updatedAt = Date.now();

    logger.debug(
      {
        conversationId: conversationId.slice(0, 8) + "...",
        query: query?.slice(0, 30),
        totalResults: searchResults.length,
        newCitations: newCitationsCount,
        totalCitations: index.citations.size,
      },
      "CitationIndexer: Indexed search results",
    );

    return index;
  }

  /**
   * 获取书签的引用
   *
   * @param conversationId - 会话 ID
   * @param bookmarkId - 书签 ID
   * @returns 引用对象，不存在则返回 null
   */
  getCitation(conversationId: string, bookmarkId: number): Citation | null {
    const index = this.indexes.get(conversationId);
    if (!index) {
      return null;
    }

    const citationIndex = index.bookmarkToIndex.get(bookmarkId);
    if (citationIndex === undefined) {
      return null;
    }

    return index.citations.get(citationIndex) || null;
  }

  /**
   * 根据引用编号获取引用
   *
   * @param conversationId - 会话 ID
   * @param citationIndex - 引用编号 (1-based)
   * @returns 引用对象，不存在则返回 null
   */
  getCitationByIndex(
    conversationId: string,
    citationIndex: number,
  ): Citation | null {
    const index = this.indexes.get(conversationId);
    if (!index) {
      return null;
    }

    return index.citations.get(citationIndex) || null;
  }

  /**
   * 获取会话的所有引用
   *
   * @param conversationId - 会话 ID
   * @returns 引用数组，按编号排序
   */
  getAllCitations(conversationId: string): Citation[] {
    const index = this.indexes.get(conversationId);
    if (!index) {
      return [];
    }

    return Array.from(index.citations.values()).sort(
      (a, b) => a.index - b.index,
    );
  }

  /**
   * 获取指定范围的引用
   *
   * @param conversationId - 会话 ID
   * @param start - 起始编号 (inclusive)
   * @param end - 结束编号 (inclusive)
   * @returns 引用数组
   */
  getCitationRange(
    conversationId: string,
    start: number,
    end: number,
  ): Citation[] {
    const citations: Citation[] = [];
    const index = this.indexes.get(conversationId);
    if (!index) {
      return citations;
    }

    for (let i = start; i <= end; i++) {
      const citation = index.citations.get(i);
      if (citation) {
        citations.push(citation);
      }
    }

    return citations;
  }

  /**
   * 获取引用索引对象
   *
   * @param conversationId - 会话 ID
   * @returns 引用索引，不存在则返回 null
   */
  getIndex(conversationId: string): CitationIndex | null {
    return this.indexes.get(conversationId) || null;
  }

  /**
   * 检查会话是否有引用
   *
   * @param conversationId - 会话 ID
   * @returns 是否有引用
   */
  hasCitations(conversationId: string): boolean {
    const index = this.indexes.get(conversationId);
    return index !== null && index !== undefined && index.citations.size > 0;
  }

  /**
   * 获取引用数量
   *
   * @param conversationId - 会话 ID
   * @returns 引用数量
   */
  getCitationCount(conversationId: string): number {
    const index = this.indexes.get(conversationId);
    return index?.citations.size || 0;
  }

  /**
   * 清除会话的引用索引
   *
   * @param conversationId - 会话 ID
   */
  clearConversation(conversationId: string): void {
    this.indexes.delete(conversationId);
    logger.debug(
      { conversationId: conversationId.slice(0, 8) + "..." },
      "CitationIndexer: Cleared conversation citations",
    );
  }

  /**
   * 清理过期的索引
   *
   * @returns 清理的索引数量
   */
  cleanupExpired(): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [conversationId, index] of this.indexes) {
      if (now - index.updatedAt > this.expirationMs) {
        this.indexes.delete(conversationId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info(
        { cleanedCount },
        "CitationIndexer: Cleaned up expired indexes",
      );
    }

    return cleanedCount;
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    conversationCount: number;
    totalCitations: number;
    avgCitationsPerConversation: number;
  } {
    let totalCitations = 0;
    for (const index of this.indexes.values()) {
      totalCitations += index.citations.size;
    }

    const conversationCount = this.indexes.size;
    return {
      conversationCount,
      totalCitations,
      avgCitationsPerConversation:
        conversationCount > 0 ? totalCitations / conversationCount : 0,
    };
  }
}

// ============================================================================
// 单例实例
// ============================================================================

/** 全局引用索引器实例 */
let globalIndexer: CitationIndexer | null = null;

/**
 * 获取全局引用索引器实例
 */
export function getCitationIndexer(): CitationIndexer {
  if (!globalIndexer) {
    globalIndexer = new CitationIndexer();
  }
  return globalIndexer;
}

/**
 * 重置全局引用索引器（仅用于测试）
 */
export function resetCitationIndexer(): void {
  globalIndexer = null;
}
