/**
 * 主题聚类工具
 *
 * 用于将书签按主题自动聚类
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import type { TopicGroup, TopicBookmark, ClusteringConfig } from "./types";
import { QUICK_DIGEST_CONFIG } from "./types";

/**
 * 关键词权重
 */
interface KeywordWeight {
  word: string;
  weight: number;
  source: "title" | "tags" | "summary";
}

/**
 * 书签关键词映射
 */
interface BookmarkKeywords {
  bookmarkId: number;
  keywords: KeywordWeight[];
}

/**
 * 聚类结果
 */
interface ClusterResult {
  clusterId: number;
  bookmarkIds: number[];
  centroidKeywords: string[];
  score: number;
}

/**
 * 主题聚类器
 */
export class TopicClusterer {
  private config: ClusteringConfig;
  private stopWordsSet: Set<string>;

  constructor(config?: Partial<ClusteringConfig>) {
    this.config = {
      ...QUICK_DIGEST_CONFIG.CLUSTERING,
      ...config,
    };
    this.stopWordsSet = new Set([
      ...QUICK_DIGEST_CONFIG.STOP_WORDS_ZH,
      ...QUICK_DIGEST_CONFIG.STOP_WORDS_EN,
    ]);
  }

  /**
   * 对书签进行主题聚类
   */
  cluster(
    bookmarks: Array<{
      id: number;
      title: string;
      url: string;
      ai_summary?: string | null;
      ai_tags?: string[] | null;
      platform?: string | null;
      created_at: string;
    }>,
  ): TopicGroup[] {
    if (bookmarks.length === 0) {
      return [];
    }

    // 1. 提取关键词
    const bookmarkKeywords = this.extractAllKeywords(bookmarks);

    // 2. 构建词汇表
    const vocabulary = this.buildVocabulary(bookmarkKeywords);

    // 3. 计算相似度矩阵
    const similarityMatrix = this.buildSimilarityMatrix(
      bookmarkKeywords,
      vocabulary,
    );

    // 4. 执行层次聚类
    const clusters = this.hierarchicalClustering(
      bookmarkKeywords.map((bk) => bk.bookmarkId),
      similarityMatrix,
    );

    // 5. 命名聚类并转换为 TopicGroup
    return this.clustersToTopicGroups(clusters, bookmarks, bookmarkKeywords);
  }

  /**
   * 提取所有书签的关键词
   */
  private extractAllKeywords(
    bookmarks: Array<{
      id: number;
      title: string;
      ai_summary?: string | null;
      ai_tags?: string[] | null;
    }>,
  ): BookmarkKeywords[] {
    return bookmarks.map((bookmark) => ({
      bookmarkId: bookmark.id,
      keywords: this.extractKeywords(bookmark),
    }));
  }

  /**
   * 从单个书签提取关键词
   */
  private extractKeywords(bookmark: {
    title: string;
    ai_summary?: string | null;
    ai_tags?: string[] | null;
  }): KeywordWeight[] {
    const keywords: KeywordWeight[] = [];

    // 从标题提取（权重最高）
    const titleWords = this.tokenize(bookmark.title);
    titleWords.forEach((word) => {
      keywords.push({ word, weight: 3.0, source: "title" });
    });

    // 从标签提取（权重高）
    if (bookmark.ai_tags && bookmark.ai_tags.length > 0) {
      bookmark.ai_tags.forEach((tag) => {
        keywords.push({ word: tag.toLowerCase(), weight: 2.5, source: "tags" });
      });
    }

    // 从摘要提取（权重中等）
    if (bookmark.ai_summary) {
      const summaryWords = this.tokenize(bookmark.ai_summary);
      summaryWords.forEach((word) => {
        keywords.push({ word, weight: 1.0, source: "summary" });
      });
    }

    return this.deduplicateKeywords(keywords);
  }

