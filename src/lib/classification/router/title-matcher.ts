/**
 * Title Matcher Service
 * V4.2 标题相似度匹配服务
 *
 * @description 基于标题的快速路径匹配
 * - 标题关键词提取
 * - TF-IDF 相似度计算
 * - 文件夹标题关联
 * - 标题向量相似度（V4.2 多向量增强）
 *
 * @version 1.1.0
 * @since 2025-12-11
 */

import { createClient } from "@/lib/supabase/server";
import { FAST_PATH_THRESHOLDS } from "@/lib/trust-mode/config";
import { generateEmbedding } from "@/lib/utils/embedding-generator";
import { logger } from "@/lib/logger";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 标题匹配结果
 */
export interface TitleMatchResult {
  /** 是否找到匹配 */
  found: boolean;
  /** 建议的文件夹 ID */
  suggestedFolderId?: number;
  /** 匹配的文件夹名称 */
  folderName?: string;
  /** 置信度 (0-100) */
  confidence: number;
  /** 相似度分数 */
  similarityScore?: number;
  /** 匹配的书签标题 */
  matchedTitle?: string;
  /** 匹配详情 */
  reason: string;
  /** 匹配类型：keyword=关键词匹配，vector=向量匹配 */
  matchType?: "keyword" | "vector" | "hybrid";
  /** 向量相似度（如果使用向量匹配） */
  vectorSimilarity?: number;
}

/**
 * 文件夹标题缓存项
 */
interface FolderTitleCacheItem {
  folderId: number;
  folderName: string;
  titles: string[];
  keywords: Set<string>;
  bookmarkCount: number;
  lastUpdated: number;
}

/**
 * 标题关键词
 */
interface TitleKeywords {
  original: string;
  keywords: string[];
  bigrams: string[];
}

// ============================================================================
// 停用词表
// ============================================================================

/**
 * 中文停用词
 */
const CHINESE_STOPWORDS = new Set([
  "的",
  "了",
  "是",
  "在",
  "和",
  "与",
  "或",
  "等",
  "这",
  "那",
  "有",
  "为",
  "以",
  "及",
  "到",
  "从",
  "也",
  "就",
  "要",
  "会",
  "可以",
  "如何",
  "什么",
  "怎么",
  "怎样",
  "哪些",
  "哪个",
  "为什么",
  "一个",
  "一种",
  "一些",
  "一下",
  "一点",
  "几个",
]);

/**
 * 英文停用词
 */
const ENGLISH_STOPWORDS = new Set([
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
  "can",
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
  "how",
  "what",
  "which",
  "who",
  "when",
  "where",
  "why",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
]);

// ============================================================================
// 标题匹配器
// ============================================================================

/**
 * 标题向量匹配配置
 */
export interface TitleVectorMatchConfig {
  /** 是否启用向量匹配 */
  enabled: boolean;
  /** 最小向量相似度阈值 */
  minSimilarity: number;
  /** 向量匹配最大返回数 */
  limit: number;
  /** 向量匹配置信度加成 */
  vectorConfidenceBonus: number;
}

const DEFAULT_VECTOR_CONFIG: TitleVectorMatchConfig = {
  enabled: true,
  minSimilarity: 0.65,
  limit: 5,
  vectorConfidenceBonus: 10,
};

/**
 * 标题匹配器
 */
export class TitleMatcher {
  // 文件夹标题缓存
  private folderTitleCache: Map<string, FolderTitleCacheItem[]> = new Map();
  private cacheExpiry = 5 * 60 * 1000; // 5 分钟缓存
  private vectorConfig: TitleVectorMatchConfig;

  constructor(vectorConfig?: Partial<TitleVectorMatchConfig>) {
    this.vectorConfig = { ...DEFAULT_VECTOR_CONFIG, ...vectorConfig };
  }

  /**
   * 尝试标题匹配（优先向量匹配，回退关键词匹配）
   */
  async tryTitleMatch(
    userId: string,
    title: string,
  ): Promise<TitleMatchResult> {
    if (!title || title.trim().length < 3) {
      return {
        found: false,
        confidence: 0,
        reason: "Title too short",
      };
    }

    // 1. 先尝试向量匹配（V4.2 多向量增强）
    if (this.vectorConfig.enabled) {
      const vectorResult = await this.tryVectorMatch(userId, title);
      if (vectorResult.found) {
        return vectorResult;
      }
    }

    // 2. 回退到关键词匹配
    return this.tryKeywordMatch(userId, title);
  }

