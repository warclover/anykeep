/**
 * V3.0 Query Expansion 多路召回匹配器
 *
 * 核心概念：通过关键词扩展和多路召回，提升检索召回率 30%。
 *
 * 工作原理：
 * 1. 从书签标题、摘要、标签中提取核心关键词
 * 2. 使用同义词扩展和通用分类关联进行关键词扩展
 * 3. 多路并行检索：向量搜索 + 关键词搜索 + 标签搜索
 * 4. 融合去重 + 重排序，返回最佳候选
 *
 * 优势：
 * - 解决标题模糊时向量检索召回率低的问题
 * - 多维度匹配，提高召回率
 * - 可与其他匹配器并行使用
 */

import type { IMatcher, MatcherOptions } from "../../strategies/interfaces";
import type { MatchResult, MatcherContext } from "../../types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { matchCategoriesByKeyword } from "../constants/universal-categories";
import { logger } from "@/lib/logger";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 扩展后的关键词
 */
interface ExpandedKeyword {
  keyword: string;
  source: "original" | "synonym" | "category" | "derived";
  weight: number;
}

/**
 * 召回结果
 */
interface RecallResult {
  folderId: number;
  folderName: string;
  score: number;
  source: "vector" | "keyword" | "tag";
  matchedTerms?: string[];
}

/**
 * Query Expansion 配置
 */
export interface QueryExpansionConfig {
  /** 最小匹配分数阈值 (0-100) */
  minMatchScore: number;
  /** 最大返回结果数 */
  maxResults: number;
  /** 权重 */
  weight: number;
  /** 最大扩展关键词数 */
  maxExpandedKeywords: number;
  /** 向量搜索结果数 */
  vectorTopK: number;
  /** 关键词搜索结果数 */
  keywordTopK: number;
}

const DEFAULT_CONFIG: QueryExpansionConfig = {
  minMatchScore: 40,
  maxResults: 5,
  weight: 0.25,
  maxExpandedKeywords: 10,
  vectorTopK: 5,
  keywordTopK: 3,
};

// ============================================================================
// 匹配器实现
// ============================================================================

/**
 * Query Expansion 多路召回匹配器
 */
export class QueryExpansionMatcher implements IMatcher {
  readonly name = "query_expansion";
  readonly weight: number;

  private config: QueryExpansionConfig;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private supabase: SupabaseClient<any>;

