/**
 * V3.0 Tag-to-Tag 精准匹配器
 *
 * 核心概念：基于 AI 生成的标签进行精确匹配，而非向量相似度。
 * 当书签的标签与文件夹中已有书签的标签高度相似时，直接推荐该文件夹。
 *
 * 工作原理：
 * 1. 获取新书签的 AI 标签
 * 2. 查找文件夹中具有相似标签的书签
 * 3. 使用 Jaccard 相似度计算标签重叠程度
 * 4. 返回匹配度最高的文件夹
 *
 * 优势：
 * - 可解释性极强（"与《XXX》有 3 个相同标签"）
 * - 精确匹配，避免向量的模糊性
 * - 用户可理解的推荐理由
 */

import type { IMatcher, MatcherOptions } from "../../strategies/interfaces";
import type { MatchResult, MatcherContext } from "../../types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { logger } from "@/lib/logger";
import { truncate } from "../../utils/text-utils";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 相似书签信息
 */
interface SimilarBookmark {
  id: number;
  title: string;
  tags: string[];
  folderId: number | null;
  folderName: string | null;
}

/**
 * 标签匹配结果
 */
interface TagMatchScore {
  folderId: number;
  folderName: string;
  score: number;
  matchedTags: string[];
  similarBookmarks: Array<{
    id: number;
    title: string;
    commonTags: string[];
  }>;
}

/**
 * Tag-to-Tag 匹配器配置
 */
export interface TagMatcherConfig {
  /** 最小匹配分数阈值 (0-100) */
  minMatchScore: number;
  /** 最大返回结果数 */
  maxResults: number;
  /** 权重 */
  weight: number;
  /** 最小共同标签数 */
  minCommonTags: number;
  /** 最多比较的书签数 */
  maxBookmarksToCompare: number;
}

const DEFAULT_CONFIG: TagMatcherConfig = {
  minMatchScore: 50,
  maxResults: 5,
  weight: 0.3, // 30% 权重
  minCommonTags: 2,
  maxBookmarksToCompare: 50,
};

// ============================================================================
// 匹配器实现
// ============================================================================

/**
 * Tag-to-Tag 精准匹配器
 */
export class TagMatcher implements IMatcher {
  readonly name = "tag";
  readonly weight: number;

  private config: TagMatcherConfig;
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
      // 1. 检查是否有足够的标签
      if (context.tags.length < this.config.minCommonTags) {
        return [];
      }

      // 2. 查找具有相似标签的书签
      const similarBookmarks = await this.findBookmarksWithSimilarTags(
        context.userId,
        context.tags,
      );

      if (similarBookmarks.length === 0) {
        return [];
      }

      // 3. 按文件夹聚合并计算分数
      const folderScores = this.aggregateByFolder(
        context.tags,
        similarBookmarks,
      );

      // 4. 筛选并排序结果
      const results = folderScores
        .filter((s) => s.score >= this.config.minMatchScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, this.config.maxResults)
        .map((s) => this.toMatchResult(s));

      logger.debug(
        {
          action: "tag_matcher_result",
          inputTags: context.tags.slice(0, 5),
          similarBookmarksCount: similarBookmarks.length,
          resultCount: results.length,
          topScore: results[0]?.score,
        },
        "Tag Matcher: Completed",
      );

