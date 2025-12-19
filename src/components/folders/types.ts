/**
 * 收藏夹组件共享类型定义
 */

import type { Folder, Bookmark } from "@/types/supabase";
import type { UIFolderGroup } from "./constants";

// ==================== 文件夹类型 ====================

/** 带统计信息的文件夹类型 */
export type FolderWithStats = Folder & {
  bookmark_count: number;
  today_count: number;
  is_archived?: boolean;
  is_locked?: boolean;
};

// ==================== 锁定状态类型 ====================

/** 锁定状态 */
export interface LockStatus {
  isLocked: boolean;
  isAiRenamable: boolean;
}

/** 锁定状态映射 */
export type LockStatusMap = Record<string, LockStatus>;

// ==================== 书签类型 ====================

/** 带文件夹信息的书签 */
export type BookmarkWithFolder = Bookmark & {
  folders?: { name: string } | null;
};

// ==================== 分组类型 ====================

/** 分组后的文件夹结构 */
export interface GroupedFolders {
  system: FolderWithStats[];
  groups: Record<UIFolderGroup, FolderWithStats[]>;
  archived: FolderWithStats[];
}

// ==================== 组件 Props 类型 ====================

/** 文件夹操作回调 */
export interface FolderActionCallbacks {
  onActionComplete?: () => void;
  onFolderDeleted?: (folderId: number) => void;
  onFolderRenamed?: (folderId: number, newName: string) => void;
  onFolderMerged?: (
    sourceFolderId: number,
    targetFolderId: number,
    movedCount: number,
  ) => void;
}
