/**
 * 书签服务端仓储 - 统一的数据访问层
 * @description 所有服务端书签查询必须通过此类，确保过滤条件一致
 * @version 1.0.0
 *
 * 设计原则：
 * - 单一事实来源：统一过滤逻辑
 * - 类型安全：完整 TypeScript 类型
 * - 分页支持：突破 Supabase 1000 行限制
 * - 可测试性：依赖注入设计
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Bookmark, Platform } from "@/types/supabase";

// ============================================================================
// 常量定义
// ============================================================================

/** 浏览器平台标识（单一定义点） */
export const BROWSER_PLATFORMS: Platform[] = [
  "BROWSER_CHROME",
  "BROWSER_EDGE",
  "BROWSER_FIREFOX",
  "BROWSER_SAFARI",
];

/**
 * 判断是否为浏览器平台
 */
export function isBrowserPlatform(platform: Platform | string | null): boolean {
  if (!platform) return false;
  return BROWSER_PLATFORMS.includes(platform as Platform);
}

// ============================================================================
// 类型定义
// ============================================================================

/** 书签查询范围 */
export type BookmarkScope = "active" | "trashed" | "all";

/** 书签查询选项 */
export interface BookmarkQueryOptions {
  /** 查询范围：active（活跃）、trashed（垃圾箱）、all（全部） */
  scope?: BookmarkScope;
  /** 是否排除浏览器书签 */
  excludeBrowser?: boolean;
  /** 仅浏览器书签 */
  onlyBrowser?: boolean;
  /** 平台过滤 */
  platform?: string;
  /** 文件夹过滤 */
  folderId?: number | null;
  /** 限制数量 */
  limit?: number;
  /** 偏移量 */
  offset?: number;
}

/** 书签统计选项 */
export interface BookmarkCountOptions {
  scope?: BookmarkScope;
  excludeBrowser?: boolean;
  onlyBrowser?: boolean;
  platform?: string;
  folderId?: number | null;
  /** 起始日期过滤 */
  fromDate?: Date;
  /** 结束日期过滤 */
  toDate?: Date;
}

// ============================================================================
// BookmarkServerRepository 类
// ============================================================================

/**
 * 书签服务端仓储
 *
 * @example
 * ```typescript
 * const repository = new BookmarkServerRepository(supabase, userId);
 *
 * // 获取所有活跃书签
 * const all = await repository.getAll();
 *
 * // 获取内容书签（排除浏览器）
 * const content = await repository.getContentBookmarks();
 *
 * // 获取浏览器书签
 * const browser = await repository.getBrowserBookmarks();
 * ```
 */
export class BookmarkServerRepository {
  constructor(
    private supabase: SupabaseClient,
    private userId: string,
  ) {}

  // ==========================================================================
  // 主要查询方法
  // ==========================================================================

