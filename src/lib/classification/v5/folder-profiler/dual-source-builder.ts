/**
 * 智能分类 v5.0 - 双源向量构建器
 *
 * 从内容数据和行为数据构建双源向量
 */

import type { LoggerService } from "../shared/logger";
import type { EmbeddingService } from "../shared/embedding";
import type { DualSourceVectors } from "./types";

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
  actionType: "view" | "edit" | "move" | "tag";
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
    this.logger = logger.child({ service: "DualSourceBuilder" });
    this.embeddingService = embeddingService;
  }

  /**
   * 构建双源向量
   */
  async build(
    folderId: string,
    folderName: string,
    folderDescription: string | undefined,
    bookmarks: BookmarkData[],
    behaviors: BehaviorData[],
  ): Promise<DualSourceVectors> {
    this.logger.debug("开始构建双源向量", {
      folderId,
      folderName,
      bookmarkCount: bookmarks.length,
      behaviorCount: behaviors.length,
    });

    // 1. 构建内容向量(基于生命周期阶段)
    const contentEmbedding = await this.buildContentEmbedding(
      folderName,
      folderDescription,
      bookmarks,
    );

    // 2. 构建行为向量
    const behaviorEmbedding = await this.buildBehaviorEmbedding(
      bookmarks,
      behaviors,
    );

    return {
      contentEmbedding,
      behaviorEmbedding,
      contentSourceCount: bookmarks.length,
      behaviorSourceCount: behaviors.length,
    };
  }

  /**
   * 构建内容向量（基于生命周期阶段）
   *
   * Stage A (冷启动): 0个书签 → 100%依赖名称
   * Stage B (成长期): 1-4个书签 → 70%名称 + 30%内容
   * Stage C (成熟期): ≥5个书签 → 滑动窗口平均(最近20个)
   */
  private async buildContentEmbedding(
    folderName: string,
    folderDescription: string | undefined,
    bookmarks: BookmarkData[],
  ): Promise<number[]> {
    const bookmarkCount = bookmarks.length;

    // Stage A: 冷启动阶段 (0个书签)
    if (bookmarkCount === 0) {
      return this.buildStageAEmbedding(folderName, folderDescription);
    }

    // Stage B: 成长期 (1-4个书签)
    if (bookmarkCount < 5) {
      return this.buildStageBEmbedding(
        folderName,
        folderDescription,
        bookmarks,
      );
    }

    // Stage C: 成熟期 (≥5个书签)
    return this.buildStageCEmbedding(bookmarks);
  }

  /**
   * Stage A: 冷启动阶段 - 100%依赖文件夹名称
   */
  private async buildStageAEmbedding(
    folderName: string,
    folderDescription: string | undefined,
  ): Promise<number[]> {
    this.logger.debug("使用 Stage A (冷启动) 策略", { folderName });

    // 合并文件夹名称和描述
    const text = [folderName, folderDescription || ""].join(" ").trim();

    if (!text) {
      // 如果连名称都没有,返回零向量
      return new Array(1024).fill(0);
    }

    const result = await this.embeddingService.generateEmbedding(text);
    return result.embedding;
  }

  /**
   * Stage B: 成长期 - 70%名称 + 30%内容
   */
  private async buildStageBEmbedding(
    folderName: string,
    folderDescription: string | undefined,
    bookmarks: BookmarkData[],
  ): Promise<number[]> {
    this.logger.debug("使用 Stage B (成长期) 策略", {
      folderName,
      bookmarkCount: bookmarks.length,
    });

    // 1. 生成名称向量
    const nameText = [folderName, folderDescription || ""].join(" ").trim();
    const nameResult = await this.embeddingService.generateEmbedding(nameText);
    const nameEmbedding = nameResult.embedding;

    // 2. 生成内容向量
    const contentText = bookmarks
      .map((b) => {
        const parts = [
          b.title,
          b.description || "",
          b.summary || "",
          ...(b.tags || []),
        ];
        return parts.join(" ");
      })
      .join(" ")
      .slice(0, 8000);

    const contentResult =
      await this.embeddingService.generateEmbedding(contentText);
    const contentEmbedding = contentResult.embedding;

    // 3. 加权融合: 70%名称 + 30%内容
    return this.weightedAverage([
      { embedding: nameEmbedding, weight: 0.7 },
      { embedding: contentEmbedding, weight: 0.3 },
    ]);
  }

  /**
   * Stage C: 成熟期 - 滑动窗口平均(最近20个书签)
   */
  private async buildStageCEmbedding(
    bookmarks: BookmarkData[],
  ): Promise<number[]> {
    this.logger.debug("使用 Stage C (成熟期) 策略", {
      bookmarkCount: bookmarks.length,
    });

    // 取最近20个书签(假设bookmarks已按时间排序)
    const recentBookmarks = bookmarks.slice(-20);

    // 合并最近书签的文本内容
    const combinedText = recentBookmarks
      .map((b) => {
        const parts = [
          b.title,
          b.description || "",
          b.summary || "",
          ...(b.tags || []),
        ];
        return parts.join(" ");
      })
      .join(" ")
      .slice(0, 8000);

    const result = await this.embeddingService.generateEmbedding(combinedText);
    return result.embedding;
  }

  /**
   * 构建行为向量（基于用户行为）
   */
  private async buildBehaviorEmbedding(
    bookmarks: BookmarkData[],
    behaviors: BehaviorData[],
  ): Promise<number[]> {
    if (behaviors.length === 0) {
      // 无行为数据：返回零向量
      return new Array(1024).fill(0);
    }

    // 按行为权重加权书签内容
    const weightedBookmarks = this.weightBookmarksByBehavior(
      bookmarks,
      behaviors,
    );

    // 合并加权后的文本
    const combinedText = weightedBookmarks
      .map((wb) => {
        const parts = [
          wb.bookmark.title,
          wb.bookmark.description || "",
          wb.bookmark.summary || "",
        ];
        // 根据权重重复文本（简单的加权方法）
        const repeatCount = Math.ceil(wb.weight * 3);
        return parts.join(" ").repeat(repeatCount);
      })
      .join(" ")
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
    behaviors: BehaviorData[],
  ): Array<{ bookmark: BookmarkData; weight: number }> {
    // 计算每个书签的行为权重
    const bookmarkWeights = new Map<string, number>();

    for (const behavior of behaviors) {
      const currentWeight = bookmarkWeights.get(behavior.bookmarkId) || 0;
      bookmarkWeights.set(behavior.bookmarkId, currentWeight + behavior.weight);
    }

    // 归一化权重
    const maxWeight = Math.max(...Array.from(bookmarkWeights.values()), 1);

    return bookmarks.map((bookmark) => ({
      bookmark,
      weight: (bookmarkWeights.get(bookmark.id) || 0) / maxWeight,
    }));
  }

  /**
   * 加权平均多个向量
   */
  private weightedAverage(
    vectors: Array<{ embedding: number[]; weight: number }>,
  ): number[] {
    const dimension = vectors[0].embedding.length;
    const result = new Array(dimension).fill(0);

    // 加权求和
    for (const { embedding, weight } of vectors) {
      for (let i = 0; i < dimension; i++) {
        result[i] += embedding[i] * weight;
      }
    }

    return result;
  }
}
