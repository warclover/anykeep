/**
 * Topic Clusterer Service
 *
 * 主题聚类服务
 * 基于书签的 embedding 向量进行聚类，发现同主题的书签关联
 *
 * 算法：K-Means 变体 + 层次聚类
 * - 使用余弦相似度作为距离度量
 * - 支持动态聚类数（根据数据量自适应）
 * - 生成 "topic" 类型的关联
 *
 * @version 1.0.0
 * @since 2025-12-14
 */

import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import type { DiscoveredLink, LinkEvidence } from "../types/link.types";

// ============================================================================
// Types
// ============================================================================

/**
 * 聚类输入数据点
 */
export interface ClusterDataPoint {
  /** 书签 ID */
  bookmarkId: number;
  /** 书签标题 */
  title: string;
  /** Embedding 向量 */
  embedding: number[];
  /** AI 生成的标签 */
  aiTags?: string[];
}

/**
 * 聚类结果
 */
export interface ClusterResult {
  /** 聚类 ID */
  clusterId: string;
  /** 聚类标签（自动生成） */
  label: string;
  /** 聚类中的书签 ID 列表 */
  bookmarkIds: number[];
  /** 聚类中心向量 */
  centroid: number[];
  /** 聚类内聚度（0-1，越高越紧密） */
  cohesion: number;
  /** 聚类代表性标签 */
  representativeTags: string[];
}

/**
 * 主题聚类配置
 */
export interface TopicClustererConfig {
  /** 最小聚类大小 */
  minClusterSize: number;
  /** 最大聚类数 */
  maxClusters: number;
  /** 聚类阈值（相似度） */
  clusterThreshold: number;
  /** 生成关联的最小相似度 */
  minLinkStrength: number;
  /** 每个聚类最大关联数 */
  maxLinksPerCluster: number;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: TopicClustererConfig = {
  minClusterSize: 3,
  maxClusters: 50,
  clusterThreshold: 0.65,
  minLinkStrength: 0.5,
  maxLinksPerCluster: 20,
};

// ============================================================================
// Service Interface
// ============================================================================

export interface ITopicClustererService {
  /**
   * 对用户的书签进行聚类
   */
  clusterBookmarks(userId: string): Promise<ClusterResult[]>;

  /**
   * 发现基于主题的关联
   */
  discoverTopicLinks(
    userId: string,
    bookmarkId: number,
  ): Promise<DiscoveredLink[]>;

  /**
   * 获取书签所属的聚类
   */
  getBookmarkCluster(
    userId: string,
    bookmarkId: number,
  ): Promise<ClusterResult | null>;

  /**
   * 重新计算用户的所有聚类
   */
  rebuildClusters(userId: string): Promise<ClusterResult[]>;
}

// ============================================================================
// Service Implementation
// ============================================================================

/**
 * 主题聚类服务
 */
export class TopicClustererService implements ITopicClustererService {
  private config: TopicClustererConfig;
  private clusterCache: Map<
    string,
    { clusters: ClusterResult[]; expiry: number }
  > = new Map();

