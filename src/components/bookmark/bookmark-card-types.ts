/**
 * 书签卡片共享类型定义
 *
 * 包含：变体组件共享的 Props 类型、子组件类型
 */

import type { Bookmark, CustomUsageTag } from "@/types/supabase";
import type { BookmarkV42Fields } from "@/lib/classification-v2/types/legacy-compat";
import type { useUiText } from "@/lib/i18n";

/** 卡片视图变体 */
export type ViewVariant = "card" | "list" | "compact";

/** BookmarkCard 对外暴露的 Props */
export interface BookmarkCardProps {
  /** 书签数据（包含可选的 V4.2 扩展字段和文件夹信息） */
  bookmark: Bookmark &
    Partial<BookmarkV42Fields> & {
      folders?: { name: string } | null;
    };
  /** 编辑回调，传入书签 ID */
  onEdit?: (id: number) => void;
  /** 删除回调，传入书签 ID */
  onDelete?: (id: number) => void;
  /** 移动到文件夹回调，传入书签 ID */
  onMove?: (id: number) => void;
  /** 切换已读状态回调 */
  onToggleRead?: (id: number, isRead: boolean) => void;
  /** 切换星标状态回调 (V8.0) */
  onToggleStarred?: (id: number, isStarred: boolean) => void;
  /** 是否处于批量选择模式 */
  isSelectionMode?: boolean;
  /** 当前卡片是否被选中 */
  isSelected?: boolean;
  /** 切换选中状态回调 */
  onToggleSelect?: (id: number) => void;
  /** 视图变体：card（卡片）| list（列表）| compact（紧凑） */
  variant?: ViewVariant;
  /** 用户自定义用途标签，用于标签样式渲染 (V9.0) */
  customUsageTags?: CustomUsageTag[];
}

/** ActionMenu 内部 Props */
export interface ActionMenuProps {
  className?: string;
  variant?: "default" | "mobile";
  bookmark: Bookmark &
    Partial<BookmarkV42Fields> & {
      folders?: { name: string } | null;
    };
  isSnapshotEnabled: boolean;
  isDeleting: boolean;
  onOpenOriginal: (e: React.MouseEvent) => void;
  onToggleRead?: (e: React.MouseEvent) => void;
  onToggleStarred?: (e: React.MouseEvent) => void;
  onEdit?: (e: React.MouseEvent) => void;
  onMove?: (e: React.MouseEvent) => void;
  onDelete?: (e: React.MouseEvent) => void;
  t: ReturnType<typeof useUiText>;
}

/** 所有变体组件共享的"已计算状态" Props */
export interface BookmarkCardViewProps {
  bookmark: BookmarkCardProps["bookmark"];
  bookmarkHref: string;
  isDeleting: boolean;
  isSelected: boolean;
  isSelectionMode: boolean;
  titleLoading: boolean;
  coverImage: string;
  handleImageError: () => void;
  handleItemClick: (e: React.MouseEvent) => void;
  handlePrefetch: () => void;
  handlePrefetchCancel: () => void;
  actionMenuProps: Omit<ActionMenuProps, "className" | "variant">;
  customUsageTags: CustomUsageTag[];
  t: ReturnType<typeof useUiText>;
}