  /**
   * 获取所有书签（支持分页以突破 1000 行限制）
   */
  async getAll(options: BookmarkQueryOptions = {}): Promise<Bookmark[]> {
    const { scope = "active", limit, offset } = options;
    const allBookmarks: Bookmark[] = [];
    const pageSize = limit || 1000;
    let currentOffset = offset || 0;
    let hasMore = true;

    while (hasMore) {
      let query = this.supabase
        .from("bookmarks")
        .select("*")
        .eq("user_id", this.userId)
        .is("deleted_at", null);

      // 应用范围过滤
      query = this.applyScope(query, scope);

      // 应用平台过滤
      if (options.excludeBrowser) {
        query = query.not("platform", "in", `(${BROWSER_PLATFORMS.join(",")})`);
      } else if (options.onlyBrowser) {
        query = query.in("platform", BROWSER_PLATFORMS);
      } else if (options.platform) {
        query = query.eq("platform", options.platform);
      }

      // 应用文件夹过滤
      if (options.folderId !== undefined) {
        if (options.folderId === null) {
          query = query.is("folder_id", null);
        } else {
          query = query.eq("folder_id", options.folderId);
        }
      }

      // 分页
      query = query
        .order("created_at", { ascending: false })
        .range(currentOffset, currentOffset + pageSize - 1);

      const { data, error } = await query;

      if (error) {
        throw new Error(
          `BookmarkServerRepository.getAll failed: ${error.message}`,
        );
      }

      if (data && data.length > 0) {
        allBookmarks.push(...(data as Bookmark[]));
        currentOffset += data.length;
        // 如果指定了 limit，不继续分页
        hasMore = !limit && data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    return allBookmarks;
  }

  /**
   * 获取统计所需的轻量级书签数据（性能优化）
   * 只选择 analytics 需要的字段，大幅减少数据传输量
   */
  async getForAnalytics(
    options: BookmarkQueryOptions = {},
  ): Promise<
    Pick<Bookmark, "id" | "platform" | "created_at" | "folder_id" | "ai_tags">[]
  > {
    const { scope = "active", limit, offset } = options;
    const allBookmarks: Pick<
      Bookmark,
      "id" | "platform" | "created_at" | "folder_id" | "ai_tags"
    >[] = [];
    const pageSize = limit || 1000;
    let currentOffset = offset || 0;
    let hasMore = true;

    while (hasMore) {
      let query = this.supabase
        .from("bookmarks")
        .select("id, platform, created_at, folder_id, ai_tags") // 只选择需要的字段
        .eq("user_id", this.userId)
        .is("deleted_at", null);

      // 应用范围过滤
      query = this.applyScope(query, scope);

      // 应用平台过滤
      if (options.excludeBrowser) {
        query = query.not("platform", "in", `(${BROWSER_PLATFORMS.join(",")})`);
      } else if (options.onlyBrowser) {
        query = query.in("platform", BROWSER_PLATFORMS);
      } else if (options.platform) {
        query = query.eq("platform", options.platform);
      }

      // 分页
      query = query
        .order("created_at", { ascending: false })
        .range(currentOffset, currentOffset + pageSize - 1);

      const { data, error } = await query;

      if (error) {
        throw new Error(
          `BookmarkServerRepository.getForAnalytics failed: ${error.message}`,
        );
      }

      if (data && data.length > 0) {
        allBookmarks.push(
          ...(data as Pick<
            Bookmark,
            "id" | "platform" | "created_at" | "folder_id" | "ai_tags"
          >[]),
        );
        currentOffset += data.length;
        hasMore = !limit && data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    return allBookmarks;
  }

  /**
   * 获取内容书签（排除浏览器书签）
   */
  async getContentBookmarks(
    options: Omit<BookmarkQueryOptions, "excludeBrowser" | "onlyBrowser"> = {},
  ): Promise<Bookmark[]> {
    return this.getAll({ ...options, excludeBrowser: true });
  }

  /**
   * 获取浏览器书签
   */
  async getBrowserBookmarks(
    options: Omit<BookmarkQueryOptions, "excludeBrowser" | "onlyBrowser"> = {},
  ): Promise<Bookmark[]> {
    return this.getAll({ ...options, onlyBrowser: true });
  }

  // ==========================================================================
  // 统计方法
  // ==========================================================================

  /**
   * 获取书签数量
   */
  async count(options: BookmarkCountOptions = {}): Promise<number> {
    const { scope = "active" } = options;

    let query = this.supabase
      .from("bookmarks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", this.userId)
      .is("deleted_at", null);

    // 应用范围过滤
    query = this.applyScope(query, scope);

    // 应用平台过滤
    if (options.excludeBrowser) {
      query = query.not("platform", "in", `(${BROWSER_PLATFORMS.join(",")})`);
    } else if (options.onlyBrowser) {
      query = query.in("platform", BROWSER_PLATFORMS);
    } else if (options.platform) {
      query = query.eq("platform", options.platform);
    }

    // 应用文件夹过滤
    if (options.folderId !== undefined) {
      if (options.folderId === null) {
        query = query.is("folder_id", null);
      } else {
        query = query.eq("folder_id", options.folderId);
      }
    }

    // 应用日期过滤
    if (options.fromDate) {
      query = query.gte("created_at", options.fromDate.toISOString());
    }
    if (options.toDate) {
      query = query.lte("created_at", options.toDate.toISOString());
    }

    const { count, error } = await query;

    if (error) {
      throw new Error(
        `BookmarkServerRepository.count failed: ${error.message}`,
      );
    }

    return count || 0;
  }

  /**
   * 获取内容书签数量
   */
  async countContentBookmarks(
    options: Omit<BookmarkCountOptions, "excludeBrowser" | "onlyBrowser"> = {},
  ): Promise<number> {
    return this.count({ ...options, excludeBrowser: true });
  }

  /**
   * 获取浏览器书签数量
   */
  async countBrowserBookmarks(
    options: Omit<BookmarkCountOptions, "excludeBrowser" | "onlyBrowser"> = {},
  ): Promise<number> {
    return this.count({ ...options, onlyBrowser: true });
  }

  // ==========================================================================
  // 辅助方法
  // ==========================================================================

  /**
   * 应用范围过滤
   * - active: 活跃书签（排除垃圾箱，兼容 NULL 值）
   * - trashed: 垃圾箱书签
   * - all: 全部书签
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private applyScope(query: any, scope: BookmarkScope) {
    switch (scope) {
      case "active":
        // 活跃书签：排除垃圾箱（兼容 NULL 值）
        return query.or("is_in_trash.eq.false,is_in_trash.is.null");
      case "trashed":
        return query.eq("is_in_trash", true);
      case "all":
        return query;
      default:
        return query.or("is_in_trash.eq.false,is_in_trash.is.null");
    }
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建书签服务端仓储实例
 */
export function createBookmarkServerRepository(
  supabase: SupabaseClient,
  userId: string,
): BookmarkServerRepository {
  return new BookmarkServerRepository(supabase, userId);
}
