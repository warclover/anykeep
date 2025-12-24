/**
 * V3.0 回溯分类服务
 *
 * 当用户创建新文件夹后，自动检查待整理（Inbox）中的书签，
 * 将相似的书签移动到新文件夹，减少待整理堆积。
 *
 * 触发时机：
 * 1. 用户手动创建新文件夹
 * 2. 系统自动创建新文件夹
 * 3. 用户接受"创建新文件夹"的建议
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { V3_CONFIG } from "../../config/v3";
import { matchCategoriesByKeyword } from "../../constants/universal-categories";
import { logger } from "@/lib/logger";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 回溯分类结果
 */
export interface BackfillResult {
  /** 新文件夹 ID */
  folderId: number;
  /** 新文件夹名称 */
  folderName: string;
  /** 处理的书签数量 */
  processed: number;
  /** 成功移动的书签数量 */
  moved: number;
  /** 移动的书签 ID 列表 */
  movedBookmarkIds: number[];
  /** 跳过的书签数量 */
  skipped: number;
  /** 处理时间（毫秒） */
  durationMs: number;
}

/**
 * 待整理中的书签信息
 */
interface InboxBookmark {
  id: number;
  title: string;
  url: string;
  aiTags: string[];
  aiSummary: string | null;
  embedding: number[] | null;
}

/**
 * 回溯分类配置
 */
export interface BackfillConfig {
  /** 最大处理数量 */
  maxBookmarks: number;
  /** 向量相似度阈值 */
  similarityThreshold: number;
  /** 标签匹配权重 */
  tagMatchWeight: number;
  /** 名称匹配权重 */
  nameMatchWeight: number;
}

const DEFAULT_CONFIG: BackfillConfig = {
  maxBookmarks: 50, // 每次最多处理 50 条
  similarityThreshold: 0.7, // 向量相似度阈值
  tagMatchWeight: 0.4, // 标签匹配权重
  nameMatchWeight: 0.3, // 名称匹配权重
};

// ============================================================================
// 服务实现
// ============================================================================

/**
 * 回溯分类服务
 */
