/**
 * 文件夹书签区域 - 类型、常量、工具函数
 */

import { FolderOpen, LayoutGrid, List, ListCollapse } from "lucide-react";
import { FOLDER_GROUPS, getCategoryEmoji } from "./constants";
import type { FolderSelection, FolderWithStats } from "./types";
import type { FolderCategory } from "@/types/domain";

// ==================== 类型定义 ====================

export type SortOption = "created" | "title" | "updated";
export type ViewMode = "card" | "list" | "compact";

// ==================== 排序配置 ====================

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "created", label: "添加时间" },
  { value: "title", label: "标题" },
  { value: "updated", label: "更新时间" },
];

export const VIEW_OPTIONS: {
  value: ViewMode;
  label: string;
  icon: typeof LayoutGrid;
}[] = [
  { value: "card", label: "卡片", icon: LayoutGrid },
  { value: "list", label: "列表", icon: List },
  { value: "compact", label: "紧凑", icon: ListCollapse },
];

// ==================== 工具函数 ====================

/** 导出供页面工具栏使用 */
export function getSelectionInfo(
  selection: FolderSelection,
  folders: FolderWithStats[],
  categories: FolderCategory[] = [],
): {
  title: string;
  titleEmoji: string | null;
  icon: typeof FolderOpen;
  colors: { gradient: { from: string; to: string } };
  categoryColor: string | null;
  bookmarkCount: number;
} {
  switch (selection.type) {
    case "category": {
      const category = categories.find((c) => c.id === selection.categoryId);
      const catFolders = folders.filter(
        (f) =>
          !f.is_archived &&
          !f.is_system &&
          f.category_id === selection.categoryId,
      );
      const bookmarkCount = catFolders.reduce(
        (sum, f) => sum + (f.bookmark_count || 0),
        0,
      );
      return {
        title: category?.name || "未知栏目",
        titleEmoji: getCategoryEmoji(category?.icon),
        icon: FolderOpen,
        colors: FOLDER_GROUPS.other.colors,
        categoryColor: category?.color || null,
        bookmarkCount,
      };
    }
    case "group": {
      const config = FOLDER_GROUPS[selection.groupId];
      const groupFolders = folders.filter(
        (f) =>
          !f.is_archived &&
          !f.is_system &&
          (f.folder_group || "other") === selection.groupId,
      );
      const bookmarkCount = groupFolders.reduce(
        (sum, f) => sum + (f.bookmark_count || 0),
        0,
      );
      return {
        title: config?.label || "未知分组",
        titleEmoji: null,
        icon: config?.icon || FolderOpen,
        colors: config?.colors || FOLDER_GROUPS.other.colors,
        categoryColor: null,
        bookmarkCount,
      };
    }
    case "folder":
    case "system": {
      const folder = folders.find((f) => f.id === selection.folderId);
      return {
        title: folder?.name || "未知文件夹",
        titleEmoji: null,
        icon: FolderOpen,
        colors: folder?.is_system
          ? FOLDER_GROUPS.default.colors
          : FOLDER_GROUPS[folder?.folder_group || "other"]?.colors ||
            FOLDER_GROUPS.other.colors,
        categoryColor: null,
        bookmarkCount: folder?.bookmark_count || 0,
      };
    }
  }
}
