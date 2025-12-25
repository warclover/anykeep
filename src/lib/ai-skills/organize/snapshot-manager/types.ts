/**
 * 整理操作快照类型定义
 *
 * 为 BatchOrganize Skill 提供撤销支持的类型定义
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import type { OrganizeAction } from "@/lib/ai-skills/skills/batch-organize/types";

// ============================================
// 快照操作类型（扩展现有 OperationSnapshotAction）
// ============================================

/**
 * 整理快照动作类型
 * 映射到 operation_snapshots 表的 action 字段
 */
export type OrganizeSnapshotAction =
  | "batch_categorize" // 批量分类
  | "batch_tag" // 批量打标签
  | "batch_dedupe" // 批量去重
  | "batch_archive" // 批量归档
  | "batch_delete"; // 批量删除

/**
 * OrganizeAction 到快照动作的映射
 */
export const ORGANIZE_ACTION_TO_SNAPSHOT: Record<
  OrganizeAction,
  OrganizeSnapshotAction | null
> = {
  "auto-categorize": "batch_categorize",
  "auto-tag": "batch_tag",
  "clean-duplicates": "batch_dedupe",
  "archive-old": "batch_archive",
  "validate-urls": null, // 验证链接不需要快照
};

// ============================================
// 书签状态快照
// ============================================

/**
 * 单个书签的状态快照
 */
export interface BookmarkStateSnapshot {
  /** 书签 ID */
  id: number;
  /** 标题 */
  title: string;
  /** URL */
  url: string;
  /** 文件夹 ID */
  folderId: number | null;
  /** AI 标签列表 */
  aiTags: string[];
  /** 是否在回收站 */
  isInTrash: boolean;
  /** 是否标星 */
  isStarred: boolean;
}

/**
 * 文件夹状态快照
 */
export interface FolderStateSnapshot {
  /** 文件夹 ID */
  id: number;
  /** 名称 */
  name: string;
  /** 父文件夹 ID */
  parentId: number | null;
}

// ============================================
// 整理操作快照
// ============================================

/**
 * 分类操作快照
 */
export interface CategorizeOperationSnapshot {
  /** 操作类型 */
  action: "batch_categorize";
  /** 书签状态（操作前） */
  beforeStates: BookmarkStateSnapshot[];
  /** 书签状态（操作后） */
  afterStates: BookmarkStateSnapshot[];
  /** 新创建的文件夹 */
  createdFolders: FolderStateSnapshot[];
}

/**
 * 打标签操作快照
 */
export interface TagOperationSnapshot {
  /** 操作类型 */
  action: "batch_tag";
  /** 书签状态（操作前） */
  beforeStates: BookmarkStateSnapshot[];
  /** 书签状态（操作后） */
  afterStates: BookmarkStateSnapshot[];
}

/**
 * 去重操作快照
 */
export interface DedupeOperationSnapshot {
  /** 操作类型 */
  action: "batch_dedupe";
  /** 被删除的书签（完整数据，用于恢复） */
  deletedBookmarks: BookmarkStateSnapshot[];
  /** 保留的书签 ID */
  keptBookmarkIds: number[];
}

/**
 * 归档操作快照
 * 注意：归档通过移动到回收站实现
 */
export interface ArchiveOperationSnapshot {
  /** 操作类型 */
  action: "batch_archive";
  /** 被归档的书签状态 */
  archivedBookmarks: BookmarkStateSnapshot[];
}

/**
 * 删除操作快照
 */
export interface DeleteOperationSnapshot {
  /** 操作类型 */
  action: "batch_delete";
  /** 被删除的书签（完整数据，用于恢复） */
  deletedBookmarks: BookmarkStateSnapshot[];
}

/**
 * 整理操作快照联合类型
 */
export type OrganizeOperationSnapshot =
  | CategorizeOperationSnapshot
  | TagOperationSnapshot
  | DedupeOperationSnapshot
  | ArchiveOperationSnapshot
  | DeleteOperationSnapshot;

// ============================================
// 快照元数据
// ============================================

/**
 * 快照记录
 */
export interface OrganizeSnapshot {
  /** 快照 ID */
  id: string;
  /** 用户 ID */
  userId: string;
  /** 操作类型 */
  action: OrganizeSnapshotAction;
  /** 操作前状态（JSON） */
  beforeState: OrganizeOperationSnapshot;
  /** 操作后状态（JSON） */
  afterState: OrganizeOperationSnapshot | null;
  /** 影响的书签 ID 列表 */
  bookmarkIds: number[];
  /** 原因/描述 */
  reason: string | null;
  /** 创建时间 */
  createdAt: Date;
  /** 过期时间 */
  expiresAt: Date;
  /** 是否已撤销 */
  isUndone: boolean;
  /** 撤销时间 */
  undoneAt: Date | null;
  /** 是否可撤销 */
  canUndo: boolean;
}

/**
 * 创建快照的输入参数
 */
export interface CreateSnapshotInput {
  /** 用户 ID */
  userId: string;
  /** 操作类型 */
  action: OrganizeSnapshotAction;
  /** 操作前状态 */
  beforeState: OrganizeOperationSnapshot;
  /** 影响的书签 ID 列表 */
  bookmarkIds: number[];
  /** 原因/描述 */
  reason?: string;
  /** 过期时间（默认 7 天） */
  expiresInDays?: number;
}

/**
 * 更新快照的输入参数
 */
export interface UpdateSnapshotInput {
  /** 操作后状态 */
  afterState?: OrganizeOperationSnapshot;
  /** 是否已撤销 */
  isUndone?: boolean;
}

// ============================================
// 撤销结果
// ============================================

/**
 * 撤销操作结果
 */
export interface UndoResult {
  /** 是否成功 */
  success: boolean;
  /** 恢复的书签数量 */
  restoredCount: number;
  /** 错误信息（如果失败） */
  error?: string;
  /** 详细信息 */
  details?: {
    /** 恢复的书签 ID */
    restoredBookmarkIds: number[];
    /** 恢复的文件夹 ID */
    restoredFolderIds?: number[];
    /** 删除的文件夹 ID（如果撤销分类操作） */
    deletedFolderIds?: number[];
  };
}

// ============================================
// 配置
// ============================================

/**
 * 快照管理器配置
 */
export interface SnapshotManagerConfig {
  /** 默认过期天数 */
  defaultExpirationDays: number;
  /** 最大快照数量（每用户） */
  maxSnapshotsPerUser: number;
  /** 是否启用自动清理 */
  enableAutoCleanup: boolean;
}

/**
 * 默认配置
 */
export const DEFAULT_SNAPSHOT_CONFIG: SnapshotManagerConfig = {
  defaultExpirationDays: 7,
  maxSnapshotsPerUser: 100,
  enableAutoCleanup: true,
};
