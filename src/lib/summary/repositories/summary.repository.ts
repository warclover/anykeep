/**
 * Summary Repository Implementation
 *
 * 摘要仓库实现 - 书签摘要数据的存取
 *
 * 功能：
 * - 书签摘要 CRUD 操作
 * - 批量更新支持
 * - 查询需要生成摘要的书签
 *
 * @version 2.0.0
 * @since 2025-12-12
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { logger } from "@/lib/logger";
import type {
  ISummaryRepository,
  BookmarkSummaryData,
  BatchSummaryUpdate,
  BookmarkForSummary,
} from "./summary.repository.interface";

// ============================================================================
// Summary Repository
// ============================================================================

/**
 * 摘要仓库实现
 *
 * @example
 * ```typescript
 * const repository = new SummaryRepository(supabase);
 *
 * // 更新摘要
 * await repository.updateBookmarkSummary(123, 'Summary text', ['tag1', 'tag2']);
 *
 * // 获取摘要
 * const summary = await repository.getBookmarkSummary(123);
 *
 * // 获取需要生成摘要的书签
 * const bookmarks = await repository.getBookmarksNeedingSummary('user-uuid', 10);
 * ```
 */
export class SummaryRepository implements ISummaryRepository {
  private supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  /**
   * 更新书签摘要
   *
   * @param bookmarkId - 书签 ID
   * @param summary - 摘要文本
   * @param tags - 标签数组
   */
  async updateBookmarkSummary(
    bookmarkId: number,
    summary: string,
    tags: string[],
  ): Promise<void> {
    const { error } = await this.supabase
      .from("bookmarks")
      .update({
        ai_summary: summary,
        ai_tags: tags,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookmarkId);

    if (error) {
      logger.error(
        { bookmarkId, error: error.message },
        "SummaryRepository: Failed to update bookmark summary",
      );
      throw new Error(`Failed to update summary: ${error.message}`);
    }

    logger.debug(
      { bookmarkId, summaryLength: summary.length, tagsCount: tags.length },
      "SummaryRepository: Bookmark summary updated",
    );
  }

  /**
   * 获取书签摘要
   *
   * @param bookmarkId - 书签 ID
   * @returns 摘要数据或 null
   */
  async getBookmarkSummary(
    bookmarkId: number,
  ): Promise<BookmarkSummaryData | null> {
    const { data, error } = await this.supabase
      .from("bookmarks")
      .select("ai_summary, ai_tags, created_at, updated_at")
      .eq("id", bookmarkId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // Not found
        return null;
      }
      logger.error(
        { bookmarkId, error: error.message },
        "SummaryRepository: Failed to get bookmark summary",
      );
      throw new Error(`Failed to get summary: ${error.message}`);
    }

    return {
      summary: data.ai_summary,
      tags: data.ai_tags || [],
      createdAt: data.created_at ?? new Date().toISOString(),
      updatedAt: data.updated_at ?? new Date().toISOString(),
    };
  }

  /**
   * 批量更新摘要
   *
   * @param updates - 更新数据数组
   */
  async batchUpdateSummaries(updates: BatchSummaryUpdate[]): Promise<void> {
    if (updates.length === 0) {
      return;
    }

    // Supabase 不支持真正的批量更新，使用 Promise.all
    const results = await Promise.allSettled(
      updates.map((update) =>
        this.updateBookmarkSummary(
          update.bookmarkId,
          update.summary,
          update.tags,
        ),
      ),
    );

    // 统计结果
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    if (failed > 0) {
      logger.warn(
        { total: updates.length, succeeded, failed },
        "SummaryRepository: Batch update partially failed",
      );
    } else {
      logger.debug(
        { count: succeeded },
        "SummaryRepository: Batch update completed",
      );
    }
  }

