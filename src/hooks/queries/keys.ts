/**
 * TanStack Query Keys
 *
 * 统一管理所有 Query Keys，确保缓存一致性
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

// ============================================
// 类型定义
// ============================================

export interface BookmarkFilters {
  folderId?: number | null;
  platform?: string | null;
  isRead?: boolean;
  isStarred?: boolean;
  isInTrash?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: "created_at" | "updated_at" | "title";
  sortOrder?: "asc" | "desc";
}

export interface FolderFilters {
  parentId?: number | null;
  includeArchived?: boolean;
}

// ============================================
// Query Key Factories
// ============================================

/**
 * Bookmark Query Keys
 *
 * 层级结构：all → lists → list(filters) → details → detail(id)
 */
export const bookmarkKeys = {
  /** 所有书签相关查询 */
  all: ["bookmarks"] as const,

  /** 列表查询 */
  lists: () => [...bookmarkKeys.all, "list"] as const,

  /** 带过滤条件的列表查询 */
  list: (filters: BookmarkFilters) =>
    [...bookmarkKeys.lists(), filters] as const,

  /** 无限滚动列表 */
  infinite: (filters: Omit<BookmarkFilters, "offset">) =>
    [...bookmarkKeys.lists(), "infinite", filters] as const,

  /** 详情查询 */
  details: () => [...bookmarkKeys.all, "detail"] as const,

  /** 单个书签详情 */
  detail: (id: number) => [...bookmarkKeys.details(), id] as const,

  /** 统计查询 */
  stats: () => [...bookmarkKeys.all, "stats"] as const,

  /** 用户标签 */
  userTags: () => [...bookmarkKeys.all, "userTags"] as const,
};

/**
 * Folder Query Keys
 */
export const folderKeys = {
  /** 所有文件夹相关查询 */
  all: ["folders"] as const,

  /** 列表查询 */
  lists: () => [...folderKeys.all, "list"] as const,

  /** 带过滤条件的列表查询 */
  list: (filters?: FolderFilters) => [...folderKeys.lists(), filters] as const,

  /** 树形结构 */
  tree: () => [...folderKeys.all, "tree"] as const,

  /** 详情查询 */
  details: () => [...folderKeys.all, "detail"] as const,

  /** 单个文件夹详情 */
  detail: (id: number) => [...folderKeys.details(), id] as const,

  /** 文件夹路径（面包屑） */
  path: (id: number) => [...folderKeys.all, "path", id] as const,
};

/**
 * Search Query Keys
 */
export const searchKeys = {
  all: ["search"] as const,
  results: (query: string, type?: string) =>
    [...searchKeys.all, query, type] as const,
  suggestions: (query: string) =>
    [...searchKeys.all, "suggestions", query] as const,
};

/**
 * Smart List Query Keys
 */
export const smartListKeys = {
  all: ["smartLists"] as const,
  lists: () => [...smartListKeys.all, "list"] as const,
  detail: (id: string) => [...smartListKeys.all, "detail", id] as const,
  bookmarks: (id: string, filters?: BookmarkFilters) =>
    [...smartListKeys.all, id, "bookmarks", filters] as const,
};
