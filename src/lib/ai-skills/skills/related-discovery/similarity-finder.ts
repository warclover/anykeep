/**
 * SimilarityFinder - 相似书签发现器
 *
 * 负责：
 * - 基于向量的相似度搜索
 * - 基于标签的相似度计算（fallback）
 * - 聚类分析
 * - 知识图谱生成
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import type {
  RelatedItem,
  Cluster,
  KnowledgeGraph,
  GraphNode,
  GraphEdge,
  DiscoveryStats,
  BookmarkForDiscovery,
  VectorSearchResult,
} from "./types";
import { logger } from "@/lib/logger";

/**
 * 相似度搜索选项
 */
interface SearchOptions {
  /** 返回数量限制 */
  limit: number;
  /** 最低相似度阈值 */
  minSimilarity: number;
  /** 排除的书签 ID */
  excludeIds?: number[];
}

/**
 * 相似书签发现器
 */
export class SimilarityFinder {
  /**
   * 基于向量搜索找到相关书签
   *
   * 注意：这需要数据库中有 match_bookmarks RPC 函数
   * 如果未配置，会使用 fallback 方法
   */
  async findByVector(
    embedding: number[],
    userId: string,
    options: SearchOptions,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: any,
  ): Promise<VectorSearchResult[]> {
    try {
      const { data, error } = await supabase.rpc("match_bookmarks", {
        query_embedding: embedding,
        match_threshold: options.minSimilarity,
        match_count: options.limit,
        p_user_id: userId,
      });

      if (error) {
        logger.warn(
          { error: error.message },
          "Vector search failed, falling back to tag-based search",
        );
        return [];
      }

      return (data || []).filter(
        (item: VectorSearchResult) => !options.excludeIds?.includes(item.id),
      );
    } catch {
      logger.debug("Vector search not available, using fallback");
      return [];
    }
  }

  /**
   * 基于标签的相似度计算（fallback 方法）
   */
  calculateTagSimilarity(sourceTags: string[], targetTags: string[]): number {
    if (!sourceTags.length || !targetTags.length) return 0;

    const sourceSet = new Set(sourceTags.map((t) => t.toLowerCase()));
    const targetSet = new Set(targetTags.map((t) => t.toLowerCase()));

    // Jaccard 相似度
    const intersection = [...sourceSet].filter((t) => targetSet.has(t)).length;
    const union = new Set([...sourceSet, ...targetSet]).size;

    return union > 0 ? intersection / union : 0;
  }

  /**
   * 基于标题的相似度计算
   */
  calculateTitleSimilarity(title1: string, title2: string): number {
    const words1 = this.extractKeywords(title1);
    const words2 = this.extractKeywords(title2);

    if (!words1.length || !words2.length) return 0;

    const set1 = new Set(words1);
    const set2 = new Set(words2);

    const intersection = [...set1].filter((w) => set2.has(w)).length;
    const union = new Set([...set1, ...set2]).size;

    return union > 0 ? intersection / union : 0;
  }