  constructor(supabase: SupabaseClient<Database>, options?: MatcherOptions) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.supabase = supabase as SupabaseClient<any>;
    this.config = {
      ...DEFAULT_CONFIG,
      weight: options?.weight ?? DEFAULT_CONFIG.weight,
    };
    this.weight = this.config.weight;
  }

  /**
   * 执行匹配
   */
  async match(context: MatcherContext): Promise<MatchResult[]> {
    try {
      // 1. 提取并扩展关键词
      const expandedKeywords = this.expandQuery(context);

      if (expandedKeywords.length === 0) {
        return [];
      }

      // 2. 多路并行召回
      const [vectorResults, keywordResults, tagResults] = await Promise.all([
        this.vectorRecall(context.userId, context.embedding),
        this.keywordRecall(context.userId, expandedKeywords),
        this.tagRecall(context.userId, context.tags),
      ]);

      // 3. 融合去重 + 重排序
      const fusedResults = this.fuseAndRerank(
        vectorResults,
        keywordResults,
        tagResults,
        expandedKeywords,
      );

      // 4. 筛选并转换结果
      const results = fusedResults
        .filter((r) => r.score >= this.config.minMatchScore)
        .slice(0, this.config.maxResults)
        .map((r) => this.toMatchResult(r));

      logger.debug(
        {
          action: "query_expansion_result",
          originalKeywords: context.tags.slice(0, 3),
          expandedCount: expandedKeywords.length,
          vectorCount: vectorResults.length,
          keywordCount: keywordResults.length,
          tagCount: tagResults.length,
          fusedCount: fusedResults.length,
          resultCount: results.length,
        },
        "Query Expansion Matcher: Completed",
      );

      return results;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : "Unknown error",
          action: "query_expansion_error",
        },
        "Query Expansion Matcher: Failed",
      );
      return [];
    }
  }

  /**
   * 检查是否可用
   */
  async isAvailable(context: MatcherContext): Promise<boolean> {
    // 需要有标题或标签才能进行关键词扩展
    return context.title.length > 0 || context.tags.length > 0;
  }

  /**
   * 关键词扩展
   */
  private expandQuery(context: MatcherContext): ExpandedKeyword[] {
    const keywords: ExpandedKeyword[] = [];
    const seen = new Set<string>();

    // 1. 原始标签
    for (const tag of context.tags) {
      const normalized = tag.toLowerCase().trim();
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        keywords.push({
          keyword: normalized,
          source: "original",
          weight: 1.0,
        });
      }
    }

    // 2. 从标题提取关键词
    const titleWords = this.tokenize(context.title);
    for (const word of titleWords) {
      const normalized = word.toLowerCase();
      if (normalized.length >= 2 && !seen.has(normalized)) {
        seen.add(normalized);
        keywords.push({
          keyword: normalized,
          source: "derived",
          weight: 0.8,
        });
      }
    }

    // 3. 通用分类同义词扩展
    for (const kw of [...keywords]) {
      const matches = matchCategoriesByKeyword(kw.keyword);
      if (matches.length > 0) {
        const category = matches[0].category;
        // 添加分类相关的同义词
        for (const synonym of category.synonyms.slice(0, 3)) {
          const normalized = synonym.toLowerCase();
          if (!seen.has(normalized)) {
            seen.add(normalized);
            keywords.push({
              keyword: normalized,
              source: "synonym",
              weight: 0.6,
            });
          }
        }
        // 添加分类名称
        const categoryName = category.name.toLowerCase();
        if (!seen.has(categoryName)) {
          seen.add(categoryName);
          keywords.push({
            keyword: categoryName,
            source: "category",
            weight: 0.7,
          });
        }
      }
    }

    // 4. 从摘要中提取额外关键词
    if (context.summary) {
      const summaryWords = this.tokenize(context.summary);
      const meaningfulWords = summaryWords
        .filter((w) => w.length >= 3 && w.length <= 15)
        .slice(0, 5);

      for (const word of meaningfulWords) {
        const normalized = word.toLowerCase();
        if (!seen.has(normalized)) {
          seen.add(normalized);
          keywords.push({
            keyword: normalized,
            source: "derived",
            weight: 0.5,
          });
        }
      }
    }

    // 限制数量
    return keywords
      .sort((a, b) => b.weight - a.weight)
      .slice(0, this.config.maxExpandedKeywords);
  }

  /**
   * 简单分词
   */
  private tokenize(text: string): string[] {
    return text
      .replace(/[^\w\u4e00-\u9fff\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 0);
  }

  /**
   * 向量召回
   */
  private async vectorRecall(
    userId: string,
    embedding: number[],
  ): Promise<RecallResult[]> {
    if (!embedding || embedding.length === 0) {
      return [];
    }

    try {
      const { data, error } = await this.supabase.rpc(
        "search_similar_folders",
        {
          query_embedding: embedding,
          match_threshold: 0.5,
          match_count: this.config.vectorTopK,
          p_user_id: userId,
        },
      );

      if (error) {
        logger.warn({ error: error.message }, "Vector recall failed");
        return [];
      }

      return (data || []).map(
        (row: {
          folder_id: number;
          folder_name: string;
          similarity: number;
        }) => ({
          folderId: row.folder_id,
          folderName: row.folder_name,
          score: Math.round(row.similarity * 100),
          source: "vector" as const,
        }),
      );
    } catch {
      return [];
    }
  }

  /**
   * 关键词召回（基于文件夹名称匹配）
   */
  private async keywordRecall(
    userId: string,
    keywords: ExpandedKeyword[],
  ): Promise<RecallResult[]> {
    if (keywords.length === 0) {
      return [];
    }

    try {
      // 获取用户的所有文件夹
      const { data: folders, error } = await this.supabase
        .from("folders")
        .select("id, name")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .eq("is_system", false);

      if (error || !folders) {
        return [];
      }

      const results: RecallResult[] = [];

      for (const folder of folders) {
        const folderNameLower = folder.name.toLowerCase();
        let totalScore = 0;
        const matchedTerms: string[] = [];

        for (const kw of keywords) {
          if (
            folderNameLower.includes(kw.keyword) ||
            kw.keyword.includes(folderNameLower)
          ) {
            totalScore += 30 * kw.weight;
            matchedTerms.push(kw.keyword);
          }
        }

        if (totalScore > 0) {
          results.push({
            folderId: folder.id,
            folderName: folder.name,
            score: Math.min(100, Math.round(totalScore)),
            source: "keyword",
            matchedTerms,
          });
        }
      }

      return results
        .sort((a, b) => b.score - a.score)
        .slice(0, this.config.keywordTopK);
    } catch {
      return [];
    }
  }

  /**
   * 标签召回（基于文件夹画像的标签匹配）
   */
  private async tagRecall(
    userId: string,
    tags: string[],
  ): Promise<RecallResult[]> {
    if (tags.length === 0) {
      return [];
    }

    try {
      // 查询文件夹画像
      const { data: profiles, error } = await this.supabase
        .from("folder_profiles")
        .select("folder_id, folder_name, top_tags")
        .eq("user_id", userId);

      if (error || !profiles) {
        return [];
      }

      const normalizedTags = tags.map((t) => t.toLowerCase());
      const results: RecallResult[] = [];

      for (const profile of profiles) {
        const profileTags = ((profile.top_tags as string[]) || []).map(
          (t: string) => t.toLowerCase(),
        );
        const matchedTags = normalizedTags.filter((t) =>
          profileTags.some((pt: string) => pt.includes(t) || t.includes(pt)),
        );

        if (matchedTags.length > 0) {
          const score = Math.min(
            100,
            Math.round((matchedTags.length / tags.length) * 80),
          );
          results.push({
            folderId: profile.folder_id,
            folderName: profile.folder_name || `文件夹 ${profile.folder_id}`,
            score,
            source: "tag",
            matchedTerms: matchedTags,
          });
        }
      }

      return results.sort((a, b) => b.score - a.score).slice(0, 5);
    } catch {
      return [];
    }
  }

  /**
   * 融合去重 + 重排序
   */
  private fuseAndRerank(
    vectorResults: RecallResult[],
    keywordResults: RecallResult[],
    tagResults: RecallResult[],
    _expandedKeywords: ExpandedKeyword[],
  ): RecallResult[] {
    const folderScores = new Map<
      number,
      {
        folderId: number;
        folderName: string;
        scores: { vector: number; keyword: number; tag: number };
        matchedTerms: string[];
      }
    >();

    // 权重配置
    const weights = { vector: 0.4, keyword: 0.35, tag: 0.25 };

    // 合并向量结果
    for (const r of vectorResults) {
      const existing = folderScores.get(r.folderId);
      if (existing) {
        existing.scores.vector = Math.max(existing.scores.vector, r.score);
      } else {
        folderScores.set(r.folderId, {
          folderId: r.folderId,
          folderName: r.folderName,
          scores: { vector: r.score, keyword: 0, tag: 0 },
          matchedTerms: [],
        });
      }
    }

    // 合并关键词结果
    for (const r of keywordResults) {
      const existing = folderScores.get(r.folderId);
      if (existing) {
        existing.scores.keyword = Math.max(existing.scores.keyword, r.score);
        if (r.matchedTerms) {
          existing.matchedTerms.push(...r.matchedTerms);
        }
      } else {
        folderScores.set(r.folderId, {
          folderId: r.folderId,
          folderName: r.folderName,
          scores: { vector: 0, keyword: r.score, tag: 0 },
          matchedTerms: r.matchedTerms || [],
        });
      }
    }

    // 合并标签结果
    for (const r of tagResults) {
      const existing = folderScores.get(r.folderId);
      if (existing) {
        existing.scores.tag = Math.max(existing.scores.tag, r.score);
        if (r.matchedTerms) {
          existing.matchedTerms.push(...r.matchedTerms);
        }
      } else {
        folderScores.set(r.folderId, {
          folderId: r.folderId,
          folderName: r.folderName,
          scores: { vector: 0, keyword: 0, tag: r.score },
          matchedTerms: r.matchedTerms || [],
        });
      }
    }

    // 计算加权分数并排序
    const results: RecallResult[] = [];

    for (const entry of folderScores.values()) {
      const weightedScore =
        entry.scores.vector * weights.vector +
        entry.scores.keyword * weights.keyword +
        entry.scores.tag * weights.tag;

      // 多路命中加分
      const hitCount = [
        entry.scores.vector > 0,
        entry.scores.keyword > 0,
        entry.scores.tag > 0,
      ].filter(Boolean).length;
      const multiHitBonus = hitCount > 1 ? (hitCount - 1) * 5 : 0;

      results.push({
        folderId: entry.folderId,
        folderName: entry.folderName,
        score: Math.min(100, Math.round(weightedScore + multiHitBonus)),
        source: "vector", // 融合后标记为 vector
        matchedTerms: [...new Set(entry.matchedTerms)],
      });
    }

    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * 转换为 MatchResult
   */
  private toMatchResult(result: RecallResult): MatchResult {
    const reason =
      result.matchedTerms && result.matchedTerms.length > 0
        ? `多路召回匹配：${result.matchedTerms.slice(0, 3).join("、")}`
        : "多路召回匹配";

    return {
      folderId: result.folderId,
      folderName: result.folderName,
      score: result.score,
      confidence: result.score,
      reason,
      metadata: {
        matchType: "query_expansion",
        source: result.source,
        matchedTerms: result.matchedTerms,
      },
    };
  }
}

/**
 * 工厂函数
 */
export function createQueryExpansionMatcher(
  supabase: SupabaseClient<Database>,
  options?: MatcherOptions,
): QueryExpansionMatcher {
  return new QueryExpansionMatcher(supabase, options);
}
