/**
 * 收件箱 Tab 配置常量
 *
 * 定义收件箱各筛选标签的配置，包括：
 * - 标签标识、名称、图标
 * - 筛选条件生成器
 * - 描述文案
 */

import {
  Inbox,
  BookMarked,
  Star,
  AlertCircle,
  Clock,
  type LucideIcon,
} from "lucide-react";

// ==================== 类型定义 ====================

export type InboxTabId =
  | "uncategorized"
  | "unread"
  | "high-value"
  | "broken"
  | "recent";

export interface InboxTabFilter {
  folderId?: null | number;
  systemType?: string;
  isRead?: boolean;
  qualityScoreGte?: number;
  linkStatus?: string;
  createdAfter?: string;
}

export interface InboxTab {
  id: InboxTabId;
  label: string;
  icon: LucideIcon;
  description: string;
  /** 筛选条件生成器 */
  getFilter: () => InboxTabFilter;
}

// ==================== Tab 配置 ====================

export const INBOX_TABS: InboxTab[] = [
  {
    id: "uncategorized",
    label: "待分类",
    icon: Inbox,
    description: "未分配文件夹的书签",
    getFilter: () => ({ folderId: null }),
  },
  {
    id: "unread",
    label: "未读",
    icon: BookMarked,
    description: "尚未阅读的内容",
    getFilter: () => ({ isRead: false }),
  },
  {
    id: "high-value",
    label: "高价值",
    icon: Star,
    description: "质量评分较高的书签",
    getFilter: () => ({ qualityScoreGte: 0.7 }),
  },
  {
    id: "broken",
    label: "已失效",
    icon: AlertCircle,
    description: "链接已失效需处理",
    getFilter: () => ({ linkStatus: "broken" }),
  },
  {
    id: "recent",
    label: "最近",
    icon: Clock,
    description: "最近7天添加",
    getFilter: () => ({ createdAfter: "7d" }),
  },
];

export const DEFAULT_TAB: InboxTabId = "uncategorized";

// ==================== 工具函数 ====================

/**
 * 根据 Tab ID 获取 Tab 配置
 */
export function getInboxTabById(id: InboxTabId): InboxTab | undefined {
  return INBOX_TABS.find((tab) => tab.id === id);
}

/**
 * 验证是否为有效的 Tab ID
 */
export function isValidInboxTabId(id: string): id is InboxTabId {
  return INBOX_TABS.some((tab) => tab.id === id);
}

/**
 * 旧 URL 到新 URL 的映射（兼容性）
 */
export const LEGACY_URL_MAPPING: Record<string, InboxTabId> = {
  "high-value": "high-value",
  invalid: "broken",
  recent: "recent",
  unread: "unread",
};
