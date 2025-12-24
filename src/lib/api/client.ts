/**
 * API Client - 统一 API 调用入口
 * @description Phase 2 架构优化 - 类型安全的 API 客户端
 * @version 1.0.0
 *
 * 设计原则：
 * - 基于现有 fetchWithAuth 构建
 * - 类型安全的请求和响应
 * - 统一错误处理
 * - 支持请求拦截和日志
 */

import { fetchJsonWithAuth } from "./fetch-with-auth";
import { API_CLASSIFICATION } from "@/lib/constants/api-paths";
import type { Bookmark, Folder } from "@/types/supabase";
import type { SmartListClient } from "@/types/smart-list";

// ============================================================================
// 通用类型
// ============================================================================

/** API 响应基础结构 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: { message: string; code?: string };
}

/** 分页参数 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

/** 排序参数 */
export interface SortParams {
  sort?: string;
  order?: "asc" | "desc";
}

// ============================================================================
// Bookmark API 类型
// ============================================================================

/** 书签列表参数 */
export interface BookmarkListParams extends PaginationParams, SortParams {
  platform?: string;
  folder?: string;
  usageTags?: string[];
  search?: string;
}

/** 创建书签参数 */
export interface CreateBookmarkParams {
  url: string;
  title?: string;
  description?: string;
  platform?: string;
  folder_id?: number | null;
  usage_tags?: string[];
}

/** 更新书签参数 */
export interface UpdateBookmarkParams {
  title?: string;
  description?: string;
  folder_id?: number | null;
  usage_tags?: string[];
  is_read?: boolean;
  is_starred?: boolean;
}

/** 批量移动书签参数 */
export interface BatchMoveParams {
  bookmarkIds: number[];
  folderId: number | null;
}

/** 批量删除书签参数 */
export interface BatchDeleteParams {
  bookmarkIds: number[];
}

// ============================================================================
// Folder API 类型
// ============================================================================

/** 创建文件夹参数 */
export interface CreateFolderParams {
  name: string;
  parent_id?: number | null;
  color?: string;
  icon?: string;
}

/** 更新文件夹参数 */
export interface UpdateFolderParams {
  name?: string;
  parent_id?: number | null;
  color?: string;
  icon?: string;
}

/** 文件夹重排序参数 */
export interface ReorderFoldersParams {
  folders: { id: number; order: number }[];
}

// ============================================================================
// Init API 类型
// ============================================================================

/** 初始化数据参数 */
export interface InitDataParams {
  platform?: string;
  sort?: string;
  folder?: string;
}

/** 未读消息计数 */
export interface UnreadCounts {
  total: number;
  silent: number;
  normal: number;
  important: number;
}

/** 初始化数据响应 */
export interface InitData {
  bookmarks: Bookmark[];
  smartLists: SmartListClient[];
  unreadCount: UnreadCounts;
  folders: (Folder & { children?: Folder[] })[];
  _meta?: {
    authMethod: string;
    authDuration: number;
    dataDuration: number;
    totalDuration: number;
  };
}

// ============================================================================
// API Client 实现
// ============================================================================

/**
 * 构建 URL 查询字符串
 */
function buildQueryString<T extends object>(params: T): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    if (Array.isArray(value)) {
      if (value.length > 0) {
        searchParams.set(key, value.join(","));
      }
    } else {
      searchParams.set(key, String(value));
    }
  });

  return searchParams.toString();
}

/**
 * 统一请求方法
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const { data, error } = await fetchJsonWithAuth<ApiResponse<T>>(
    endpoint,
    options,
  );

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Empty response");
  }

  if (!data.success) {
    throw new Error(data.error?.message || "API request failed");
  }

  return data.data;
}

/**
 * API Client 单例
 *
 * @example
 * ```typescript
 * // 获取书签列表
 * const bookmarks = await apiClient.bookmarks.list({ platform: 'WECHAT' });
 *
 * // 创建书签
 * const bookmark = await apiClient.bookmarks.create({ url: 'https://...' });
 *
 * // 获取初始化数据
 * const initData = await apiClient.init.getData({ platform: 'WECHAT' });
 * ```
 */