  /**
   * 尝试标题向量匹配
   * 基于 title_embedding 进行相似度搜索
   */
  async tryVectorMatch(
    userId: string,
    title: string,
  ): Promise<TitleMatchResult> {
    try {
      // 生成标题向量
      const titleEmbedding = await generateEmbedding(title);
      if (!titleEmbedding || titleEmbedding.length === 0) {
        return {
          found: false,
          confidence: 0,
          reason: "Failed to generate title embedding",
        };
      }

      // 调用数据库函数搜索相似标题
      const supabase = await createClient();
      const { data, error } = await supabase.rpc(
        "search_bookmarks_by_title_vector",
        {
          p_user_id: userId,
          // V4.2.5: 修复向量格式，pgvector 需要 [1,2,3,...] 格式
          p_query_embedding: `[${titleEmbedding.join(",")}]`,
          p_limit: this.vectorConfig.limit,
          p_min_similarity: this.vectorConfig.minSimilarity,
        },
      );

      if (error || !data || data.length === 0) {
        logger.debug(
          { userId, error: error?.message },
          "TitleMatcher: Vector match - no results",
        );
        return {
          found: false,
          confidence: 0,
          reason: "No vector matches found",
        };
      }

      // 聚合到文件夹级别
      const folderMatches = this.aggregateToFolders(data);
      if (folderMatches.length === 0) {
        return {
          found: false,
          confidence: 0,
          reason: "No folder matches from vector search",
        };
      }

      const bestMatch = folderMatches[0];

      // 计算置信度：向量相似度 * 100 + 向量加成
      const baseConfidence = Math.round(bestMatch.avgSimilarity * 100);
      const vectorBonus = this.vectorConfig.vectorConfidenceBonus;
      const countBonus = Math.min(10, bestMatch.matchCount * 2);
      const confidence = Math.min(
        95,
        baseConfidence + vectorBonus + countBonus,
      );

      logger.debug(
        {
          userId,
          folderId: bestMatch.folderId,
          similarity: bestMatch.avgSimilarity,
          confidence,
          matchCount: bestMatch.matchCount,
        },
        "TitleMatcher: Vector match found",
      );

      return {
        found: true,
        suggestedFolderId: bestMatch.folderId,
        folderName: bestMatch.folderName,
        confidence,
        similarityScore: baseConfidence,
        matchedTitle: bestMatch.bestTitle,
        reason: `Vector title match: ${(bestMatch.avgSimilarity * 100).toFixed(0)}% similarity`,
        matchType: "vector",
        vectorSimilarity: bestMatch.avgSimilarity,
      };
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        "TitleMatcher: Vector match failed",
      );
      return {
        found: false,
        confidence: 0,
        reason: "Vector match error",
      };
    }
  }

  /**
   * 聚合向量搜索结果到文件夹级别
   */
  private aggregateToFolders(
    results: Array<{
      bookmark_id: number;
      title: string;
      folder_id: number | null;
      folder_name: string | null;
      similarity: number;
    }>,
  ): Array<{
    folderId: number;
    folderName: string;
    avgSimilarity: number;
    maxSimilarity: number;
    matchCount: number;
    bestTitle: string;
  }> {
    const folderMap = new Map<
      number,
      {
        folderName: string;
        similarities: number[];
        titles: string[];
      }
    >();

    for (const result of results) {
      if (!result.folder_id) continue;

      const existing = folderMap.get(result.folder_id);
      if (existing) {
        existing.similarities.push(result.similarity);
        existing.titles.push(result.title);
      } else {
        folderMap.set(result.folder_id, {
          folderName: result.folder_name || "Unknown",
          similarities: [result.similarity],
          titles: [result.title],
        });
      }
    }

    const aggregated = Array.from(folderMap.entries()).map(
      ([folderId, data]) => {
        const avgSimilarity =
          data.similarities.reduce((a, b) => a + b, 0) /
          data.similarities.length;
        const maxSimilarity = Math.max(...data.similarities);
        const bestIdx = data.similarities.indexOf(maxSimilarity);

        return {
          folderId,
          folderName: data.folderName,
          avgSimilarity,
          maxSimilarity,
          matchCount: data.similarities.length,
          bestTitle: data.titles[bestIdx],
        };
      },
    );

    // 按平均相似度排序
    return aggregated.sort((a, b) => b.avgSimilarity - a.avgSimilarity);
  }

  /**
   * 尝试关键词匹配（原有逻辑）
   */
  async tryKeywordMatch(
    userId: string,
    title: string,
  ): Promise<TitleMatchResult> {
    // 提取标题关键词
    const inputKeywords = this.extractKeywords(title);

    if (inputKeywords.keywords.length === 0) {
      return {
        found: false,
        confidence: 0,
        reason: "No valid keywords extracted",
      };
    }

    // 获取用户文件夹的标题关联
    const folderTitles = await this.getUserFolderTitles(userId);

    if (folderTitles.length === 0) {
      return {
        found: false,
        confidence: 0,
        reason: "No folder titles available",
      };
    }

    // 计算每个文件夹的匹配分数
    const matches = folderTitles.map((folder) => {
      const matchResult = this.calculateTitleSimilarity(inputKeywords, folder);
      return {
        ...folder,
        ...matchResult,
      };
    });

    // 按相似度分数排序
    matches.sort((a, b) => b.similarityScore - a.similarityScore);

    const bestMatch = matches[0];

    // 检查是否达到阈值
    if (
      bestMatch.similarityScore >= FAST_PATH_THRESHOLDS.MIN_TITLE_MATCH_SCORE &&
      bestMatch.bookmarkCount >= FAST_PATH_THRESHOLDS.MIN_TITLE_BOOKMARK_COUNT
    ) {
      // 计算置信度（基于相似度分数和书签数量）
      const baseConfidence = Math.min(80, bestMatch.similarityScore);
      const countBonus = Math.min(15, Math.floor(bestMatch.bookmarkCount / 5));
      const confidence = Math.min(90, baseConfidence + countBonus);

      return {
        found: true,
        suggestedFolderId: bestMatch.folderId,
        folderName: bestMatch.folderName,
        confidence,
        similarityScore: bestMatch.similarityScore,
        matchedTitle: bestMatch.matchedTitle,
        reason: `Keyword title match: "${title}" → ${bestMatch.folderName} (score: ${bestMatch.similarityScore.toFixed(1)})`,
        matchType: "keyword",
      };
    }

    return {
      found: false,
      confidence: bestMatch.similarityScore,
      similarityScore: bestMatch.similarityScore,
      reason: "Keyword match score below threshold",
      matchType: "keyword",
    };
  }

  /**
   * 获取用户文件夹的标题关联
   */
  private async getUserFolderTitles(
    userId: string,
  ): Promise<FolderTitleCacheItem[]> {
    // 检查缓存
    const cacheKey = `folder_titles_${userId}`;
    const cached = this.folderTitleCache.get(cacheKey);
    const now = Date.now();

    if (
      cached &&
      cached.length > 0 &&
      cached[0].lastUpdated > now - this.cacheExpiry
    ) {
      return cached;
    }

    // 从数据库获取
    const supabase = await createClient();

    // 获取用户文件夹及其书签标题
    const { data: folders, error: folderError } = await supabase
      .from("folders")
      .select("id, name")
      .eq("user_id", userId)
      .eq("is_archived", false);

    if (folderError || !folders) {
      return [];
    }

    // 获取每个文件夹的书签标题
    const folderTitles: FolderTitleCacheItem[] = [];

    for (const folder of folders) {
      const { data: bookmarks } = await supabase
        .from("bookmarks")
        .select("title")
        .eq("folder_id", folder.id)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .limit(50);

      if (bookmarks && bookmarks.length > 0) {
        const titles = bookmarks
          .map((b) => b.title || "")
          .filter((t) => t.length > 0);

        // 提取所有标题的关键词
        const allKeywords = new Set<string>();
        for (const t of titles) {
          const kw = this.extractKeywords(t);
          kw.keywords.forEach((k) => allKeywords.add(k));
        }

        if (titles.length >= FAST_PATH_THRESHOLDS.MIN_TITLE_BOOKMARK_COUNT) {
          folderTitles.push({
            folderId: folder.id,
            folderName: folder.name,
            titles,
            keywords: allKeywords,
            bookmarkCount: titles.length,
            lastUpdated: now,
          });
        }
      }
    }

    // 更新缓存
    this.folderTitleCache.set(cacheKey, folderTitles);

    return folderTitles;
  }

  /**
   * 计算标题相似度
   */
  private calculateTitleSimilarity(
    input: TitleKeywords,
    folder: FolderTitleCacheItem,
  ): { similarityScore: number; matchedTitle: string } {
    let bestScore = 0;
    let matchedTitle = "";

    // 1. 关键词重叠度
    const inputKeywordSet = new Set(input.keywords);
    const overlapCount = input.keywords.filter((k) =>
      folder.keywords.has(k),
    ).length;
    const keywordOverlap =
      inputKeywordSet.size > 0
        ? (overlapCount / inputKeywordSet.size) * 100
        : 0;

    // 2. 与文件夹名称的相似度
    const folderNameKeywords = this.extractKeywords(folder.folderName);
    const folderNameOverlap =
      this.calculateJaccardSimilarity(
        input.keywords,
        folderNameKeywords.keywords,
      ) * 100;

    // 3. 与具体书签标题的相似度（取最高）
    for (const title of folder.titles) {
      const titleKeywords = this.extractKeywords(title);
      const similarity = this.calculateJaccardSimilarity(
        input.keywords,
        titleKeywords.keywords,
      );

      // Bigram 相似度增强
      const bigramSimilarity = this.calculateJaccardSimilarity(
        input.bigrams,
        titleKeywords.bigrams,
      );

      // 综合相似度 (关键词 70% + Bigram 30%)
      const combinedScore = (similarity * 0.7 + bigramSimilarity * 0.3) * 100;

      if (combinedScore > bestScore) {
        bestScore = combinedScore;
        matchedTitle = title;
      }
    }

    // 综合评分：关键词重叠 40% + 文件夹名匹配 20% + 最佳标题匹配 40%
    const similarityScore =
      keywordOverlap * 0.4 + folderNameOverlap * 0.2 + bestScore * 0.4;

    return {
      similarityScore: Math.round(similarityScore * 10) / 10,
      matchedTitle,
    };
  }

  /**
   * 提取标题关键词
   */
  private extractKeywords(title: string): TitleKeywords {
    const original = title.trim();

    // 分词
    const words: string[] = [];

    // 中文分词（简单按字符拆分，保留2-4字词组）
    const chineseWords = original.match(/[\u4e00-\u9fa5]+/g) || [];
    for (const cw of chineseWords) {
      // 单个中文词
      if (cw.length >= 2 && cw.length <= 4) {
        words.push(cw);
      }
      // 长词组拆分成双字词
      if (cw.length > 2) {
        for (let i = 0; i < cw.length - 1; i++) {
          words.push(cw.slice(i, i + 2));
        }
      }
    }

    // 英文分词
    const englishWords =
      original.toLowerCase().match(/[a-z][a-z0-9]*[a-z0-9]/gi) || [];
    words.push(...englishWords.map((w) => w.toLowerCase()));

    // 过滤停用词
    const filteredWords = words.filter(
      (w) =>
        !CHINESE_STOPWORDS.has(w) && !ENGLISH_STOPWORDS.has(w.toLowerCase()),
    );

    // 生成 bigrams
    const bigrams: string[] = [];
    for (let i = 0; i < filteredWords.length - 1; i++) {
      bigrams.push(`${filteredWords[i]}_${filteredWords[i + 1]}`);
    }

    return {
      original,
      keywords: [...new Set(filteredWords)],
      bigrams: [...new Set(bigrams)],
    };
  }

  /**
   * 计算 Jaccard 相似度
   */
  private calculateJaccardSimilarity(a: string[], b: string[]): number {
    if (a.length === 0 || b.length === 0) {
      return 0;
    }

    const setA = new Set(a);
    const setB = new Set(b);

    const intersection = new Set([...setA].filter((x) => setB.has(x)));
    const union = new Set([...setA, ...setB]);

    return intersection.size / union.size;
  }

  /**
   * 清除用户缓存
   */
  clearCache(userId: string): void {
    this.folderTitleCache.delete(`folder_titles_${userId}`);
  }

  /**
   * 清除所有缓存
   */
  clearAllCache(): void {
    this.folderTitleCache.clear();
  }
}

// ============================================================================
// 单例导出
// ============================================================================

export const titleMatcher = new TitleMatcher();