  /**
   * 分词
   */
  private tokenize(text: string): string[] {
    // 中文分词：简单按照单字和连续词组切分
    // 英文分词：按空格和标点切分
    const words: string[] = [];

    // 提取英文单词
    const englishMatches = text.match(/[a-zA-Z][a-zA-Z0-9]+/g) || [];
    englishMatches.forEach((word) => {
      const lower = word.toLowerCase();
      if (lower.length >= 2 && !this.stopWordsSet.has(lower)) {
        words.push(lower);
      }
    });

    // 提取中文词组（2-4字）
    const chineseText = text.replace(/[a-zA-Z0-9\s]+/g, "");
    for (let len = 4; len >= 2; len--) {
      for (let i = 0; i <= chineseText.length - len; i++) {
        const word = chineseText.slice(i, i + len);
        if (!this.stopWordsSet.has(word) && this.isValidChineseWord(word)) {
          words.push(word);
        }
      }
    }

    return words;
  }

  /**
   * 检查是否为有效的中文词组
   */
  private isValidChineseWord(word: string): boolean {
    // 检查是否包含常见的无意义字符
    const invalidChars = /[，。、！？""''：；（）【】《》\s]/;
    return !invalidChars.test(word);
  }

  /**
   * 去重关键词（保留最高权重）
   */
  private deduplicateKeywords(keywords: KeywordWeight[]): KeywordWeight[] {
    const keywordMap = new Map<string, KeywordWeight>();

    keywords.forEach((kw) => {
      const existing = keywordMap.get(kw.word);
      if (!existing || existing.weight < kw.weight) {
        keywordMap.set(kw.word, kw);
      }
    });

    return Array.from(keywordMap.values());
  }

