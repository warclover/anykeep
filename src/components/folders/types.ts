/**
 * 收藏夹组件共享类型定义
 */

import type { Bookmark } from "@/types/supabase";
import type { UIFolderGroup } from "./constants";
import type { FolderWithStats } from "@/types/domain";

// ==================== 文件夹类型 ====================

/**
 * 带统计信息的文件夹类型
 *
 * @deprecated 请从 "@/types/domain" 导入 FolderWithStats
 * 保留此导出是为了向后兼容
 */
export type { FolderWithStats } from "@/types/domain";

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

// ==================== 选择状态类型 (v2.0 重构) ====================

/**
 * 文件夹选择状态
 * - group: 选中分组，显示该分组下所有文件夹的书签
 * - folder: 选中单个文件夹，显示该文件夹的书签
 * - system: 选中系统文件夹
 */
export type FolderSelection =
  | { type: "group"; groupId: UIFolderGroup }
  | { type: "folder"; folderId: number }
  | { type: "system"; folderId: number };

/**
 * 获取选择状态的唯一标识符（用于缓存 Key）
 */
export function getSelectionKey(selection: FolderSelection): string {
  switch (selection.type) {
    case "group":
      return `group:${selection.groupId}`;
    case "folder":
      return `folder:${selection.folderId}`;
    case "system":
      return `system:${selection.folderId}`;
  }
}

/**
 * 根据选择状态获取书签查询参数
 */
export function getBookmarkQueryParams(
  selection: FolderSelection,
  folders: FolderWithStats[],
): { folder_ids?: number[] } {
  switch (selection.type) {
    case "folder":
    case "system":
      return { folder_ids: [selection.folderId] };
    case "group": {
      // 获取该分组下所有文件夹的 ID
      const groupFolderIds = folders
        .filter(
          (f) =>
            !f.is_archived &&
            !f.is_system &&
            (f.folder_group || "other") === selection.groupId,
        )
        .map((f) => f.id);
      return groupFolderIds.length > 0 ? { folder_ids: groupFolderIds } : {};
    }
  }
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
  /** 导出文件夹内书签 */
  onExportFolder?: (folderId: number) => void;
}
