/**
 * 文件夹 Tools 类型定义
 *
 * 复用现有 supabase 类型，仅添加 Tool 特有类型
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

// 复用现有类型
export type {
  Folder,
  FolderInsert,
  FolderUpdate,
  FolderGroup,
  FolderTreeNode,
} from "@/types/supabase";

/**
 * 文件夹摘要（用于 AI 返回）
 */
export interface FolderSummary {
  /** 文件夹 ID */
  id: number;
  /** 文件夹名称 */
  name: string;
  /** 父文件夹 ID */
  parentId: number | null;
  /** 文件夹分组 */
  group: string | null;
  /** 是否归档 */
  isArchived: boolean;
  /** 是否系统文件夹 */
  isSystem: boolean;
  /** 系统文件夹类型 */
  systemType: string | null;
  /** 排序顺序 */
  sortOrder: number | null;
  /** 书签数量 */
  bookmarkCount: number;
  /** 创建时间 */
  createdAt: string | null;
}

/**
 * 文件夹详情（包含 profile 信息）
 */
export interface FolderDetail extends FolderSummary {
  /** 热度分数 */
  heatScore: number | null;
  /** 内部相似度 */
  internalSimilarity: number | null;
  /** 边界清晰度 */
  boundaryClarity: number | null;
  /** 是否可被 AI 重命名 */
  isAiRenamable: boolean;
  /** 是否为合并候选 */
  isMergeCandidate: boolean;
  /** 是否为拆分候选 */
  isSplitCandidate: boolean;
  /** 是否被系统锁定（AI 锁定） */
  isSystemLocked: boolean;
  /** 最近书签添加时间 */
  lastBookmarkAt: string | null;
  /** profile 计算时间 */
  profileComputedAt: string | null;
  /** 核心书签数 */
  coreCount: number | null;
  /** 边缘书签数 */
  edgeCount: number | null;
  /** 热门标签 */
  topTags: string[];
  /** 最近书签标题 */
  recentTitles: string[];
}

/**
 * 书签摘要（用于文件夹内书签展示）
 */
export interface BookmarkInFolderSummary {
  /** 书签 ID */
  id: number;
  /** 书签标题 */
  title: string;
  /** 书签 URL */
  url: string;
  /** 平台来源 */
  platform: string;
  /** 摘要描述 */
  description: string | null;
  /** AI 生成摘要 */
  aiSummary: string | null;
  /** AI 生成标签 */
  aiTags: string[] | null;
  /** 用户标签 */
  userTags: string[] | null;
  /** 评分 */
  rating: number | null;
  /** 是否已读 */
  isRead: boolean;
  /** 是否收藏 */
  isStarred: boolean;
  /** 创建时间 */
  createdAt: string | null;
}

/**
 * 文件夹书签查询结果
 */
export interface FolderBookmarksResult {
  /** 文件夹名称 */
  folderName: string;
  /** 文件夹 ID */
  folderId: number;
  /** 书签列表 */
  items: BookmarkInFolderSummary[];
  /** 总数 */
  total: number;
  /** 是否有更多 */
  hasMore: boolean;
}

/**
 * 文件夹树节点（用于层级展示）
 */
export interface FolderTreeSummary extends FolderSummary {
  /** 子文件夹 */
  children: FolderTreeSummary[];
  /** 层级深度 */
  depth: number;
}