  /**
   * 构建词汇表
   */
  private buildVocabulary(allKeywords: BookmarkKeywords[]): string[] {
    const wordFreq = new Map<string, number>();

    allKeywords.forEach((bk) => {
      bk.keywords.forEach((kw) => {
        wordFreq.set(kw.word, (wordFreq.get(kw.word) || 0) + kw.weight);
      });
    });

    // 按频率排序，取前 N 个
    return Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 500) // 最多 500 个词
      .map(([word]) => word);
  }

  /**
   * 构建相似度矩阵
   */
  private buildSimilarityMatrix(
    bookmarkKeywords: BookmarkKeywords[],
    vocabulary: string[],
  ): number[][] {
    const n = bookmarkKeywords.length;
    const vocabIndex = new Map(vocabulary.map((word, idx) => [word, idx]));

    // 构建 TF-IDF 向量
    const vectors = bookmarkKeywords.map((bk) => {
      const vector = new Array(vocabulary.length).fill(0);
      bk.keywords.forEach((kw) => {
        const idx = vocabIndex.get(kw.word);
        if (idx !== undefined) {
          vector[idx] = kw.weight;
        }
      });
      return vector;
    });

    // 计算余弦相似度矩阵
    const similarity: number[][] = Array(n)
      .fill(null)
      .map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        if (i === j) {
          similarity[i][j] = 1.0;
        } else {
          const sim = this.cosineSimilarity(vectors[i], vectors[j]);
          similarity[i][j] = sim;
          similarity[j][i] = sim;
        }
      }
    }

    return similarity;
  }

  /**
   * 计算余弦相似度
   */
  private cosineSimilarity(v1: number[], v2: number[]): number {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < v1.length; i++) {
      dotProduct += v1[i] * v2[i];
      norm1 += v1[i] * v1[i];
      norm2 += v2[i] * v2[i];
    }

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * 层次聚类（凝聚法）
   */
  private hierarchicalClustering(
    bookmarkIds: number[],
    similarity: number[][],
  ): ClusterResult[] {
    // 初始化每个书签为单独的聚类
    const clusters: Set<number>[] = bookmarkIds.map((_, i) => new Set([i]));

    // 合并直到达到目标聚类数或无法继续合并
    while (clusters.length > this.config.maxClusters) {
      let maxSim = -1;
      let mergeI = -1;
      let mergeJ = -1;

      // 找到最相似的两个聚类
      for (let i = 0; i < clusters.length; i++) {
        for (let j = i + 1; j < clusters.length; j++) {
          const sim = this.clusterSimilarity(
            clusters[i],
            clusters[j],
            similarity,
          );
          if (sim > maxSim) {
            maxSim = sim;
            mergeI = i;
            mergeJ = j;
          }
        }
      }

      // 如果最大相似度低于阈值，停止合并
      if (maxSim < this.config.similarityThreshold) {
        break;
      }

      // 合并聚类
      clusters[mergeI] = new Set([...clusters[mergeI], ...clusters[mergeJ]]);
      clusters.splice(mergeJ, 1);
    }

    // 过滤小聚类，转换为结果格式
    return clusters
      .filter((cluster) => cluster.size >= this.config.minClusterSize)
      .map((cluster, idx) => ({
        clusterId: idx,
        bookmarkIds: Array.from(cluster).map((i) => bookmarkIds[i]),
        centroidKeywords: [],
        score: 1.0,
      }));
  }

  /**
   * 计算两个聚类之间的相似度（平均链接法）
   */
  private clusterSimilarity(
    c1: Set<number>,
    c2: Set<number>,
    similarity: number[][],
  ): number {
    let totalSim = 0;
    let count = 0;

    c1.forEach((i) => {
      c2.forEach((j) => {
        totalSim += similarity[i][j];
        count++;
      });
    });

    return count > 0 ? totalSim / count : 0;
  }

  /**
   * 将聚类转换为 TopicGroup
   */
  private clustersToTopicGroups(
    clusters: ClusterResult[],
    bookmarks: Array<{
      id: number;
      title: string;
      url: string;
      ai_summary?: string | null;
      platform?: string | null;
      created_at: string;
    }>,
    bookmarkKeywords: BookmarkKeywords[],
  ): TopicGroup[] {
    const bookmarkMap = new Map(bookmarks.map((b) => [b.id, b]));
    const keywordsMap = new Map(
      bookmarkKeywords.map((bk) => [bk.bookmarkId, bk.keywords]),
    );

    return clusters.map((cluster) => {
      // 收集聚类内所有关键词
      const allKeywords: KeywordWeight[] = [];
      cluster.bookmarkIds.forEach((id) => {
        const kws = keywordsMap.get(id) || [];
        allKeywords.push(...kws);
      });

      // 选择最重要的关键词作为主题名称和关键词列表
      const topKeywords = this.getTopKeywords(allKeywords, 5);
      const topicName = this.generateTopicName(topKeywords);

      // 转换书签
      const topicBookmarks: TopicBookmark[] = cluster.bookmarkIds
        .map((id) => {
          const b = bookmarkMap.get(id);
          if (!b) return null;
          const bookmark: TopicBookmark = {
            id: b.id,
            title: b.title,
            summary: b.ai_summary || "",
            url: b.url,
            createdAt: b.created_at,
          };
          if (b.platform) {
            bookmark.platform = b.platform;
          }
          return bookmark;
        })
        .filter((b): b is TopicBookmark => b !== null);

      return {
        name: topicName,
        count: topicBookmarks.length,
        keywords: topKeywords,
        bookmarks: topicBookmarks,
      };
    });
  }

  /**
   * 获取排名前 N 的关键词
   */
  private getTopKeywords(keywords: KeywordWeight[], n: number): string[] {
    const wordWeights = new Map<string, number>();

    keywords.forEach((kw) => {
      wordWeights.set(kw.word, (wordWeights.get(kw.word) || 0) + kw.weight);
    });

    return Array.from(wordWeights.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([word]) => word);
  }

  /**
   * 生成主题名称
   */
  private generateTopicName(keywords: string[]): string {
    if (keywords.length === 0) {
      return "其他";
    }

    // 取前 2-3 个关键词组合
    const nameKeywords = keywords.slice(0, 3);
    return nameKeywords.join(" / ");
  }
}

/**
 * 按平台分组
 */
