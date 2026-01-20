/**
 * 智能分类 v5.1 - 双源向量构建器
 *
 * 从内容数据和行为数据构建双源向量
 * v5.1 新增：离群值检测、时间衰减质心
 */

import type { LoggerService } from "../shared/logger";
import type { EmbeddingService } from "../shared/embedding";
import type { DualSourceVectors } from "./types";

/**
 * 双源向量构建常量
 */
export const DUAL_SOURCE_CONSTANTS = {
  /** 离群值检测阈值（百分比） */
  OUTLIER_THRESHOLD: 0.05,
  /** 离群值检测最小数量 */
  OUTLIER_MIN_COUNT: 1,
  /** 时间衰减 Lambda 系数（半衰期约 7 天） */
  TEMPORAL_DECAY_LAMBDA: 0.1,
  /** 离群值检测最小书签数 */
  OUTLIER_MIN_BOOKMARKS: 10,
} as const;

/**
 * 书签数据（用于构建内容向量）
 */
export interface BookmarkData {
  id: string;
  title: string;
  description?: string;
  summary?: string;
  tags?: string[];
  /** v5.1: 创建时间（用于时间衰减质心） */
  createdAt?: Date;
  /** v5.1: 向量嵌入（用于离群值检测） */
  embedding?: number[];
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
  /** v5.1: 是否启用去噪和时间权重 */
  private enableV51Features: boolean;

  constructor(
    logger: LoggerService,
    embeddingService: EmbeddingService,
    options?: { enableV51Features?: boolean },
  ) {
    this.logger = logger.child({ service: "DualSourceBuilder" });
    this.embeddingService = embeddingService;
    this.enableV51Features =
      options?.enableV51Features ??
      process.env.CLASSIFICATION_V5_1_ENABLED !== "false";
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
   * v5.1: 支持去噪和时间衰减质心
   */
  private async buildStageCEmbedding(
    bookmarks: BookmarkData[],
  ): Promise<number[]> {
    this.logger.debug("使用 Stage C (成熟期) 策略", {
      bookmarkCount: bookmarks.length,
      enableV51Features: this.enableV51Features,
    });

    // v5.1: 如果启用新特性，应用去噪和时间权重
    let processedBookmarks = bookmarks;
    if (this.enableV51Features && bookmarks.length >= 10) {
      // 1. 去噪：剔除离群值
      processedBookmarks = this.removeOutliers(bookmarks);
      this.logger.debug("离群值检测完成", {
        originalCount: bookmarks.length,
        cleanedCount: processedBookmarks.length,
        removedCount: bookmarks.length - processedBookmarks.length,
      });
    }

    // 取最近20个书签(假设bookmarks已按时间排序)
    const recentBookmarks = processedBookmarks.slice(-20);

    // v5.1: 如果启用时间权重，使用加权平均
    if (
      this.enableV51Features &&
      recentBookmarks.length > 0 &&
      recentBookmarks.some((b) => b.createdAt)
    ) {
      return this.buildTemporalWeightedEmbedding(recentBookmarks);
    }

    // v5.0 原有逻辑：合并最近书签的文本内容
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
   * v5.1: 剔除离群值（5% 偏离质心最远的书签）
   *
   * 算法：
   * 1. 计算所有书签与质心的距离
   * 2. 排序，取后 5% 作为离群值
   * 3. 从计算中排除离群值
   */
  private removeOutliers(bookmarks: BookmarkData[]): BookmarkData[] {
    // 需要向量数据才能计算离群值
    const bookmarksWithEmbedding = bookmarks.filter(
      (b) => b.embedding && b.embedding.length > 0,
    );

    if (
      bookmarksWithEmbedding.length <
      DUAL_SOURCE_CONSTANTS.OUTLIER_MIN_BOOKMARKS
    ) {
      // 书签太少，不进行去噪
      return bookmarks;
    }

    // 计算质心（所有书签向量的平均值）
    const firstEmbedding = bookmarksWithEmbedding[0].embedding;
    if (!firstEmbedding) {
      return bookmarks;
    }
    const dimension = firstEmbedding.length;
    const centroid = new Array(dimension).fill(0);

    for (const bookmark of bookmarksWithEmbedding) {
      const embedding = bookmark.embedding;
      if (!embedding) continue;
      for (let i = 0; i < dimension; i++) {
        centroid[i] += embedding[i];
      }
    }

    for (let i = 0; i < dimension; i++) {
      centroid[i] /= bookmarksWithEmbedding.length;
    }

    // 计算每个书签与质心的距离
    const distances = bookmarksWithEmbedding.map((b) => {
      const embedding = b.embedding;
      if (!embedding) {
        return { bookmark: b, distance: Infinity };
      }
      return {
        bookmark: b,
        distance: this.cosineDistance(embedding, centroid),
      };
    });

    // 排序，取后 OUTLIER_THRESHOLD 作为离群值
    const outlierCount = Math.max(
      DUAL_SOURCE_CONSTANTS.OUTLIER_MIN_COUNT,
      Math.floor(
        bookmarksWithEmbedding.length * DUAL_SOURCE_CONSTANTS.OUTLIER_THRESHOLD,
      ),
    );
    const outliers = distances
      .sort((a, b) => b.distance - a.distance)
      .slice(0, outlierCount)
      .map((d) => d.bookmark.id);

    // 从计算中排除离群值
    return bookmarks.filter((b) => !outliers.includes(b.id));
  }

  /**
   * v5.1: 构建时间衰减质心
   *
   * 使用时间权重 w_i = e^(-λ * t_i)，其中 λ = TEMPORAL_DECAY_LAMBDA（半衰期约 7 天）
   */
  private async buildTemporalWeightedEmbedding(
    bookmarks: BookmarkData[],
  ): Promise<number[]> {
    const now = Date.now();
    const lambda = DUAL_SOURCE_CONSTANTS.TEMPORAL_DECAY_LAMBDA;

    // 计算时间权重
    const weights: number[] = [];
    for (const bookmark of bookmarks) {
      if (bookmark.createdAt) {
        const daysAgo =
          (now - bookmark.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        weights.push(Math.exp(-lambda * daysAgo));
      } else {
        // 如果没有创建时间，使用默认权重 0.5
        weights.push(0.5);
      }
    }

    // 归一化权重
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const normalizedWeights = weights.map((w) => w / totalWeight);

    // 为每个书签生成向量（如果需要）
    const bookmarkVectors: number[][] = [];
    for (const bookmark of bookmarks) {
      if (bookmark.embedding && bookmark.embedding.length > 0) {
        bookmarkVectors.push(bookmark.embedding);
      } else {
        // 如果没有向量，生成一个
        const text = [
          bookmark.title,
          bookmark.description || "",
          bookmark.summary || "",
          ...(bookmark.tags || []),
        ].join(" ");
        const result = await this.embeddingService.generateEmbedding(text);
        bookmarkVectors.push(result.embedding);
      }
    }

    // 加权平均向量
    const dimension = bookmarkVectors[0].length;
    const weightedCentroid = new Array(dimension).fill(0);

    for (let i = 0; i < bookmarkVectors.length; i++) {
      const weight = normalizedWeights[i];
      for (let j = 0; j < dimension; j++) {
        weightedCentroid[j] += bookmarkVectors[i][j] * weight;
      }
    }

    return weightedCentroid;
  }

  /**
   * 计算余弦距离（1 - 余弦相似度）
   */
  private cosineDistance(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error("Vectors must have the same dimension");
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    return 1 - similarity; // 转换为距离
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
