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

/**
 * Folder Bookmarks Query Keys (用于文件夹/分组的书签无限滚动)
 */
export const folderBookmarkKeys = {
  all: ["folderBookmarks"] as const,
  /** 按文件夹 ID 列表查询 */
  byFolderIds: (folderIds: number[]) =>
    [
      ...folderBookmarkKeys.all,
      "infinite",
      folderIds.sort().join(","),
    ] as const,
};

/**
 * Init Data Query Keys (首页聚合数据)
 */
export interface InitDataFilters {
  platform?: string;
  sort?: string;
  folder?: string;
}

export const initDataKeys = {
  all: ["initData"] as const,
  /** 带筛选条件的初始化数据 */
  filtered: (filters: InitDataFilters) =>
    [...initDataKeys.all, filters] as const,
};

/**
 * Inbox Query Keys
 */
export const inboxKeys = {
  all: ["inbox"] as const,
  counts: () => [...inboxKeys.all, "counts"] as const,
};

/**
 * Custom Usage Tags Query Keys
 */
export const customTagKeys = {
  all: ["customUsageTags"] as const,
  list: () => [...customTagKeys.all, "list"] as const,
};

/**
 * Smart List Bookmarks Query Keys
 */
export const smartListBookmarkKeys = {
  all: ["smartListBookmarks"] as const,
  byId: (id: number) => [...smartListBookmarkKeys.all, id] as const,
};

/**
 * Monitor Query Keys
 */
export const monitorKeys = {
  all: ["monitors"] as const,
  list: (status?: string) => [...monitorKeys.all, "list", status] as const,
  detail: (id: number) => [...monitorKeys.all, "detail", id] as const,
};

/**
 * Quota Query Keys
 */
export const quotaKeys = {
  all: ["quota"] as const,
  knowledgeStudio: () => [...quotaKeys.all, "knowledgeStudio"] as const,
};

/**
 * Persona Query Keys
 */
export const personaKeys = {
  all: ["persona"] as const,
  current: () => [...personaKeys.all, "current"] as const,
};

/**
 * Profile Query Keys
 */
export const profileKeys = {
  all: ["profile"] as const,
  byUserId: (userId: string) => [...profileKeys.all, userId] as const,
};

/**
 * Inbox Organization Query Keys
 */
export const inboxOrganizationKeys = {
  all: ["inboxOrganization"] as const,
  analysis: () => [...inboxOrganizationKeys.all, "analysis"] as const,
};

/**
 * Operation History Query Keys
 */
export const operationHistoryKeys = {
  all: ["operationHistory"] as const,
  list: (params: string) =>
    [...operationHistoryKeys.all, "list", params] as const,
};

/**
 * Health Check Query Keys
 */
export const healthKeys = {
  all: ["health"] as const,
  overview: () => [...healthKeys.all, "overview"] as const,
  scanStatus: () => [...healthKeys.all, "scanStatus"] as const,
  brokenLinks: (page: number, pageSize: number) =>
    [...healthKeys.all, "brokenLinks", page, pageSize] as const,
  duplicates: (page: number, pageSize: number) =>
    [...healthKeys.all, "duplicates", page, pageSize] as const,
  staleContent: (days: number, page: number, pageSize: number) =>
    [...healthKeys.all, "stale", days, page, pageSize] as const,
};

/**
 * Highlights Query Keys
 */
export const highlightKeys = {
  all: ["highlights"] as const,
  byCollection: (collectionId: number) =>
    [...highlightKeys.all, "collection", collectionId] as const,
};

/**
 * Wechat Article Query Keys
 */
export const wechatArticleKeys = {
  all: ["wechatArticle"] as const,
  detail: (snapshotId: number) =>
    [...wechatArticleKeys.all, "detail", snapshotId] as const,
};

/**
 * Knowledge Link Query Keys
 */
export const knowledgeLinkKeys = {
  all: ["knowledgeLink"] as const,
  related: (
    bookmarkId: number,
    params: { limit: number; minStrength: number; types?: string[] },
  ) => [...knowledgeLinkKeys.all, "related", bookmarkId, params] as const,
};

/**
 * Knowledge Studio Blueprint Query Keys
 */
export const blueprintKeys = {
  all: ["blueprints"] as const,
  list: () => [...blueprintKeys.all, "list"] as const,
};
