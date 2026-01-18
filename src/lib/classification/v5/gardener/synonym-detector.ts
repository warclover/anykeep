/**
 * 智能分类 v5.0 - 同义词检测器
 *
 * 检测相似的文件夹名称，发现可能的同义词组
 */

import type { LoggerService } from '../shared/logger';
import type { EmbeddingService } from '../shared/embedding';
import type { SynonymGroup, GardenerConfig } from './types';

/**
 * 文件夹信息
 */
export interface FolderInfo {
  /** 文件夹 ID */
  folderId: string;
  /** 文件夹名称 */
  folderName: string;
  /** 书签数量 */
  bookmarkCount: number;
}

/**
 * 同义词检测器
 */
export class SynonymDetector {
  private logger: LoggerService;
  private embeddingService: EmbeddingService;
  private config: GardenerConfig;

  constructor(
    logger: LoggerService,
    embeddingService: EmbeddingService,
    config: GardenerConfig
  ) {
    this.logger = logger.child({ service: 'SynonymDetector' });
    this.embeddingService = embeddingService;
    this.config = config;
  }

  /**
   * 检测同义词组
   */
  async detect(folders: FolderInfo[]): Promise<SynonymGroup[]> {
    this.logger.info('开始检测同义词', {
      folderCount: folders.length,
    });

    if (folders.length < 2) {
      this.logger.debug('文件夹数量不足，跳过同义词检测');
      return [];
    }

    // 1. 生成文件夹名称的向量
    const folderEmbeddings = await this.generateEmbeddings(folders);

    // 2. 计算相似度矩阵
    const similarityMatrix = this.calculateSimilarityMatrix(folderEmbeddings);

    // 3. 识别同义词组
    const synonymGroups = this.identifySynonymGroups(
      folders,
      similarityMatrix
    );

    this.logger.info('同义词检测完成', {
      groupCount: synonymGroups.length,
    });

    return synonymGroups;
  }

  /**
   * 生成文件夹名称的向量
   */
  private async generateEmbeddings(
    folders: FolderInfo[]
  ): Promise<Map<string, number[]>> {
    this.logger.debug('生成文件夹名称向量', {
      count: folders.length,
    });

    const embeddings = new Map<string, number[]>();

    for (const folder of folders) {
      try {
        const embedding = await this.embeddingService.generateEmbedding(
          folder.folderName
        );
        embeddings.set(folder.folderId, embedding.embedding);
      } catch (error) {
        this.logger.error(
          '生成向量失败',
          error instanceof Error ? error : undefined,
          {
            folderId: folder.folderId,
            folderName: folder.folderName,
          }
        );
      }
    }

    return embeddings;
  }

  /**
   * 计算相似度矩阵
   */
  private calculateSimilarityMatrix(
    embeddings: Map<string, number[]>
  ): Map<string, Map<string, number>> {
    this.logger.debug('计算相似度矩阵');

    const matrix = new Map<string, Map<string, number>>();
    const folderIds = Array.from(embeddings.keys());

    for (let i = 0; i < folderIds.length; i++) {
      const folderId1 = folderIds[i];
      const embedding1 = embeddings.get(folderId1)!;

      if (!matrix.has(folderId1)) {
        matrix.set(folderId1, new Map());
      }

      for (let j = i + 1; j < folderIds.length; j++) {
        const folderId2 = folderIds[j];
        const embedding2 = embeddings.get(folderId2)!;

        const similarity = this.cosineSimilarity(embedding1, embedding2);

        matrix.get(folderId1)!.set(folderId2, similarity);

        if (!matrix.has(folderId2)) {
          matrix.set(folderId2, new Map());
        }
        matrix.get(folderId2)!.set(folderId1, similarity);
      }
    }

    return matrix;
  }

  /**
   * 余弦相似度计算
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('向量维度不匹配');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * 识别同义词组
   */
  private identifySynonymGroups(
    folders: FolderInfo[],
    similarityMatrix: Map<string, Map<string, number>>
  ): SynonymGroup[] {
    this.logger.debug('识别同义词组');

    const groups: SynonymGroup[] = [];
    const processed = new Set<string>();

    // 按书签数量排序，书签多的作为主文件夹
    const sortedFolders = [...folders].sort(
      (a, b) => b.bookmarkCount - a.bookmarkCount
    );

    for (const primaryFolder of sortedFolders) {
      if (processed.has(primaryFolder.folderId)) {
        continue;
      }

      const synonyms: Array<{
        folderId: string;
        folderName: string;
        similarity: number;
      }> = [];

      const similarities = similarityMatrix.get(primaryFolder.folderId);
      if (!similarities) continue;

      for (const [folderId, similarity] of similarities.entries()) {
        if (
          !processed.has(folderId) &&
          similarity >= this.config.synonymSimilarityThreshold
        ) {
          const folder = folders.find((f) => f.folderId === folderId);
          if (folder) {
            synonyms.push({
              folderId: folder.folderId,
              folderName: folder.folderName,
              similarity,
            });
            processed.add(folderId);
          }
        }
      }

      if (synonyms.length > 0) {
        // 按相似度排序
        synonyms.sort((a, b) => b.similarity - a.similarity);

        const avgSimilarity =
          synonyms.reduce((sum, s) => sum + s.similarity, 0) / synonyms.length;

        groups.push({
          primaryFolderId: primaryFolder.folderId,
          primaryFolderName: primaryFolder.folderName,
          synonyms,
          confidence: avgSimilarity,
          suggestedAction: this.determineSuggestedAction(
            primaryFolder,
            synonyms,
            avgSimilarity
          ),
        });

        processed.add(primaryFolder.folderId);
      }
    }

    return groups;
  }

  /**
   * 确定建议操作
   */
  private determineSuggestedAction(
    primaryFolder: FolderInfo,
    synonyms: Array<{ folderId: string; folderName: string; similarity: number }>,
    avgSimilarity: number
  ): 'merge' | 'rename' | 'keep_separate' {
    // 高相似度（>0.95）且同义词少 → 建议合并
    if (avgSimilarity > 0.95 && synonyms.length <= 2) {
      return 'merge';
    }

    // 中等相似度（0.85-0.95）→ 建议重命名以区分
    if (avgSimilarity >= 0.85 && avgSimilarity <= 0.95) {
      return 'rename';
    }

    // 其他情况 → 保持独立
    return 'keep_separate';
  }
}
