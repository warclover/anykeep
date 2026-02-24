/**
 * 整理中心 Tab 配置常量
 *
 * 整合原收件箱 Tab + 健康诊断 Tab，形成统一的整理入口
 *
 * @version 1.0.0
 * @since 2026-02-13
 */

import {
  Inbox,
  BookMarked,
  Star,
  AlertCircle,
  Clock,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

// ==================== 类型定义 ====================

/**
 * 整理中心 Tab ID
 * - pending: 待处理（原收件箱待分类）
 * - unread: 未读内容
 * - high-value: 高价值书签
 * - broken: 已失效链接
 * - recent: 最近添加
 * - health: 健康诊断
 */
export type OrganizeTabId =
  | "pending"
  | "unread"
  | "high-value"
  | "broken"
  | "recent"
  | "health";

export interface OrganizeTabFilter {
  folderId?: null | number;
  systemType?: string;
  isRead?: boolean;
  qualityScoreGte?: number;
  linkStatus?: string;
  createdAfter?: string;
  /**
   * 是否同时包含 is_starred=true 的书签（用 OR 逻辑与其他条件合并）
   * 高价值 tab 使用：is_starred=true OR quality_score >= threshold
   */
  includeStarred?: boolean;
}

export interface OrganizeTab {
  id: OrganizeTabId;
  label: string;
  icon: LucideIcon;
  description: string;
  /** 是否为书签列表类型 Tab（非健康诊断） */
  isBookmarkTab: boolean;
  /** 筛选条件生成器（仅书签列表 Tab 有效） */
  getFilter?: () => OrganizeTabFilter;
}

// ==================== Tab 配置 ====================

export const ORGANIZE_TABS: OrganizeTab[] = [
  {
    id: "pending",
    label: "待处理",
    icon: Inbox,
    description: "待分类的书签和智能建议",
    isBookmarkTab: true,
    getFilter: () => ({ folderId: null }),
  },
  {
    id: "unread",
    label: "未读",
    icon: BookMarked,
    description: "尚未阅读的内容",
    isBookmarkTab: true,
    getFilter: () => ({ isRead: false }),
  },
  {
    id: "high-value",
    label: "高价值",
    icon: Star,
    description: "已标记或质量评分较高的书签",
    isBookmarkTab: true,
    getFilter: () => ({ qualityScoreGte: 0.7, includeStarred: true }),
  },
  {
    id: "broken",
    label: "已失效",
    icon: AlertCircle,
    description: "链接已失效需处理",
    isBookmarkTab: true,
    getFilter: () => ({ linkStatus: "broken" }),
  },
  {
    id: "recent",
    label: "最近",
    icon: Clock,
    description: "最近7天添加",
    isBookmarkTab: true,
    getFilter: () => ({ createdAfter: "7d" }),
  },
  {
    id: "health",
    label: "健康诊断",
    icon: Sparkles,
    description: "文件夹和内容健康度分析",
    isBookmarkTab: false,
  },
];

/** 默认 Tab */
export const DEFAULT_ORGANIZE_TAB: OrganizeTabId = "pending";

// ==================== 书签列表 Tab（排除健康诊断） ====================

/**
 * 书签列表类型的 Tab 配置
 */
export const BOOKMARK_TABS = ORGANIZE_TABS.filter((tab) => tab.isBookmarkTab);

// ==================== 工具函数 ====================

/**
 * 根据 Tab ID 获取 Tab 配置
 */
export function getOrganizeTabById(id: OrganizeTabId): OrganizeTab | undefined {
  return ORGANIZE_TABS.find((tab) => tab.id === id);
}

/**
 * 验证是否为有效的 Tab ID
 */
export function isValidOrganizeTabId(id: string): id is OrganizeTabId {
  return ORGANIZE_TABS.some((tab) => tab.id === id);
}

/**
 * 判断 Tab 是否为书签列表类型
 */
export function isBookmarkTab(id: OrganizeTabId): boolean {
  const tab = getOrganizeTabById(id);
  return tab?.isBookmarkTab ?? false;
}

/**
 * 旧收件箱 Tab ID 到新 Tab ID 的映射
 */
export const INBOX_TO_ORGANIZE_MAPPING: Record<string, OrganizeTabId> = {
  uncategorized: "pending",
  unread: "unread",
  "high-value": "high-value",
  broken: "broken",
  recent: "recent",
};