      return results;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : "Unknown error",
          action: "tag_matcher_error",
        },
        "Tag Matcher: Failed",
      );
      return [];
    }
  }

  /**
   * 检查是否可用
   */
  async isAvailable(context: MatcherContext): Promise<boolean> {
    return context.tags.length >= this.config.minCommonTags;
  }

  /**
   * 查找具有相似标签的书签
   */
  private async findBookmarksWithSimilarTags(
    userId: string,
    tags: string[],
  ): Promise<SimilarBookmark[]> {
    // 将标签转为小写用于比较
    const normalizedTags = tags.map((t) => t.toLowerCase().trim());

    // 查询用户的书签（带文件夹信息，排除系统文件夹）
    const { data, error } = await this.supabase
      .from("bookmarks")
      .select(
        `
        id,
        title,
        ai_tags,
        folder_id,
        folders!inner(name, is_system)
      `,
      )
      .eq("user_id", userId)
      .is("deleted_at", null)
      .not("ai_tags", "is", null)
      .not("folder_id", "is", null)
      .eq("folders.is_system", false) // 排除系统文件夹
      .limit(this.config.maxBookmarksToCompare);

    if (error) {
      logger.warn(
        { error: error.message },
        "Failed to fetch bookmarks for tag matching",
      );
      return [];
    }

    // 筛选具有共同标签的书签
    const similarBookmarks: SimilarBookmark[] = [];

    for (const row of data || []) {
      const bookmarkTags = (row.ai_tags as string[] | null) || [];
      const normalizedBookmarkTags = bookmarkTags.map((t: string) =>
        t.toLowerCase().trim(),
      );

      // 计算共同标签
      const commonTags = normalizedTags.filter((t) =>
        normalizedBookmarkTags.includes(t),
      );

      // 只保留有足够共同标签的书签
      if (commonTags.length >= this.config.minCommonTags) {
        // Supabase !inner join 返回单个对象（非数组）
        const folder = row.folders as unknown as {
          name: string;
          is_system: boolean;
        } | null;
        similarBookmarks.push({
          id: row.id,
          title: row.title,
          tags: bookmarkTags,
          folderId: row.folder_id,
          folderName: folder?.name || null,
        });
      }
    }

    return similarBookmarks;
  }

  /**
   * 按文件夹聚合并计算分数
   */
  private aggregateByFolder(
    inputTags: string[],
    similarBookmarks: SimilarBookmark[],
  ): TagMatchScore[] {
    const folderMap = new Map<
      number,
      {
        folderName: string;
        allMatchedTags: Set<string>;
        bookmarks: Array<{
          id: number;
          title: string;
          commonTags: string[];
        }>;
      }
    >();

    const normalizedInputTags = inputTags.map((t) => t.toLowerCase().trim());

    for (const bookmark of similarBookmarks) {
      if (!bookmark.folderId) continue;

      // 计算该书签的共同标签
      const normalizedBookmarkTags = bookmark.tags.map((t) =>
        t.toLowerCase().trim(),
      );
      const commonTags = normalizedInputTags.filter((t) =>
        normalizedBookmarkTags.includes(t),
      );

      // 更新文件夹聚合
      let folderData = folderMap.get(bookmark.folderId);
      if (!folderData) {
        folderData = {
          folderName: bookmark.folderName || `文件夹 ${bookmark.folderId}`,
          allMatchedTags: new Set(),
          bookmarks: [],
        };
        folderMap.set(bookmark.folderId, folderData);
      }

      // 添加共同标签
      for (const tag of commonTags) {
        folderData.allMatchedTags.add(tag);
      }

      // 添加书签信息
      folderData.bookmarks.push({
        id: bookmark.id,
        title: bookmark.title,
        commonTags,
      });
    }

    // 计算每个文件夹的分数
    const results: TagMatchScore[] = [];

    for (const [folderId, data] of folderMap) {
      // Jaccard 相似度：共同标签数 / 总标签数（去重后）
      const matchedTagsArray = Array.from(data.allMatchedTags);
      const allTags = new Set<string>();

      // 收集所有涉及的标签
      for (const tag of normalizedInputTags) {
        allTags.add(tag);
      }
      for (const bookmark of data.bookmarks) {
        for (const tag of bookmark.commonTags) {
          allTags.add(tag);
        }
      }

      // 计算相似度
      const similarity =
        allTags.size > 0 ? matchedTagsArray.length / allTags.size : 0;

      // 考虑书签数量的加成（更多匹配书签 = 更高置信度）
      const bookmarkBonus = Math.min(0.2, data.bookmarks.length * 0.05);

      // 最终分数
      const score = Math.round((similarity + bookmarkBonus) * 100);

      results.push({
        folderId,
        folderName: data.folderName,
        score,
        matchedTags: matchedTagsArray,
        similarBookmarks: data.bookmarks.slice(0, 3), // 只保留前 3 个
      });
    }

    return results;
  }

  /**
   * 转换为 MatchResult
   */
  private toMatchResult(scored: TagMatchScore): MatchResult {
    // 构建可读的推荐理由
    const topBookmark = scored.similarBookmarks[0];
    let reason: string;

    if (topBookmark) {
      const commonTagsStr = topBookmark.commonTags.slice(0, 2).join("、");
      reason = `与「${truncate(topBookmark.title, 15)}」有相同标签：${commonTagsStr}`;
    } else {
      reason = `匹配标签：${scored.matchedTags.slice(0, 3).join("、")}`;
    }

    return {
      folderId: scored.folderId,
      folderName: scored.folderName,
      score: scored.score,
      confidence: scored.score,
      reason,
      metadata: {
        matchType: "tag_to_tag",
        matchedTags: scored.matchedTags,
        similarBookmarks: scored.similarBookmarks.map((b) => ({
          id: b.id,
          title: b.title,
          commonTagsCount: b.commonTags.length,
        })),
        totalSimilarBookmarks: scored.similarBookmarks.length,
      },
    };
  }

  // truncate() 已移至 ../../utils/text-utils.ts
}

/**
 * 工厂函数
 */
export function createTagMatcher(
  supabase: SupabaseClient<Database>,
  options?: MatcherOptions,
): TagMatcher {
  return new TagMatcher(supabase, options);
}
