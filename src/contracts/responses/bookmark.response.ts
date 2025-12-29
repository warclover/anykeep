/**
 * Bookmark Response DTOs
 *
 * 书签 API 响应数据结构
 *
 * @module contracts/responses
 */

/**
 * 书签列表项响应
 */
export interface BookmarkListItemResponse {
  id: number;
  url: string;
  title: string;
  description: string | null;
  platform: string;
  coverUrl: string | null;
  folderId: number | null;
  aiSummary: string | null;
  aiTags: string[] | null;
  userTags: string[] | null;
  isRead: boolean;
  isStarred: boolean;
  isInTrash: boolean;
  status: string | null;
  createdAt: string;
  updatedAt: string | null;
  starredAt: string | null;
}

/**
 * 书签详情响应
 */
export interface BookmarkDetailResponse extends BookmarkListItemResponse {
  author: string | null;
  notes: string | null;
  wordCount: number | null;
  publishTime: string | null;
  contentType: string | null;
  aiContentType: string | null;
  classificationStatus: string | null;
  folder: {
    id: number;
    name: string;
  } | null;
}

/**
 * 书签列表响应（分页）
 */
export interface BookmarkListResponse {
  items: BookmarkListItemResponse[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * 书签统计响应
 */
export interface BookmarkStatsResponse {
  total: number;
  unread: number;
  starred: number;
  inTrash: number;
  byPlatform: Record<string, number>;
}

/**
 * 批量操作响应
 */
export interface BatchOperationResponse {
  success: boolean;
  affected: number;
  message: string;
}

/**
 * 用户标签列表响应
 */
export interface UserTagsResponse {
  tags: string[];
  total: number;
}