export function groupByPlatform(
  bookmarks: Array<{
    id: number;
    title: string;
    url: string;
    ai_summary?: string | null;
    platform?: string | null;
    created_at: string;
  }>,
): TopicGroup[] {
  const platformGroups = new Map<string, TopicGroup>();

  bookmarks.forEach((bookmark) => {
    const platform = bookmark.platform || "other";
    const displayName = getPlatformDisplayName(platform);

    if (!platformGroups.has(platform)) {
      platformGroups.set(platform, {
        name: displayName,
        count: 0,
        keywords: [platform],
        bookmarks: [],
      });
    }

    const group = platformGroups.get(platform)!;
    group.count++;
    group.bookmarks.push({
      id: bookmark.id,
      title: bookmark.title,
      summary: bookmark.ai_summary || "",
      url: bookmark.url,
      platform: bookmark.platform || undefined,
      createdAt: bookmark.created_at,
    });
  });

  return Array.from(platformGroups.values()).sort((a, b) => b.count - a.count);
}

/**
 * 按日期分组
 */
export function groupByDate(
  bookmarks: Array<{
    id: number;
    title: string;
    url: string;
    ai_summary?: string | null;
    platform?: string | null;
    created_at: string;
  }>,
): TopicGroup[] {
  const dateGroups = new Map<string, TopicGroup>();

  bookmarks.forEach((bookmark) => {
    const date = new Date(bookmark.created_at);
    const dateKey = date.toISOString().split("T")[0]; // YYYY-MM-DD
    const displayName = formatDate(date);

    if (!dateGroups.has(dateKey)) {
      dateGroups.set(dateKey, {
        name: displayName,
        count: 0,
        keywords: [dateKey],
        bookmarks: [],
      });
    }

    const group = dateGroups.get(dateKey)!;
    group.count++;
    group.bookmarks.push({
      id: bookmark.id,
      title: bookmark.title,
      summary: bookmark.ai_summary || "",
      url: bookmark.url,
      platform: bookmark.platform || undefined,
      createdAt: bookmark.created_at,
    });
  });

  // 按日期倒序排列
  return Array.from(dateGroups.values()).sort((a, b) => {
    const dateA = a.keywords[0];
    const dateB = b.keywords[0];
    return dateB.localeCompare(dateA);
  });
}

/**
 * 不分组（单一组）
 */
export function groupByNone(
  bookmarks: Array<{
    id: number;
    title: string;
    url: string;
    ai_summary?: string | null;
    platform?: string | null;
    created_at: string;
  }>,
): TopicGroup[] {
  if (bookmarks.length === 0) {
    return [];
  }

  return [
    {
      name: "全部收藏",
      count: bookmarks.length,
      keywords: [],
      bookmarks: bookmarks.map((b) => ({
        id: b.id,
        title: b.title,
        summary: b.ai_summary || "",
        url: b.url,
        platform: b.platform || undefined,
        createdAt: b.created_at,
      })),
    },
  ];
}

/**
 * 获取平台显示名称
 */
function getPlatformDisplayName(platform: string): string {
  const names: Record<string, string> = {
    wechat: "微信公众号",
    weixin: "微信公众号",
    zhihu: "知乎",
    bilibili: "B站",
    xiaohongshu: "小红书",
    juejin: "掘金",
    github: "GitHub",
    twitter: "Twitter",
    youtube: "YouTube",
    medium: "Medium",
    chrome: "Chrome 书签",
    edge: "Edge 书签",
    firefox: "Firefox 书签",
    safari: "Safari 书签",
    other: "其他",
  };
  return names[platform.toLowerCase()] || platform;
}

/**
 * 格式化日期
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDate = new Date(year, month - 1, day);

  const diffDays = Math.floor(
    (today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "昨天";
  if (diffDays === 2) return "前天";
  if (diffDays < 7) return `${diffDays}天前`;

  return `${year}年${month}月${day}日`;
}

/**
 * 默认聚类器实例
 */
export const topicClusterer = new TopicClusterer();
