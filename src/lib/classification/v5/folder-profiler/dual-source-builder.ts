/**
 * 智能分类 v5.0 - 双源向量构建器
 *
 * 从内容数据和行为数据构建双源向量
 */

import type { LoggerService } from '../shared/logger';
import type { EmbeddingService } from '../shared/embedding';
import type { DualSourceVectors } from './types';

/**
 * 书签数据（用于构建内容向量）
 */
export interface BookmarkData {
  id: string;
  title: string;
  description?: string;
  summary?: string;
  tags?: string[];
}

/**
 * 行为数据（用于构建行为向量）
 */
export interface BehaviorData {
  bookmarkId: string;
  actionType: 'view' | 'edit' | 'move' | 'tag';
  timestamp: Date;
  weight: number; // 行为权重 (0-1)
}

/**
 * 双源向量构建器类
 */
export class DualSourceBuilder {
  private logger: LoggerService;
  private embeddingService: EmbeddingService;

  constructor(logger: LoggerService, embeddingService: EmbeddingService) {
    this.logger = logger.child({ service: 'DualSourceBuilder' });
    this.embeddingService = embeddingService;
  }

  /**
   * 构建双源向量
   */
  async build(
    folderId: string,
    bookmarks: BookmarkData[],
    behaviors: BehaviorData[]
  ): Promise<DualSourceVectors> {
    this.logger.debug('开始构建双源向量', {
      folderId,
      bookmarkCount: bookmarks.length,
      behaviorCount: behaviors.length,
    });

    // 1. 构建内容向量
    const contentEmbedding = await this.buildContentEmbedding(bookmarks);

    // 2. 构建行为向量
    const behaviorEmbedding = await this.buildBehaviorEmbedding(bookmarks, behaviors);

    return {
      contentEmbedding,
      behaviorEmbedding,
      contentSourceCount: bookmarks.length,
      behaviorSourceCount: behaviors.length,
    };
  }

  /**
   * 构建内容向量（基于书签内容）
   */
  private async buildContentEmbedding(bookmarks: BookmarkData[]): Promise<number[]> {
    if (bookmarks.length === 0) {
      // 空文件夹：返回零向量
      return new Array(1024).fill(0);
    }

    // 合并所有书签的文本内容
    const combinedText = bookmarks
      .map(b => {
        const parts = [
          b.title,
          b.description || '',
          b.summary || '',
          ...(b.tags || []),
        ];
        return parts.join(' ');
      })
      .join(' ')
      .slice(0, 8000); // OpenAI 限制

    // 生成 Embedding
    const result = await this.embeddingService.generateEmbedding(combinedText);
    return result.embedding;
  }

  /**
   * 构建行为向量（基于用户行为）
   */
  private async buildBehaviorEmbedding(
    bookmarks: BookmarkData[],
    behaviors: BehaviorData[]
  ): Promise<number[]> {
    if (behaviors.length === 0) {
      // 无行为数据：返回零向量
      return new Array(1024).fill(0);
    }

    // 按行为权重加权书签内容
    const weightedBookmarks = this.weightBookmarksByBehavior(bookmarks, behaviors);

    // 合并加权后的文本
    const combinedText = weightedBookmarks
      .map(wb => {
        const parts = [
          wb.bookmark.title,
          wb.bookmark.description || '',
          wb.bookmark.summary || '',
        ];
        // 根据权重重复文本（简单的加权方法）
        const repeatCount = Math.ceil(wb.weight * 3);
        return parts.join(' ').repeat(repeatCount);
      })
      .join(' ')
      .slice(0, 8000);

    // 生成 Embedding
    const result = await this.embeddingService.generateEmbedding(combinedText);
    return result.embedding;
  }

  /**
   * 按行为权重加权书签
   */
  private weightBookmarksByBehavior(
    bookmarks: BookmarkData[],
    behaviors: BehaviorData[]
  ): Array<{ bookmark: BookmarkData; weight: number }> {
    // 计算每个书签的行为权重
    const bookmarkWeights = new Map<string, number>();

    for (const behavior of behaviors) {
      const currentWeight = bookmarkWeights.get(behavior.bookmarkId) || 0;
      bookmarkWeights.set(
        behavior.bookmarkId,
        currentWeight + behavior.weight
      );
    }

    // 归一化权重
    const maxWeight = Math.max(...Array.from(bookmarkWeights.values()), 1);

    return bookmarks.map(bookmark => ({
      bookmark,
      weight: (bookmarkWeights.get(bookmark.id) || 0) / maxWeight,
    }));
  }
}