  constructor(
    private supabase: SupabaseClient = createClient(),
    config?: Partial<TopicClustererConfig>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 对用户的书签进行聚类
   */
  async clusterBookmarks(userId: string): Promise<ClusterResult[]> {
    // Check cache (5 minutes)
    const cached = this.clusterCache.get(userId);
    if (cached && Date.now() < cached.expiry) {
      return cached.clusters;
    }

    logger.info({ userId }, "[TopicClusterer] Starting clustering");

    try {
      // 1. 获取用户的所有有 embedding 的书签
      const dataPoints = await this.getBookmarksWithEmbeddings(userId);

      if (dataPoints.length < this.config.minClusterSize) {
        logger.info(
          { userId, count: dataPoints.length },
          "[TopicClusterer] Not enough bookmarks for clustering",
        );
        return [];
      }

      // 2. 执行聚类算法
      const clusters = this.performClustering(dataPoints);

      // 3. 过滤小聚类
      const validClusters = clusters.filter(
        (c) => c.bookmarkIds.length >= this.config.minClusterSize,
      );

      // 4. 为每个聚类生成标签
      const labeledClusters = await this.labelClusters(
        validClusters,
        dataPoints,
      );

      // Cache results
      this.clusterCache.set(userId, {
        clusters: labeledClusters,
        expiry: Date.now() + 5 * 60 * 1000,
      });

      logger.info(
        { userId, clusterCount: labeledClusters.length },
        "[TopicClusterer] Clustering complete",
      );

      return labeledClusters;
    } catch (error) {
      logger.error(
        {
          userId,
          error: error instanceof Error ? error.message : String(error),
        },
        "[TopicClusterer] Clustering failed",
      );
      return [];
    }
  }

  /**
   * 发现基于主题的关联
   */
  async discoverTopicLinks(
    userId: string,
    bookmarkId: number,
  ): Promise<DiscoveredLink[]> {
    const cluster = await this.getBookmarkCluster(userId, bookmarkId);

    if (!cluster) {
      return [];
    }

    const links: DiscoveredLink[] = [];

    // 找到同一聚类中的其他书签
    const otherBookmarkIds = cluster.bookmarkIds.filter(
      (id) => id !== bookmarkId,
    );

    for (const targetId of otherBookmarkIds.slice(
      0,
      this.config.maxLinksPerCluster,
    )) {
      // 计算关联强度（基于聚类内聚度）
      const strength = Math.min(cluster.cohesion * 0.9, 1);

      if (strength >= this.config.minLinkStrength) {
        const evidence: LinkEvidence = {
          type: "topic",
          score: strength,
          details: {
            topicCluster: cluster.label,
          },
        };

        links.push({
          targetBookmarkId: targetId,
          linkType: "topic",
          strength,
          evidence,
          algorithm: "topic-clustering-v1",
        });
      }
    }

    return links;
  }

  /**
   * 获取书签所属的聚类
   */
  async getBookmarkCluster(
    userId: string,
    bookmarkId: number,
  ): Promise<ClusterResult | null> {
    const clusters = await this.clusterBookmarks(userId);

    for (const cluster of clusters) {
      if (cluster.bookmarkIds.includes(bookmarkId)) {
        return cluster;
      }
    }

    return null;
  }

  /**
   * 重新计算用户的所有聚类
   */
  async rebuildClusters(userId: string): Promise<ClusterResult[]> {
    // 清除缓存
    this.clusterCache.delete(userId);

    // 重新计算
    return this.clusterBookmarks(userId);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * 获取用户的所有有 embedding 的书签
   */
  private async getBookmarksWithEmbeddings(
    userId: string,
  ): Promise<ClusterDataPoint[]> {
    const { data, error } = await this.supabase
      .from("bookmarks")
      .select("id, title, embedding, ai_tags")
      .eq("user_id", userId)
      .not("embedding", "is", null)
      .limit(1000);

    if (error) {
      logger.error({ error }, "[TopicClusterer] Failed to get bookmarks");
      return [];
    }

    return (data || [])
      .filter((b) => b.embedding && Array.isArray(b.embedding))
      .map((b) => ({
        bookmarkId: b.id,
        title: b.title,
        embedding: b.embedding as number[],
        aiTags: b.ai_tags || [],
      }));
  }

  /**
   * 执行聚类算法（简化的层次聚类）
   */
  private performClustering(dataPoints: ClusterDataPoint[]): ClusterResult[] {
    if (dataPoints.length === 0) return [];

    // 初始化：每个点是一个聚类
    const clusters: {
      id: string;
      points: ClusterDataPoint[];
      centroid: number[];
    }[] = dataPoints.map((point, i) => ({
      id: `cluster-${i}`,
      points: [point],
      centroid: [...point.embedding],
    }));

    // 合并相似聚类直到达到阈值或最大聚类数
    while (clusters.length > this.config.maxClusters) {
      let bestSimilarity = -1;
      let bestI = -1;
      let bestJ = -1;

      // 找到最相似的两个聚类
      for (let i = 0; i < clusters.length; i++) {
        for (let j = i + 1; j < clusters.length; j++) {
          const similarity = this.cosineSimilarity(
            clusters[i].centroid,
            clusters[j].centroid,
          );

          if (similarity > bestSimilarity) {
            bestSimilarity = similarity;
            bestI = i;
            bestJ = j;
          }
        }
      }

      // 如果最相似的两个聚类也低于阈值，停止合并
      if (bestSimilarity < this.config.clusterThreshold) {
        break;
      }

      // 合并聚类
      const mergedPoints = [
        ...clusters[bestI].points,
        ...clusters[bestJ].points,
      ];
      const mergedCentroid = this.computeCentroid(
        mergedPoints.map((p) => p.embedding),
      );

      clusters[bestI] = {
        id: clusters[bestI].id,
        points: mergedPoints,
        centroid: mergedCentroid,
      };

      clusters.splice(bestJ, 1);
    }

    // 转换为 ClusterResult 格式
    return clusters.map((cluster) => {
      const cohesion = this.computeCohesion(cluster.points, cluster.centroid);

      return {
        clusterId: cluster.id,
        label: "", // Will be filled by labelClusters
        bookmarkIds: cluster.points.map((p) => p.bookmarkId),
        centroid: cluster.centroid,
        cohesion,
        representativeTags: [],
      };
    });
  }

  /**
   * 为聚类生成标签
   */
  private async labelClusters(
    clusters: ClusterResult[],
    dataPoints: ClusterDataPoint[],
  ): Promise<ClusterResult[]> {
    const pointMap = new Map<number, ClusterDataPoint>();
    for (const point of dataPoints) {
      pointMap.set(point.bookmarkId, point);
    }

    return clusters.map((cluster, index) => {
      // 收集聚类中所有书签的标签
      const allTags: string[] = [];
      for (const bookmarkId of cluster.bookmarkIds) {
        const point = pointMap.get(bookmarkId);
        if (point?.aiTags) {
          allTags.push(...point.aiTags);
        }
      }

      // 统计标签频率
      const tagCounts = new Map<string, number>();
      for (const tag of allTags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }

      // 选择最常见的标签
      const sortedTags = Array.from(tagCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag]) => tag);

      // 生成聚类标签
      const label =
        sortedTags.length > 0
          ? sortedTags.slice(0, 3).join(" / ")
          : `主题 ${index + 1}`;

      return {
        ...cluster,
        label,
        representativeTags: sortedTags,
      };
    });
  }

