/**
 * 智能列表 Tools 类型定义
 *
 * 复用现有 smart-list 类型，仅添加 Tool 特有类型
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

// 复用现有类型
export type {
  SmartListFilters,
  SmartList,
  SmartListClient,
  SmartListSortBy,
  SmartListColor,
  CreateSmartListRequest,
} from "@/types/smart-list";

export { toSmartListClient } from "@/types/smart-list";

/**
 * 智能列表摘要（用于 AI 返回）
 */
export interface SmartListSummary {
  id: number;
  name: string;
  icon: string;
  color: string;
  description: string | null;
  isPreset: boolean;
  isPinned: boolean;
  bookmarkCount: number;
}

/**
 * 书签摘要（用于 AI 返回）
 */
export interface BookmarkSummary {
  id: number;
  title: string;
  url: string;
  platform: string;
  description: string | null;
  aiSummary: string | null;
  aiTags: string[] | null;
  userTags: string[] | null;
  rating: number | null;
  isRead: boolean;
  isStarred: boolean;
  createdAt: string;
}

/**
 * 智能列表查询结果
 */
export interface SmartListQueryResult {
  listName: string;
  listIcon: string;
  items: BookmarkSummary[];
  total: number;
  hasMore: boolean;
}
