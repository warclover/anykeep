/**
 * Bookmark Service
 *
 * 书签业务逻辑层，处理所有书签相关的业务操作
 *
 * @module services/domain
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { BaseService, ServiceError } from "../core/base.service";
import type { BookmarkQueryParams } from "@/repositories";
import { BookmarkRepository } from "@/repositories";
import type {
  CreateBookmarkInput,
  UpdateBookmarkInput,
  BookmarkQueryInput,
  BookmarkListItemResponse,
  BookmarkDetailResponse,
  BookmarkListResponse,
  BookmarkStatsResponse,
  BatchOperationResponse,
} from "@/contracts";

// Type alias
type BookmarkRow = Database["public"]["Tables"]["bookmarks"]["Row"];

/**
 * Bookmark Service
 *
 * 提供书签的完整业务逻辑，包括 CRUD、批量操作、统计等
 */
export class BookmarkService extends BaseService {
  private readonly repository: BookmarkRepository;

  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, userId, "BookmarkService");
    this.repository = new BookmarkRepository(supabase, userId);
  }

  /**
   * 获取书签列表
   */
  async list(query: BookmarkQueryInput): Promise<BookmarkListResponse> {
    return this.withLogging(
      "list",
      async () => {
        const params: BookmarkQueryParams = {
          folderId: query.folderId,
          platform: query.platform,
          isRead: query.isRead,
          isStarred: query.isStarred,
          isInTrash: query.isInTrash,
          search: query.search,
          tags: query.tags,
          limit: query.limit,
          offset: query.offset,
          orderBy: query.orderBy,
          orderDir: query.orderDir,
        };

        const { data, total } = await this.repository.findMany(params);

        return {
          items: data.map(this.toListItemResponse),
          total,
          limit: query.limit,
          offset: query.offset,
          hasMore: query.offset + data.length < total,
        };
      },
      { query },
    );
  }

  /**
   * 获取书签详情
   */
  async getById(id: number): Promise<BookmarkDetailResponse> {
    return this.withLogging(
      "getById",
      async () => {
        const bookmark = await this.repository.findByIdWithDetails(id);

        if (!bookmark) {
          throw new ServiceError("NOT_FOUND", `Bookmark ${id} not found`);
        }

        return this.toDetailResponse(bookmark);
      },
      { id },
    );
  }

  /**
   * 创建书签
   *
   * 注意：通常应通过 IngestionService 创建书签，以便统一处理
   */
  async create(input: CreateBookmarkInput): Promise<BookmarkDetailResponse> {
    return this.withLogging(
      "create",
      async () => {
        // 检查 URL 重复
        const existing = await this.repository.findByUrl(input.url);
        if (existing) {
          throw new ServiceError(
            "DUPLICATE",
            "Bookmark with this URL already exists",
          );
        }

        // 创建书签
        const bookmark = await this.repository.create({
          url: input.url,
          title: input.title || this.extractTitleFromUrl(input.url),
          description: input.description,
          folder_id: input.folderId,
          user_tags: input.tags,
          notes: input.notes,
          platform: input.platform || this.detectPlatform(input.url),
          user_id: this.userId,
          is_starred: false,
        });

        return this.toDetailResponse(bookmark);
      },
      { url: input.url },
    );
  }

  /**
   * 更新书签
   */
  async update(
    id: number,
    input: UpdateBookmarkInput,
  ): Promise<BookmarkDetailResponse> {
    return this.withLogging(
      "update",
      async () => {
        const updateData: Database["public"]["Tables"]["bookmarks"]["Update"] =
          {};

        if (input.title !== undefined) updateData.title = input.title;
        if (input.description !== undefined)
          updateData.description = input.description;
        if (input.folderId !== undefined) updateData.folder_id = input.folderId;
        if (input.tags !== undefined) updateData.user_tags = input.tags;
        if (input.notes !== undefined) updateData.notes = input.notes;

        // 处理已读状态
        if (input.isRead !== undefined) {
          updateData.is_read = input.isRead;
          if (input.isRead) {
            updateData.read_at = new Date().toISOString();
          }
        }

        // 处理收藏状态
        if (input.isStarred !== undefined) {
          updateData.is_starred = input.isStarred;
          updateData.starred_at = input.isStarred
            ? new Date().toISOString()
            : null;
        }

        const bookmark = await this.repository.update(id, updateData);

        if (!bookmark) {
          throw new ServiceError("NOT_FOUND", `Bookmark ${id} not found`);
        }

        return this.toDetailResponse(bookmark);
      },
      { id },
    );
  }

  /**
   * 删除书签（软删除，移到回收站）
   */
  async delete(id: number): Promise<void> {
    return this.withLogging(
      "delete",
      async () => {
        const success = await this.repository.moveToTrash(id);

        if (!success) {
          throw new ServiceError("NOT_FOUND", `Bookmark ${id} not found`);
        }
      },
      { id },
    );
  }

  /**
   * 永久删除书签
   */
  async permanentDelete(id: number): Promise<void> {
    return this.withLogging(
      "permanentDelete",
      async () => {
        const success = await this.repository.softDelete(id);

        if (!success) {
          throw new ServiceError("NOT_FOUND", `Bookmark ${id} not found`);
        }
      },
      { id },
    );
  }

  /**
   * 从回收站恢复书签
   */
  async restore(id: number): Promise<BookmarkDetailResponse> {
    return this.withLogging(
      "restore",
      async () => {
        const success = await this.repository.restoreFromTrash(id);

        if (!success) {
          throw new ServiceError(
            "NOT_FOUND",
            `Bookmark ${id} not found in trash`,
          );
        }

        const bookmark = await this.repository.findByIdWithDetails(id);
        if (!bookmark) {
          throw new ServiceError(
            "NOT_FOUND",
            `Bookmark ${id} not found after restore`,
          );
        }
        return this.toDetailResponse(bookmark);
      },
      { id },
    );
  }

  /**
   * 切换收藏状态
   */
  async toggleStar(id: number): Promise<BookmarkDetailResponse> {
    return this.withLogging(
      "toggleStar",
      async () => {
        const bookmark = await this.repository.toggleStarred(id);

        if (!bookmark) {
          throw new ServiceError("NOT_FOUND", `Bookmark ${id} not found`);
        }

        return this.toDetailResponse(bookmark);
      },
      { id },
    );
  }

  /**
   * 标记为已读
   */
  async markAsRead(id: number): Promise<void> {
    return this.withLogging(
      "markAsRead",
      async () => {
        const success = await this.repository.markAsRead(id);

        if (!success) {
          throw new ServiceError("NOT_FOUND", `Bookmark ${id} not found`);
        }
      },
      { id },
    );
  }

  /**
   * 批量移动到文件夹
   */
  async batchMove(
    ids: number[],
    folderId: number | null,
  ): Promise<BatchOperationResponse> {
    return this.withLogging(
      "batchMove",
      async () => {
        // 验证文件夹存在（如果指定）
        if (folderId !== null) {
          const { data: folder } = await this.supabase
            .from("folders")
            .select("id")
            .eq("id", folderId)
            .eq("user_id", this.userId)
            .single();

          if (!folder) {
            throw new ServiceError("NOT_FOUND", "Target folder not found");
          }
        }

        const affected = await this.repository.batchMoveToFolder(ids, folderId);

        return {
          success: true,
          affected,
          message: `Moved ${affected} bookmark(s) to folder`,
        };
      },
      { ids, folderId },
    );
  }

  /**
   * 批量添加标签
   */
  async batchAddTags(
    ids: number[],
    tags: string[],
  ): Promise<BatchOperationResponse> {
    return this.withLogging(
      "batchAddTags",
      async () => {
        const affected = await this.repository.batchAddTags(ids, tags);

        return {
          success: true,
          affected,
          message: `Added tags to ${affected} bookmark(s)`,
        };
      },
      { ids, tags },
    );
  }

  /**
   * 批量删除（移到回收站）
   */
  async batchDelete(ids: number[]): Promise<BatchOperationResponse> {
    return this.withLogging(
      "batchDelete",
      async () => {
        const affected = await this.repository.batchMoveToTrash(ids);

        return {
          success: true,
          affected,
          message: `Moved ${affected} bookmark(s) to trash`,
        };
      },
      { ids },
    );
  }

  /**
   * 批量恢复（从回收站恢复）
   */
  async batchRestore(ids: number[]): Promise<BatchOperationResponse> {
    return this.withLogging(
      "batchRestore",
      async () => {
        const affected = await this.repository.batchRestoreFromTrash(ids);

        return {
          success: true,
          affected,
          message: `Restored ${affected} bookmark(s) from trash`,
        };
      },
      { ids },
    );
  }

  /**
   * 批量移除标签
   */
  async batchRemoveTags(
    ids: number[],
    tags: string[],
  ): Promise<BatchOperationResponse> {
    return this.withLogging(
      "batchRemoveTags",
      async () => {
        const affected = await this.repository.batchRemoveTags(ids, tags);

        return {
          success: true,
          affected,
          message: `Removed tags from ${affected} bookmark(s)`,
        };
      },
      { ids, tags },
    );
  }

  /**
   * 获取书签统计
   */
  async getStats(): Promise<BookmarkStatsResponse> {
    return this.withLogging("getStats", async () => {
      return this.repository.getStats();
    });
  }

  /**
   * 获取用户所有标签
   */
  async getAllTags(): Promise<string[]> {
    return this.withLogging("getAllTags", async () => {
      return this.repository.getAllUserTags();
    });
  }

  /**
   * 检查 URL 是否已存在
   */
  async checkUrlExists(url: string): Promise<boolean> {
    const existing = await this.repository.findByUrl(url);
    return existing !== null;
  }

  // ============== Private Methods ==============

  /**
   * 转换为列表项响应
   */
  private toListItemResponse(bookmark: BookmarkRow): BookmarkListItemResponse {
    return {
      id: bookmark.id,
      url: bookmark.url,
      title: bookmark.title,
      description: bookmark.description,
      platform: bookmark.platform,
      coverUrl: bookmark.cover_url,
      folderId: bookmark.folder_id,
      aiSummary: bookmark.ai_summary,
      aiTags: bookmark.ai_tags,
      userTags: bookmark.user_tags,
      isRead: bookmark.is_read ?? false,
      isStarred: bookmark.is_starred,
      isInTrash: bookmark.is_in_trash ?? false,
      status: bookmark.status,
      createdAt: bookmark.created_at ?? new Date().toISOString(),
      updatedAt: bookmark.updated_at,
      starredAt: bookmark.starred_at,
    };
  }

  /**
   * 转换为详情响应
   */
  private toDetailResponse(
    bookmark: BookmarkRow & { folders?: { id: number; name: string } | null },
  ): BookmarkDetailResponse {
    return {
      ...this.toListItemResponse(bookmark),
      author: bookmark.author,
      notes: bookmark.notes,
      wordCount: bookmark.word_count,
      publishTime: bookmark.publish_time,
      contentType: bookmark.content_type,
      aiContentType: bookmark.ai_content_type,
      classificationStatus: bookmark.classification_status,
      folder: bookmark.folders ?? null,
    };
  }

  /**
   * 从 URL 提取标题
   */
  private extractTitleFromUrl(url: string): string {
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  }

  /**
   * 检测平台
   */
  private detectPlatform(url: string): string {
    try {
      const hostname = new URL(url).hostname.toLowerCase();

      const platformMap: Record<string, string> = {
        "mp.weixin.qq.com": "wechat",
        "weixin.qq.com": "wechat",
        "bilibili.com": "bilibili",
        "www.bilibili.com": "bilibili",
        "xiaohongshu.com": "xiaohongshu",
        "www.xiaohongshu.com": "xiaohongshu",
        "zhihu.com": "zhihu",
        "www.zhihu.com": "zhihu",
        "juejin.cn": "juejin",
        "github.com": "github",
        "twitter.com": "twitter",
        "x.com": "twitter",
        "youtube.com": "youtube",
        "www.youtube.com": "youtube",
      };

      for (const [domain, platform] of Object.entries(platformMap)) {
        if (hostname.includes(domain)) {
          return platform;
        }
      }

      return "web";
    } catch {
      return "web";
    }
  }
}