  /**
   * 计算余弦相似度
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * 计算聚类中心
   */
  private computeCentroid(vectors: number[][]): number[] {
    if (vectors.length === 0) return [];

    const dim = vectors[0].length;
    const centroid = new Array(dim).fill(0);

    for (const vector of vectors) {
      for (let i = 0; i < dim; i++) {
        centroid[i] += vector[i];
      }
    }

    for (let i = 0; i < dim; i++) {
      centroid[i] /= vectors.length;
    }

    return centroid;
  }

  /**
   * 计算聚类内聚度
   */
  private computeCohesion(
    points: ClusterDataPoint[],
    centroid: number[],
  ): number {
    if (points.length <= 1) return 1;

    let totalSimilarity = 0;
    for (const point of points) {
      totalSimilarity += this.cosineSimilarity(point.embedding, centroid);
    }

    return totalSimilarity / points.length;
  }
}

// ============================================================================
// Singleton
// ============================================================================

let topicClustererInstance: TopicClustererService | null = null;

/**
 * 获取 TopicClustererService 单例
 */
export function getTopicClustererService(): TopicClustererService {
  if (!topicClustererInstance) {
    topicClustererInstance = new TopicClustererService();
  }
  return topicClustererInstance;
}

/**
 * 重置单例（用于测试）
 */
export function resetTopicClustererService(): void {
  topicClustererInstance = null;
}