  /**
   * 获取需要生成摘要的书签
   *
   * @param userId - 用户 ID
   * @param limit - 限制数量（默认 50）
   * @returns 书签数据列表
   */
  async getBookmarksNeedingSummary(
    userId: string,
    limit: number = 50,
  ): Promise<BookmarkForSummary[]> {
    const { data, error } = await this.supabase
      .from("bookmarks")
      .select("id, user_id, title, url, description")
      .eq("user_id", userId)
      .is("ai_summary", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      logger.error(
        { userId, error: error.message },
        "SummaryRepository: Failed to get bookmarks needing summary",
      );
      throw new Error(`Failed to get bookmarks: ${error.message}`);
    }

    return (data || []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      title: row.title || "",
      url: row.url || "",
      description: row.description || undefined,
    }));
  }

  /**
   * 检查书签是否存在
   *
   * @param bookmarkId - 书签 ID
   * @param userId - 用户 ID
   * @returns 是否存在
   */
  async bookmarkExists(bookmarkId: number, userId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("bookmarks")
      .select("id")
      .eq("id", bookmarkId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      logger.error(
        { bookmarkId, userId, error: error.message },
        "SummaryRepository: Failed to check bookmark exists",
      );
      return false;
    }

    return data !== null;
  }

  /**
   * 获取书签详情（用于摘要生成）
   *
   * @param bookmarkId - 书签 ID
   * @param userId - 用户 ID
   * @returns 书签详情或 null
   */
  async getBookmarkForSummary(
    bookmarkId: number,
    userId: string,
  ): Promise<BookmarkForSummary | null> {
    const { data, error } = await this.supabase
      .from("bookmarks")
      .select("id, user_id, title, url, description")
      .eq("id", bookmarkId)
      .eq("user_id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      logger.error(
        { bookmarkId, userId, error: error.message },
        "SummaryRepository: Failed to get bookmark for summary",
      );
      throw new Error(`Failed to get bookmark: ${error.message}`);
    }

    // V4.2.7: 添加 null 检查
    if (!data) {
      return null;
    }

    return {
      id: data.id,
      userId: data.user_id,
      title: data.title || "",
      url: data.url || "",
      description: data.description || undefined,
    };
  }

  /**
   * 统计用户摘要情况
   *
   * @param userId - 用户 ID
   * @returns 统计数据
   */
  async getSummaryStats(userId: string): Promise<{
    total: number;
    withSummary: number;
    withoutSummary: number;
  }> {
    // 获取总数
    const { count: total, error: totalError } = await this.supabase
      .from("bookmarks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if (totalError) {
      logger.error(
        { userId, error: totalError.message },
        "SummaryRepository: Failed to get total count",
      );
      throw new Error(`Failed to get stats: ${totalError.message}`);
    }

    // 获取有摘要的数量
    const { count: withSummary, error: summaryError } = await this.supabase
      .from("bookmarks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("ai_summary", "is", null);

    if (summaryError) {
      logger.error(
        { userId, error: summaryError.message },
        "SummaryRepository: Failed to get summary count",
      );
      throw new Error(`Failed to get stats: ${summaryError.message}`);
    }

    return {
      total: total || 0,
      withSummary: withSummary || 0,
      withoutSummary: (total || 0) - (withSummary || 0),
    };
  }

  /**
   * 清除书签摘要
   *
   * @param bookmarkId - 书签 ID
   */
  async clearSummary(bookmarkId: number): Promise<void> {
    const { error } = await this.supabase
      .from("bookmarks")
      .update({
        ai_summary: null,
        ai_tags: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookmarkId);

    if (error) {
      logger.error(
        { bookmarkId, error: error.message },
        "SummaryRepository: Failed to clear summary",
      );
      throw new Error(`Failed to clear summary: ${error.message}`);
    }

    logger.debug({ bookmarkId }, "SummaryRepository: Summary cleared");
  }

  /**
   * 批量清除摘要
   *
   * @param bookmarkIds - 书签 ID 数组
   */
  async batchClearSummaries(bookmarkIds: number[]): Promise<void> {
    if (bookmarkIds.length === 0) {
      return;
    }

    const { error } = await this.supabase
      .from("bookmarks")
      .update({
        ai_summary: null,
        ai_tags: null,
        updated_at: new Date().toISOString(),
      })
      .in("id", bookmarkIds);

    if (error) {
      logger.error(
        { count: bookmarkIds.length, error: error.message },
        "SummaryRepository: Failed to batch clear summaries",
      );
      throw new Error(`Failed to batch clear summaries: ${error.message}`);
    }

    logger.debug(
      { count: bookmarkIds.length },
      "SummaryRepository: Summaries cleared",
    );
  }
}

// ============================================================================
// Factory Function
// ============================================================================

let repositoryInstance: SummaryRepository | null = null;
let repositorySupabase: SupabaseClient<Database> | null = null;

/**
 * 获取 SummaryRepository 实例
 */
export function getSummaryRepository(
  supabase: SupabaseClient<Database>,
): SummaryRepository {
  if (!repositoryInstance || repositorySupabase !== supabase) {
    repositoryInstance = new SummaryRepository(supabase);
    repositorySupabase = supabase;
  }
  return repositoryInstance;
}

/**
 * 重置 SummaryRepository 实例（主要用于测试）
 */
export function resetSummaryRepository(): void {
  repositoryInstance = null;
  repositorySupabase = null;
}