export class BackfillClassificationService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private supabase: SupabaseClient<any>;
  private config: BackfillConfig;

  constructor(
    supabase: SupabaseClient<Database>,
    config?: Partial<BackfillConfig>,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.supabase = supabase as SupabaseClient<any>;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 执行回溯分类
   *
   * @param userId 用户 ID
   * @param folderId 新创建的文件夹 ID
   * @param folderName 文件夹名称
   * @param folderEmbedding 文件夹的向量表示（可选，用于相似度计算）
   */
  async execute(
    userId: string,
    folderId: number,
    folderName: string,
    folderEmbedding?: number[],
  ): Promise<BackfillResult> {
    const startTime = Date.now();

    if (!V3_CONFIG.enableBackfillClassification) {
      logger.debug("BackfillClassification: Disabled, skipping");
      return {
        folderId,
        folderName,
        processed: 0,
        moved: 0,
        movedBookmarkIds: [],
        skipped: 0,
        durationMs: Date.now() - startTime,
      };
    }

    try {
      // 1. 获取待整理中的书签
      const inboxBookmarks = await this.getInboxBookmarks(userId);

      if (inboxBookmarks.length === 0) {
        logger.info(
          { folderId, folderName },
          "BackfillClassification: No inbox bookmarks to process",
        );
        return {
          folderId,
          folderName,
          processed: 0,
          moved: 0,
          movedBookmarkIds: [],
          skipped: 0,
          durationMs: Date.now() - startTime,
        };
      }

      // 2. 提取文件夹关键词
      const folderKeywords = this.extractKeywords(folderName);
      const matchResult = matchCategoriesByKeyword(folderName)[0];
      const matchedCategory = matchResult?.category;

      // 3. 计算每个书签的匹配分数
      const scoredBookmarks = inboxBookmarks.map((bookmark) => ({
        bookmark,
        score: this.calculateMatchScore(
          bookmark,
          folderName,
          folderKeywords,
          matchedCategory?.synonyms || [],
          folderEmbedding,
        ),
      }));

      // 4. 筛选高分书签
      const threshold = V3_CONFIG.mediumConfidenceThreshold / 100; // 使用中置信度作为阈值
      const candidateBookmarks = scoredBookmarks
        .filter((sb) => sb.score >= threshold)
        .sort((a, b) => b.score - a.score)
        .slice(0, this.config.maxBookmarks);

      if (candidateBookmarks.length === 0) {
        logger.info(
          { folderId, folderName, processed: inboxBookmarks.length },
          "BackfillClassification: No matching bookmarks found",
        );
        return {
          folderId,
          folderName,
          processed: inboxBookmarks.length,
          moved: 0,
          movedBookmarkIds: [],
          skipped: inboxBookmarks.length,
          durationMs: Date.now() - startTime,
        };
      }

      // 5. 批量移动书签
      const bookmarkIds = candidateBookmarks.map((cb) => cb.bookmark.id);
      await this.moveBookmarksToFolder(bookmarkIds, folderId);

      logger.info(
        {
          folderId,
          folderName,
          processed: inboxBookmarks.length,
          moved: bookmarkIds.length,
          bookmarkIds,
        },
        "BackfillClassification: Completed",
      );

      return {
        folderId,
        folderName,
        processed: inboxBookmarks.length,
        moved: bookmarkIds.length,
        movedBookmarkIds: bookmarkIds,
        skipped: inboxBookmarks.length - bookmarkIds.length,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      logger.error(
        {
          folderId,
          folderName,
          error: error instanceof Error ? error.message : String(error),
        },
        "BackfillClassification: Failed",
      );

      return {
        folderId,
        folderName,
        processed: 0,
        moved: 0,
        movedBookmarkIds: [],
        skipped: 0,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * 获取待整理中的书签
   */
  private async getInboxBookmarks(userId: string): Promise<InboxBookmark[]> {
    // 首先获取 inbox 文件夹 ID
    const { data: inboxFolder } = await this.supabase
      .from("folders")
      .select("id")
      .eq("user_id", userId)
      .eq("is_system", true)
      .eq("name", "待整理")
      .single();

    // 查询待整理书签（folder_id 为 null 或等于 inbox folder id）
    let query = this.supabase
      .from("bookmarks")
      .select("id, title, url, ai_tags, ai_summary, embedding")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(this.config.maxBookmarks * 2); // 获取更多以便筛选

    if (inboxFolder) {
      query = query.or(`folder_id.is.null,folder_id.eq.${inboxFolder.id}`);
    } else {
      query = query.is("folder_id", null);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`获取待整理书签失败: ${error.message}`);
    }

    return (data || []).map((row) => ({
      id: row.id as number,
      title: row.title as string,
      url: row.url as string,
      aiTags: (row.ai_tags || []) as string[],
      aiSummary: row.ai_summary as string | null,
      embedding: row.embedding as number[] | null,
    }));
  }

  /**
   * 计算书签与文件夹的匹配分数
   */
  private calculateMatchScore(
    bookmark: InboxBookmark,
    folderName: string,
    folderKeywords: string[],
    categorySynonyms: string[],
    folderEmbedding?: number[],
  ): number {
    let score = 0;
    let totalWeight = 0;

    // 1. 标签匹配
    const tagScore = this.calculateTagMatch(
      bookmark.aiTags,
      folderKeywords,
      categorySynonyms,
    );
    score += tagScore * this.config.tagMatchWeight;
    totalWeight += this.config.tagMatchWeight;

    // 2. 名称/标题匹配
    const nameScore = this.calculateNameMatch(
      bookmark.title,
      folderName,
      folderKeywords,
    );
    score += nameScore * this.config.nameMatchWeight;
    totalWeight += this.config.nameMatchWeight;

    // 3. 向量相似度（如果有）
    if (folderEmbedding && bookmark.embedding) {
      const vectorScore = this.cosineSimilarity(
        bookmark.embedding,
        folderEmbedding,
      );
      const vectorWeight =
        1 - this.config.tagMatchWeight - this.config.nameMatchWeight;
      score += vectorScore * vectorWeight;
      totalWeight += vectorWeight;
    }

    // 归一化
    return totalWeight > 0 ? score / totalWeight : 0;
  }

  /**
   * 计算标签匹配分数
   */
  private calculateTagMatch(
    bookmarkTags: string[],
    folderKeywords: string[],
    categorySynonyms: string[],
  ): number {
    if (bookmarkTags.length === 0) return 0;

    const allKeywords = [...folderKeywords, ...categorySynonyms].map((k) =>
      k.toLowerCase(),
    );

    let matches = 0;
    for (const tag of bookmarkTags) {
      const tagLower = tag.toLowerCase();
      if (
        allKeywords.some((k) => tagLower.includes(k) || k.includes(tagLower))
      ) {
        matches++;
      }
    }

    return matches / bookmarkTags.length;
  }

  /**
   * 计算名称匹配分数
   */
  private calculateNameMatch(
    bookmarkTitle: string,
    folderName: string,
    folderKeywords: string[],
  ): number {
    const titleLower = bookmarkTitle.toLowerCase();
    const folderLower = folderName.toLowerCase();

    // 直接包含检查
    if (titleLower.includes(folderLower) || folderLower.includes(titleLower)) {
      return 0.9;
    }

    // 关键词匹配
    let matches = 0;
    for (const keyword of folderKeywords) {
      if (titleLower.includes(keyword.toLowerCase())) {
        matches++;
      }
    }

    return folderKeywords.length > 0 ? matches / folderKeywords.length : 0;
  }

  /**
   * 计算余弦相似度
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * 提取关键词
   */
  private extractKeywords(text: string): string[] {
    // 简单的关键词提取：按空格和标点分割
    return text
      .toLowerCase()
      .split(/[\s,，、/\\]+/)
      .filter((w) => w.length >= 2);
  }

  /**
   * 批量移动书签到文件夹
   */
  private async moveBookmarksToFolder(
    bookmarkIds: number[],
    folderId: number,
  ): Promise<void> {
    const { error } = await this.supabase
      .from("bookmarks")
      .update({
        folder_id: folderId,
        updated_at: new Date().toISOString(),
      })
      .in("id", bookmarkIds);

    if (error) {
      throw new Error(`移动书签失败: ${error.message}`);
    }
  }
}

/**
 * 创建回溯分类服务的工厂函数
 */
export function createBackfillService(
  supabase: SupabaseClient<Database>,
  config?: Partial<BackfillConfig>,
): BackfillClassificationService {
  return new BackfillClassificationService(supabase, config);
}