  /**
   * 提取关键词
   */
  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      "the",
      "a",
      "an",
      "is",
      "are",
      "was",
      "were",
      "be",
      "been",
      "being",
      "have",
      "has",
      "had",
      "do",
      "does",
      "did",
      "will",
      "would",
      "could",
      "should",
      "may",
      "might",
      "must",
      "shall",
      "can",
      "need",
      "dare",
      "ought",
      "used",
      "to",
      "of",
      "in",
      "for",
      "on",
      "with",
      "at",
      "by",
      "from",
      "as",
      "into",
      "through",
      "during",
      "before",
      "after",
      "above",
      "below",
      "between",
      "under",
      "again",
      "further",
      "then",
      "once",
      "and",
      "but",
      "or",
      "nor",
      "so",
      "yet",
      "both",
      "either",
      "neither",
      "not",
      "only",
      "own",
      "same",
      "than",
      "too",
      "very",
      "just",
      "的",
      "了",
      "是",
      "在",
      "我",
      "有",
      "和",
      "就",
      "不",
      "人",
      "都",
      "一",
      "一个",
      "上",
      "也",
      "很",
      "到",
      "说",
      "要",
      "去",
      "你",
      "会",
      "着",
      "没有",
      "看",
      "好",
      "自己",
      "这",
    ]);

    // 提取英文单词
    const englishWords =
      text
        .toLowerCase()
        .match(/[a-z]{2,}/g)
        ?.filter((w) => !stopWords.has(w)) || [];

    // 提取中文词汇（简单分词）
    const chineseWords =
      text.match(/[\u4e00-\u9fa5]{2,}/g)?.filter((w) => !stopWords.has(w)) ||
      [];

    return [...englishWords, ...chineseWords];
  }

  /**
   * 综合相似度计算
   */
  calculateCombinedSimilarity(
    source: BookmarkForDiscovery,
    target: BookmarkForDiscovery,
  ): number {
    const tagSim = this.calculateTagSimilarity(
      source.ai_tags || [],
      target.ai_tags || [],
    );

    const titleSim = this.calculateTitleSimilarity(source.title, target.title);

    // 加权平均：标签 60%，标题 40%
    return tagSim * 0.6 + titleSim * 0.4;
  }

  /**
   * 使用 fallback 方法查找相关书签
   */
  findByTags(
    source: BookmarkForDiscovery,
    candidates: BookmarkForDiscovery[],
    options: SearchOptions,
  ): RelatedItem[] {
    const results: RelatedItem[] = [];
    const sourceTags = source.ai_tags || [];

    for (const candidate of candidates) {
      // 排除自身和指定的 ID
      if (
        candidate.id === source.id ||
        options.excludeIds?.includes(candidate.id)
      ) {
        continue;
      }

      const similarity = this.calculateCombinedSimilarity(source, candidate);

      if (similarity >= options.minSimilarity) {
        const sharedTopics = this.findSharedTopics(
          sourceTags,
          candidate.ai_tags || [],
        );

        results.push({
          bookmarkId: candidate.id,
          title: candidate.title,
          url: candidate.url,
          platform: candidate.platform || "unknown",
          similarity,
          sharedTopics,
          aiTags: candidate.ai_tags,
          aiSummary: candidate.ai_summary,
        });
      }
    }

    // 按相似度排序并限制数量
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, options.limit);
  }

  /**
   * 查找共享主题
   */
  findSharedTopics(tags1: string[], tags2: string[]): string[] {
    const set1 = new Set(tags1.map((t) => t.toLowerCase()));
    return tags2.filter((t) => set1.has(t.toLowerCase()));
  }

  /**
   * 聚类相关书签
   */
  clusterItems(items: RelatedItem[]): Cluster[] {
    if (items.length === 0) return [];

    // 基于共享主题的简单聚类
    const topicGroups: Map<string, RelatedItem[]> = new Map();

    for (const item of items) {
      // 使用第一个共享主题作为聚类键
      const clusterKey = item.sharedTopics[0] || item.aiTags?.[0] || "其他";

      if (!topicGroups.has(clusterKey)) {
        topicGroups.set(clusterKey, []);
      }
      topicGroups.get(clusterKey)!.push(item);
    }

    // 转换为 Cluster 数组
    const clusters: Cluster[] = [];

    for (const [name, groupItems] of topicGroups) {
      // 更新每个 item 的 cluster 属性
      for (const item of groupItems) {
        item.cluster = name;
      }

      const avgSimilarity =
        groupItems.reduce((sum, item) => sum + item.similarity, 0) /
        groupItems.length;

      clusters.push({
        name,
        count: groupItems.length,
        avgSimilarity,
        bookmarkIds: groupItems.map((item) => item.bookmarkId),
      });
    }

    // 按数量排序
    return clusters.sort((a, b) => b.count - a.count);
  }

  /**
   * 生成知识图谱
   */
  generateKnowledgeGraph(
    sourceBookmark: BookmarkForDiscovery,
    relatedItems: RelatedItem[],
  ): KnowledgeGraph {
    const nodes: GraphNode[] = [
      {
        id: sourceBookmark.id,
        title: sourceBookmark.title,
        type: "source",
      },
    ];

    const edges: GraphEdge[] = [];

    for (const item of relatedItems) {
      nodes.push({
        id: item.bookmarkId,
        title: item.title,
        type: "related",
      });

      edges.push({
        source: sourceBookmark.id,
        target: item.bookmarkId,
        weight: item.similarity,
      });
    }

    // 添加相关书签之间的边（如果它们也相关）
    for (let i = 0; i < relatedItems.length; i++) {
      for (let j = i + 1; j < relatedItems.length; j++) {
        const item1 = relatedItems[i];
        const item2 = relatedItems[j];

        // 检查是否有共享主题
        const sharedTopics = this.findSharedTopics(
          item1.sharedTopics,
          item2.sharedTopics,
        );

        if (sharedTopics.length > 0) {
          // 估算相似度（基于共享主题数量）
          const estimatedSimilarity = Math.min(
            0.5 + sharedTopics.length * 0.1,
            0.9,
          );

          edges.push({
            source: item1.bookmarkId,
            target: item2.bookmarkId,
            weight: estimatedSimilarity,
          });
        }
      }
    }

    return { nodes, edges };
  }

  /**
   * 计算统计信息
   */
  calculateStats(relatedItems: RelatedItem[]): DiscoveryStats {
    const totalFound = relatedItems.length;

    const avgSimilarity =
      totalFound > 0
        ? relatedItems.reduce((sum, item) => sum + item.similarity, 0) /
          totalFound
        : 0;

    // 收集所有发现的主题
    const topicsSet = new Set<string>();
    for (const item of relatedItems) {
      for (const topic of item.sharedTopics) {
        topicsSet.add(topic);
      }
      if (item.aiTags) {
        for (const tag of item.aiTags) {
          topicsSet.add(tag);
        }
      }
    }

    // 平台分布
    const platformDistribution: Record<string, number> = {};
    for (const item of relatedItems) {
      platformDistribution[item.platform] =
        (platformDistribution[item.platform] || 0) + 1;
    }

    // 相似度分布
    const similarityDistribution = {
      high: relatedItems.filter((item) => item.similarity > 0.8).length,
      medium: relatedItems.filter(
        (item) => item.similarity >= 0.6 && item.similarity <= 0.8,
      ).length,
      low: relatedItems.filter((item) => item.similarity < 0.6).length,
    };

    return {
      totalFound,
      avgSimilarity,
      topicsDiscovered: Array.from(topicsSet).slice(0, 20),
      platformDistribution,
      similarityDistribution,
    };
  }

  /**
   * 生成相关性解释
   */
  generateExplanation(sourceTitle: string, targetItem: RelatedItem): string {
    const parts: string[] = [];

    // 相似度描述
    if (targetItem.similarity > 0.8) {
      parts.push("高度相关");
    } else if (targetItem.similarity > 0.6) {
      parts.push("中等相关");
    } else {
      parts.push("略有相关");
    }

    // 共享主题
    if (targetItem.sharedTopics.length > 0) {
      parts.push(`共同关注：${targetItem.sharedTopics.slice(0, 3).join("、")}`);
    }

    // 平台信息
    if (targetItem.platform && targetItem.platform !== "unknown") {
      parts.push(`来自 ${targetItem.platform}`);
    }

    return parts.join("，");
  }

  /**
   * 生成建议
   */
  generateSuggestions(stats: DiscoveryStats, clusters: Cluster[]): string[] {
    const suggestions: string[] = [];

    if (stats.totalFound === 0) {
      suggestions.push("未找到相关内容，尝试降低相似度阈值或添加更多书签");
      return suggestions;
    }

    // 基于统计的建议
    if (stats.avgSimilarity > 0.8) {
      suggestions.push("发现了大量高度相关的内容，建议进行系统学习");
    }

    if (stats.topicsDiscovered.length > 10) {
      suggestions.push(
        `涉及多个主题（${stats.topicsDiscovered.length} 个），可以按主题分批阅读`,
      );
    }

    // 基于聚类的建议
    if (clusters.length > 1) {
      const topCluster = clusters[0];
      suggestions.push(
        `最大的主题聚类是「${topCluster.name}」（${topCluster.count} 篇），建议优先阅读`,
      );
    }

    // 基于平台的建议
    const platforms = Object.keys(stats.platformDistribution);
    if (platforms.length > 3) {
      suggestions.push("内容来自多个平台，可以获得多元化的视角");
    }

    // 默认建议
    if (suggestions.length === 0) {
      suggestions.push("找到了一些相关内容，建议按兴趣优先级阅读");
    }

    return suggestions;
  }
}

/**
 * 默认相似度发现器实例
 */
export const similarityFinder = new SimilarityFinder();