export const apiClient = {
  // ========================================
  // 书签 API
  // ========================================
  bookmarks: {
    /**
     * 获取书签列表
     */
    list: async (params: BookmarkListParams = {}): Promise<Bookmark[]> => {
      const query = buildQueryString(params);
      const url = query ? `/api/bookmarks?${query}` : "/api/bookmarks";
      return request<Bookmark[]>(url);
    },

    /**
     * 获取单个书签
     */
    get: async (id: number): Promise<Bookmark> => {
      return request<Bookmark>(`/api/bookmarks/${id}`);
    },

    /**
     * 创建书签
     */
    create: async (params: CreateBookmarkParams): Promise<Bookmark> => {
      return request<Bookmark>("/api/bookmarks", {
        method: "POST",
        body: JSON.stringify(params),
      });
    },

    /**
     * 更新书签
     */
    update: async (
      id: number,
      params: UpdateBookmarkParams,
    ): Promise<Bookmark> => {
      return request<Bookmark>(`/api/bookmarks/${id}`, {
        method: "PATCH",
        body: JSON.stringify(params),
      });
    },

    /**
     * 删除书签
     */
    delete: async (id: number): Promise<void> => {
      return request<void>(`/api/bookmarks/${id}`, {
        method: "DELETE",
      });
    },

    /**
     * 批量移动书签
     */
    batchMove: async (params: BatchMoveParams): Promise<void> => {
      return request<void>("/api/bookmarks/batch-move", {
        method: "POST",
        body: JSON.stringify(params),
      });
    },

    /**
     * 批量删除书签
     */
    batchDelete: async (params: BatchDeleteParams): Promise<void> => {
      return request<void>("/api/bookmarks/batch-delete", {
        method: "POST",
        body: JSON.stringify(params),
      });
    },
  },

  // ========================================
  // 文件夹 API
  // ========================================
  folders: {
    /**
     * 获取文件夹列表（树形结构）
     */
    list: async (): Promise<(Folder & { children?: Folder[] })[]> => {
      return request<(Folder & { children?: Folder[] })[]>("/api/folders");
    },

    /**
     * 获取单个文件夹
     */
    get: async (id: number): Promise<Folder> => {
      return request<Folder>(`/api/folders/${id}`);
    },

    /**
     * 创建文件夹
     */
    create: async (params: CreateFolderParams): Promise<Folder> => {
      return request<Folder>("/api/folders", {
        method: "POST",
        body: JSON.stringify(params),
      });
    },

    /**
     * 更新文件夹
     */
    update: async (id: number, params: UpdateFolderParams): Promise<Folder> => {
      return request<Folder>(`/api/folders/${id}`, {
        method: "PATCH",
        body: JSON.stringify(params),
      });
    },

    /**
     * 删除文件夹
     */
    delete: async (id: number): Promise<void> => {
      return request<void>(`/api/folders/${id}`, {
        method: "DELETE",
      });
    },

    /**
     * 重排序文件夹
     */
    reorder: async (params: ReorderFoldersParams): Promise<void> => {
      return request<void>("/api/folders/reorder", {
        method: "POST",
        body: JSON.stringify(params),
      });
    },

    /**
     * 获取文件夹建议
     */
    suggestions: async (
      bookmarkId?: number,
    ): Promise<{ folders: Folder[]; reason: string }[]> => {
      const url = bookmarkId
        ? `/api/folders/suggestions?bookmarkId=${bookmarkId}`
        : "/api/folders/suggestions";
      return request<{ folders: Folder[]; reason: string }[]>(url);
    },
  },

  // ========================================
  // 初始化数据 API
  // ========================================
  init: {
    /**
     * 获取首页初始化数据（聚合 API）
     */
    getData: async (params: InitDataParams = {}): Promise<InitData> => {
      const query = buildQueryString(params);
      const url = query ? `/api/init?${query}` : "/api/init";
      return request<InitData>(url);
    },
  },

  // ========================================
  // 智能列表 API
  // ========================================
  smartLists: {
    /**
     * 获取智能列表
     */
    list: async (): Promise<SmartListClient[]> => {
      return request<SmartListClient[]>("/api/smart-lists");
    },

    /**
     * 获取单个智能列表
     */
    get: async (id: number): Promise<SmartListClient> => {
      return request<SmartListClient>(`/api/smart-lists/${id}`);
    },

    /**
     * 创建智能列表
     */
    create: async (
      params: Partial<SmartListClient>,
    ): Promise<SmartListClient> => {
      return request<SmartListClient>("/api/smart-lists", {
        method: "POST",
        body: JSON.stringify(params),
      });
    },

    /**
     * 更新智能列表
     */
    update: async (
      id: number,
      params: Partial<SmartListClient>,
    ): Promise<SmartListClient> => {
      return request<SmartListClient>(`/api/smart-lists/${id}`, {
        method: "PATCH",
        body: JSON.stringify(params),
      });
    },

    /**
     * 删除智能列表
     */
    delete: async (id: number): Promise<void> => {
      return request<void>(`/api/smart-lists/${id}`, {
        method: "DELETE",
      });
    },
  },

  // ========================================
  // 消息 API
  // ========================================
  messages: {
    /**
     * 获取未读消息数量
     */
    getUnreadCount: async (): Promise<UnreadCounts> => {
      return request<UnreadCounts>("/api/messages/unread-count");
    },

    /**
     * 标记消息为已读
     */
    markAsRead: async (messageId: number): Promise<void> => {
      return request<void>(`/api/messages/${messageId}/read`, {
        method: "POST",
      });
    },

    /**
     * 批量标记消息为已读
     */
    batchMarkAsRead: async (messageIds: number[]): Promise<void> => {
      return request<void>("/api/messages/batch-read", {
        method: "POST",
        body: JSON.stringify({ messageIds }),
      });
    },
  },

  // ========================================
  // 分类 API
  // ========================================
  classification: {
    /**
     * 触发书签分类
     */
    classify: async (
      bookmarkId: number,
    ): Promise<{ folderId: number | null; confidence: number }> => {
      return request<{ folderId: number | null; confidence: number }>(
        API_CLASSIFICATION.classify,
        {
          method: "POST",
          body: JSON.stringify({ bookmarkId }),
        },
      );
    },

    /**
     * 获取分类状态
     */
    getStatus: async (
      bookmarkId: number,
    ): Promise<{ status: string; progress: number }> => {
      return request<{ status: string; progress: number }>(
        `/api/classification/status/${bookmarkId}`,
      );
    },
  },
};

// 导出类型
export type ApiClient = typeof apiClient;
