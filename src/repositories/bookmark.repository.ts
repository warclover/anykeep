/**
 * Bookmark Repository
 *
 * 书签数据访问层，封装所有书签相关的数据库操作
 *
 * @module repositories
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { ToggleBookmarkStarredParams } from "@/types/rpc-manual";
import type { PaginatedResult } from "./base.repository";
import { BaseRepository } from "./base.repository";
import { z } from "zod";

// Schema definitions moved/adapted from classification module
export const SimilarBookmarkRowSchema = z.object({
  bookmark_id: z.number(),
  bookmark_title: z.string(),
  folder_id: z.number().nullable(),
  folder_name: z.string().nullable(),
  similarity: z.number(),
});

export interface SimilarBookmarkWithFolder {
  bookmarkId: number;
  bookmarkTitle: string;
  folderId: number | null;
  folderName: string | null;
  similarity: number;
}

export interface BookmarkForClassification {
  id: number;
  title: string;
  url: string;
  aiSummary: string | null;
  aiTags: string[];
  embedding: number[] | null;
  folderId: number | null;
  createdAt: Date;
}

/**
 * 分类查询返回的部分字段类型
 * 用于避免 `as unknown as BookmarkRow` 断言
 */
interface BookmarkClassificationRow {
  id: number;
  title: string;
  url: string;
  ai_summary: string | null;
  ai_tags: string[] | null;
  embedding: string | number[] | null;
  folder_id: number | null;
  created_at: string | null;
}

// Type aliases for convenience
type BookmarkRow = Database["public"]["Tables"]["bookmarks"]["Row"];
type BookmarkInsert = Database["public"]["Tables"]["bookmarks"]["Insert"];
type BookmarkUpdate = Database["public"]["Tables"]["bookmarks"]["Update"];

/**
 * 书签查询参数
 */
export interface BookmarkQueryParams {
  folderId?: number;
  /** V2.0: 批量文件夹查询 */
  folderIds?: number[];
  platform?: string;
  isRead?: boolean;
  isStarred?: boolean;
  isInTrash?: boolean;
  search?: string;
  tags?: string[];
  limit: number;
  offset: number;
  orderBy: "created_at" | "updated_at" | "title" | "starred_at";
  orderDir: "asc" | "desc";
}

/**
 * 书签列表查询返回的字段
 */
const BOOKMARK_LIST_FIELDS = `
  id,
  url,
  title,
  description,
  platform,
  cover_url,
  folder_id,
  ai_summary,
  ai_tags,
  user_tags,
  is_read,
  is_starred,
  is_in_trash,
  status,
  created_at,
  updated_at,
  starred_at
` as const;

/**
 * 书签详情查询返回的字段
 */
const BOOKMARK_DETAIL_FIELDS = `
  *,
  folders!bookmarks_folder_id_fkey (
    id,
    name
  )
` as const;

/**
 * Bookmark Repository
 *
 * 提供书签的 CRUD 和高级查询功能
 */
export class BookmarkRepository extends BaseRepository<
  BookmarkRow,
  BookmarkInsert,
  BookmarkUpdate
> {
  protected readonly tableName = "bookmarks" as const;

  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, userId, "BookmarkRepository");
  }

  /**
   * 根据 URL 查找书签
   */
  async findByUrl(url: string): Promise<BookmarkRow | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select()
      .eq("user_id", this.userId)
      .eq("url", url)
      .is("deleted_at", null)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      this.logger.error({ error, url }, "Failed to find by URL");
      throw error;
    }

    return data;
  }

  /**
   * 查询书签列表（带分页和过滤）
   */
  async findMany(
    params: BookmarkQueryParams,
  ): Promise<PaginatedResult<BookmarkRow>> {
    const {
      folderId,
      folderIds,
      platform,
      isRead,
      isStarred,
      isInTrash = false,
      search,
      tags,
      limit,
      offset,
      orderBy,
      orderDir,
    } = params;

    // 构建基础查询
    let query = this.supabase
      .from(this.tableName)
      .select(BOOKMARK_LIST_FIELDS, { count: "exact" })
      .eq("user_id", this.userId)
      .is("deleted_at", null);

    // 应用过滤条件
    // V2.0: 优先使用 folderIds 批量查询，否则使用 folderId 单查询
    if (folderIds && folderIds.length > 0) {
      query = query.in("folder_id", folderIds);
    } else if (folderId !== undefined) {
      query = query.eq("folder_id", folderId);
    }

    if (platform) {
      query = query.eq("platform", platform);
    }

    if (isRead !== undefined) {
      query = query.eq("is_read", isRead);
    }

    if (isStarred !== undefined) {
      query = query.eq("is_starred", isStarred);
    }

    query = query.eq("is_in_trash", isInTrash);

    // 标签过滤
    if (tags && tags.length > 0) {
      query = query.overlaps("user_tags", tags);
    }

    // 全文搜索
    if (search) {
      query = query.textSearch("search_vector", search, {
        type: "websearch",
        config: "simple",
      });
    }

    // 排序和分页
    query = query
      .order(orderBy, { ascending: orderDir === "asc" })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      this.logger.error({ error, params }, "Failed to query bookmarks");
      throw error;
    }

    return {
      data: (data || []) as BookmarkRow[],
      total: count || 0,
    };
  }

  /**
   * 获取书签详情（含文件夹信息）
   */
  async findByIdWithDetails(id: number): Promise<BookmarkRow | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select(BOOKMARK_DETAIL_FIELDS)
      .eq("id", id)
      .eq("user_id", this.userId)
      .is("deleted_at", null)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      this.logger.error({ error, id }, "Failed to find bookmark with details");
      throw error;
    }

    return data as BookmarkRow;
  }

  /**
   * 批量检查 URL 是否存在
   */
  async checkUrlsExist(urls: string[]): Promise<Set<string>> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select("url")
      .eq("user_id", this.userId)
      .in("url", urls)
      .is("deleted_at", null);

    if (error) {
      this.logger.error({ error }, "Failed to check URLs existence");
      throw error;
    }

    return new Set(data?.map((d) => d.url) || []);
  }

  /**
   * 批量创建书签
   */
  async createMany(bookmarks: BookmarkInsert[]): Promise<BookmarkRow[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .insert(bookmarks)
      .select();

    if (error) {
      this.logger.error(
        { error, count: bookmarks.length },
        "Failed to create bookmarks",
      );
      throw error;
    }

    return data || [];
  }

  /**
   * 移动书签到回收站
   */
  async moveToTrash(id: number): Promise<boolean> {
    const { error, count } = await this.supabase
      .from(this.tableName)
      .update({
        is_in_trash: true,
        trashed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", this.userId);

    if (error) {
      this.logger.error({ error, id }, "Failed to move to trash");
      throw error;
    }

    return (count ?? 0) > 0;
  }

  /**
   * 从回收站恢复书签
   */
  async restoreFromTrash(id: number): Promise<boolean> {
    const { error, count } = await this.supabase
      .from(this.tableName)
      .update({
        is_in_trash: false,
        trashed_at: null,
      })
      .eq("id", id)
      .eq("user_id", this.userId)
      .eq("is_in_trash", true);

    if (error) {
      this.logger.error({ error, id }, "Failed to restore from trash");
      throw error;
    }

    return (count ?? 0) > 0;
  }

  /**
   * 切换收藏状态（原子操作）
   *
   * 使用 RPC 函数确保原子性，避免竞态条件
   */
  async toggleStarred(id: number): Promise<BookmarkRow | null> {
    // 尝试使用 RPC 原子操作
    try {
      const { data, error } = await this.supabase.rpc(
        "toggle_bookmark_starred" as keyof Database["public"]["Functions"],
        {
          p_bookmark_id: id,
          p_user_id: this.userId,
        } as ToggleBookmarkStarredParams,
      );

      if (error) {
        this.logger.warn(
          { error, id },
          "RPC toggle_bookmark_starred failed, using fallback",
        );
        return this.toggleStarredFallback(id);
      }

      if (!data || (Array.isArray(data) && data.length === 0)) {
        return null;
      }

      // RPC 返回数组，取第一个元素；如果返回布尔值则使用回退方法
      if (Array.isArray(data)) {
        return data[0] as BookmarkRow;
      } else if (typeof data === "object" && data !== null) {
        return data as BookmarkRow;
      } else {
        // 返回了布尔值或其他类型，使用回退方法获取最新数据
        return this.toggleStarredFallback(id);
      }
    } catch {
      return this.toggleStarredFallback(id);
    }
  }

  /**
   * 切换收藏状态（回退方法）
   *
   * 使用乐观锁模式避免竞态条件：
   * - 在 update 中添加 is_starred 条件检查
   * - 只有当状态与读取时相同才更新
   * - 如果无更新行，说明有并发修改，返回最新状态
   */
  private async toggleStarredFallback(id: number): Promise<BookmarkRow | null> {
    // 先获取当前状态
    const bookmark = await this.findById(id);
    if (!bookmark) {
      return null;
    }

    const currentIsStarred = bookmark.is_starred;
    const newIsStarred = !currentIsStarred;

    // 乐观锁：添加 is_starred 条件，确保状态未被并发修改
    const { data, error, count } = await this.supabase
      .from(this.tableName)
      .update({
        is_starred: newIsStarred,
        starred_at: newIsStarred ? new Date().toISOString() : null,
      })
      .eq("id", id)
      .eq("user_id", this.userId)
      .eq("is_starred", currentIsStarred) // 乐观锁条件
      .select()
      .single();

    if (error) {
      // PGRST116: 无匹配行（可能是并发修改导致条件不匹配）
      if (error.code === "PGRST116") {
        this.logger.warn(
          { id, currentIsStarred },
          "Concurrent toggle detected, returning latest state",
        );
        // 返回最新状态而非抛错
        return this.findById(id);
      }
      this.logger.error({ error, id }, "Failed to toggle starred");
      throw error;
    }

    // 额外检查：如果 count 为 0，说明乐观锁条件不匹配
    if (count === 0) {
      this.logger.warn(
        { id, currentIsStarred },
        "Optimistic lock failed, returning latest state",
      );
      return this.findById(id);
    }

    return data;
  }

  /**
   * 标记为已读
   */
  async markAsRead(id: number): Promise<boolean> {
    const { error, count } = await this.supabase
      .from(this.tableName)
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", this.userId);

    if (error) {
      this.logger.error({ error, id }, "Failed to mark as read");
      throw error;
    }

    return (count ?? 0) > 0;
  }

  /**
   * 批量移动到文件夹
   */
  async batchMoveToFolder(
    ids: number[],
    folderId: number | null,
  ): Promise<number> {
    const { error, count } = await this.supabase
      .from(this.tableName)
      .update({ folder_id: folderId })
      .in("id", ids)
      .eq("user_id", this.userId);

    if (error) {
      this.logger.error({ error, ids, folderId }, "Failed to batch move");
      throw error;
    }

    return count ?? 0;
  }

  /**
   * 批量添加标签
   */
  async batchAddTags(ids: number[], tags: string[]): Promise<number> {
    // 使用 RPC 函数来合并标签
    const { data, error } = await this.supabase.rpc("batch_add_tags", {
      p_bookmark_ids: ids,
      p_tags: tags,
      p_user_id: this.userId,
    });

    if (error) {
      this.logger.error({ error, ids, tags }, "Failed to batch add tags");
      throw error;
    }

    // RPC 返回的是 { affected_ids, affected_count } 对象
    if (typeof data === "object" && data !== null && "affected_count" in data) {
      return (data as { affected_count: number }).affected_count;
    }
    return typeof data === "number" ? data : 0;
  }

  /**
   * 批量移除标签
   */
  async batchRemoveTags(ids: number[], tags: string[]): Promise<number> {
    // 使用 RPC 函数来移除标签
    const { data, error } = await this.supabase.rpc("batch_remove_tags", {
      p_bookmark_ids: ids,
      p_tags: tags,
    });

    if (error) {
      this.logger.error({ error, ids, tags }, "Failed to batch remove tags");
      throw error;
    }

    // RPC 返回的是 { affected_ids, affected_count } 对象
    if (typeof data === "object" && data !== null && "affected_count" in data) {
      return (data as { affected_count: number }).affected_count;
    }
    return typeof data === "number" ? data : 0;
  }

  /**
   * 批量从回收站恢复
   */
  async batchRestoreFromTrash(ids: number[]): Promise<number> {
    const { error, count } = await this.supabase
      .from(this.tableName)
      .update({
        is_in_trash: false,
        trashed_at: null,
      })
      .in("id", ids)
      .eq("user_id", this.userId)
      .eq("is_in_trash", true)
      .is("deleted_at", null);

    if (error) {
      this.logger.error({ error, ids }, "Failed to batch restore from trash");
      throw error;
    }

    return count ?? 0;
  }

  /**
   * 批量移到回收站
   */
  async batchMoveToTrash(ids: number[]): Promise<number> {
    const { error, count } = await this.supabase
      .from(this.tableName)
      .update({
        is_in_trash: true,
        trashed_at: new Date().toISOString(),
      })
      .in("id", ids)
      .eq("user_id", this.userId)
      .is("deleted_at", null);

    if (error) {
      this.logger.error({ error, ids }, "Failed to batch move to trash");
      throw error;
    }

    return count ?? 0;
  }

  /**
   * 获取用户的所有标签
   */
  async getAllUserTags(): Promise<string[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select("user_tags")
      .eq("user_id", this.userId)
      .is("deleted_at", null)
      .not("user_tags", "is", null);

    if (error) {
      this.logger.error({ error }, "Failed to get user tags");
      throw error;
    }

    // 合并所有标签并去重
    const allTags = new Set<string>();
    for (const row of data || []) {
      if (row.user_tags) {
        for (const tag of row.user_tags) {
          allTags.add(tag);
        }
      }
    }

    return Array.from(allTags).sort();
  }

  /**
   * 获取书签统计
   *
   * 优化：使用单次查询 + 客户端聚合，避免 N+1 查询问题
   * 原实现：5 次独立数据库查询
   * 优化后：1 次查询 + O(n) 客户端聚合
   */
  async getStats(): Promise<{
    total: number;
    unread: number;
    starred: number;
    inTrash: number;
    byPlatform: Record<string, number>;
  }> {
    // 单次查询获取所有需要的字段
    const { data } = await this.supabase
      .from(this.tableName)
      .select("is_read, is_starred, is_in_trash, platform")
      .eq("user_id", this.userId)
      .is("deleted_at", null);

    // 客户端聚合统计
    let total = 0;
    let unread = 0;
    let starred = 0;
    let inTrash = 0;
    const byPlatform: Record<string, number> = {};

    for (const row of data || []) {
      if (row.is_in_trash) {
        inTrash++;
      } else {
        total++;
        if (!row.is_read) unread++;
        if (row.is_starred) starred++;
        if (row.platform) {
          byPlatform[row.platform] = (byPlatform[row.platform] || 0) + 1;
        }
      }
    }

    return { total, unread, starred, inTrash, byPlatform };
  }

  // ============================================================================
  // Classification specific methods
  // ============================================================================

  /**
   * Find similar bookmarks with their folder info
   * @param excludeBookmarkId - 可选，排除指定书签（避免自匹配）
   */
  async findSimilarWithFolders(
    embedding: number[],
    limit: number = 10,
    excludeBookmarkId?: number,
  ): Promise<SimilarBookmarkWithFolder[]> {
    // 多请求一个结果，以便在过滤后仍有足够数量
    const fetchCount = excludeBookmarkId ? limit + 1 : limit;

    const { data, error } = await this.supabase.rpc(
      "find_similar_bookmarks_with_folders",
      {
        query_embedding: JSON.stringify(embedding),
        p_user_id: this.userId,
        match_count: fetchCount,
      },
    );

    if (error) {
      this.logger.error({ error }, "Failed to find similar bookmarks");
      throw error;
    }

    // 运行时验证数据库返回结果
    try {
      const rows = data || [];
      const validatedRows = rows.map((row: unknown, index: number) => {
        const result = SimilarBookmarkRowSchema.safeParse(row);
        if (!result.success) {
          throw new Error(
            `Invalid row at index ${index}: ${result.error.message}`,
          );
        }
        return result.data;
      });

      let results: SimilarBookmarkWithFolder[] = validatedRows.map((row) => ({
        bookmarkId: row.bookmark_id,
        bookmarkTitle: row.bookmark_title,
        folderId: row.folder_id,
        folderName: row.folder_name,
        similarity: row.similarity,
      }));

      // 排除当前书签（避免自匹配）
      if (excludeBookmarkId) {
        results = results.filter((r) => r.bookmarkId !== excludeBookmarkId);
      }

      return results.slice(0, limit);
    } catch (error) {
      this.logger.error({ error }, "Failed to parse similar bookmarks");
      throw error;
    }
  }

  /**
   * Get bookmarks in inbox (no folder or in inbox system folder)
   */
  async findInboxBookmarks(): Promise<BookmarkForClassification[]> {
    // First get inbox folder ID
    const { data: inboxFolder } = await this.supabase
      .from("folders")
      .select("id")
      .eq("user_id", this.userId)
      .eq("is_system", true)
      .eq("system_type", "INBOX")
      .is("deleted_at", null)
      .single();

    // Query bookmarks without folder OR in inbox folder
    let query = this.supabase
      .from(this.tableName)
      .select(
        "id, title, url, ai_summary, ai_tags, embedding, folder_id, created_at",
      )
      .eq("user_id", this.userId)
      .is("deleted_at", null);

    if (inboxFolder) {
      query = query.or(`folder_id.is.null,folder_id.eq.${inboxFolder.id}`);
    } else {
      query = query.is("folder_id", null);
    }

    // V4.2.15: 添加 LIMIT 限制，防止大量数据导致性能问题
    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      this.logger.error({ error }, "Failed to fetch inbox bookmarks");
      throw error;
    }

    return (data || []).map((row) =>
      this.mapToBookmarkForClassification(row as BookmarkClassificationRow),
    );
  }

  /**
   * Get bookmarks by folder ID (Classification version)
   */
  async findByFolderIdForClassification(
    folderId: number,
  ): Promise<BookmarkForClassification[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select(
        "id, title, url, ai_summary, ai_tags, embedding, folder_id, created_at",
      )
      .eq("folder_id", folderId)
      .eq("user_id", this.userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      this.logger.error(
        { error, folderId },
        "Failed to fetch folder bookmarks for classification",
      );
      throw error;
    }

    return (data || []).map((row) =>
      this.mapToBookmarkForClassification(row as BookmarkClassificationRow),
    );
  }

  /**
   * Get bookmark embeddings by IDs
   */
  async getEmbeddings(bookmarkIds: number[]): Promise<Map<number, number[]>> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select("id, embedding")
      .in("id", bookmarkIds)
      .eq("user_id", this.userId)
      .is("deleted_at", null)
      .not("embedding", "is", null);

    if (error) {
      this.logger.error({ error, bookmarkIds }, "Failed to fetch embeddings");
      throw error;
    }

    const embeddings = new Map<number, number[]>();
    for (const row of data || []) {
      if (row.embedding) {
        // Explicitly cast the JSONB/array to number[]
        let emb: number[];
        if (typeof row.embedding === "string") {
          try {
            emb = JSON.parse(row.embedding);
          } catch {
            emb = [];
          }
        } else {
          emb = row.embedding as unknown as number[];
        }
        embeddings.set(row.id, emb);
      }
    }
    return embeddings;
  }

  /**
   * 批量移动书签到指定文件夹
   * @param bookmarkIds 书签 ID 列表
   * @param targetFolderId 目标文件夹 ID
   */
  async moveToFolder(
    bookmarkIds: number[],
    targetFolderId: number,
  ): Promise<void> {
    if (bookmarkIds.length === 0) {
      return;
    }

    const { error } = await this.supabase
      .from(this.tableName)
      .update({ folder_id: targetFolderId })
      .in("id", bookmarkIds)
      .eq("user_id", this.userId);

    if (error) {
      this.logger.error(
        { error, bookmarkIds, targetFolderId },
        "Failed to move bookmarks to folder",
      );
      throw error;
    }
  }

  /**
   * Map database row to BookmarkForClassification
   */
  private mapToBookmarkForClassification(
    row: BookmarkClassificationRow,
  ): BookmarkForClassification {
    // 解析 embedding 字符串为数组
    let embeddingArray: number[] | null = null;
    if (row.embedding) {
      if (typeof row.embedding === "string") {
        try {
          embeddingArray = JSON.parse(row.embedding);
        } catch {
          embeddingArray = null;
        }
      } else if (Array.isArray(row.embedding)) {
        embeddingArray = row.embedding;
      }
    }

    return {
      id: row.id,
      title: row.title,
      url: row.url,
      aiSummary: row.ai_summary,
      aiTags: row.ai_tags || [],
      embedding: embeddingArray,
      folderId: row.folder_id,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }
}
