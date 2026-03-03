/**
 * 书签操作菜单子组件
 *
 * 提取为独立 memo 组件，避免父组件渲染时重建引用
 */

"use client";

import { memo } from "react";
import {
  MoreVertical,
  Edit,
  Trash2,
  ExternalLink,
  Circle,
  CheckCircle2,
  Star,
  FolderInput,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SnapshotMenuItem, useSnapshotFeature } from "@/components/snapshot";
import { TTSPlayerButton } from "@/components/tts";
import { cn } from "@/lib/utils";
import type { ActionMenuProps } from "./bookmark-card-types";

export { useSnapshotFeature };

export const BookmarkActionMenu = memo(function BookmarkActionMenu({
  className = "",
  variant: menuVariant = "default",
  bookmark,
  isSnapshotEnabled,
  isDeleting,
  onOpenOriginal,
  onToggleRead,
  onToggleStarred,
  onEdit,
  onMove,
  onDelete,
  t,
}: ActionMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button
          variant="secondary"
          size="icon"
          className={cn(
            "h-8 w-8 bg-white/95 hover:bg-white dark:bg-gray-800/95 dark:hover:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-600",
            menuVariant === "mobile" && "h-9 w-9",
            className,
          )}
        >
          <MoreVertical className="h-4 w-4 text-gray-600 dark:text-gray-300" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onOpenOriginal}>
          <ExternalLink className="mr-2 h-4 w-4" />
          {t.bookmark.openOriginal}
        </DropdownMenuItem>
        {/* TTS 语音朗读 */}
        {bookmark.ai_summary && (
          <TTSPlayerButton
            bookmarkId={bookmark.id}
            variant="menu-item"
            disabled={!bookmark.ai_summary}
          />
        )}
        {/* V4.2.1: 快照功能入口 */}
        {isSnapshotEnabled && (
          <SnapshotMenuItem
            bookmarkId={bookmark.id}
            bookmarkUrl={bookmark.url}
            hasSnapshot={(bookmark as { has_snapshot?: boolean }).has_snapshot}
            snapshotStatus={
              (bookmark as { snapshot_status?: string }).snapshot_status as
                | "pending"
                | "processing"
                | "completed"
                | "failed"
                | null
            }
          />
        )}
        {onToggleRead && (
          <DropdownMenuItem onClick={onToggleRead}>
            {bookmark.is_read ? (
              <>
                <Circle className="mr-2 h-4 w-4" />
                {t.bookmark.markAsUnread}
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {t.bookmark.markAsRead}
              </>
            )}
          </DropdownMenuItem>
        )}
        {onToggleStarred && (
          <DropdownMenuItem onClick={onToggleStarred}>
            {bookmark.is_starred ? (
              <>
                <Star className="mr-2 h-4 w-4 fill-yellow-400 text-yellow-400" />
                {t.bookmark.removeStar}
              </>
            ) : (
              <>
                <Star className="mr-2 h-4 w-4" />
                {t.bookmark.addStar}
              </>
            )}
          </DropdownMenuItem>
        )}
        {onEdit && (
          <DropdownMenuItem onClick={onEdit}>
            <Edit className="mr-2 h-4 w-4" />
            {t.common.edit}
          </DropdownMenuItem>
        )}
        {onMove && (
          <DropdownMenuItem onClick={onMove}>
            <FolderInput className="mr-2 h-4 w-4" />
            {t.bookmark.move}
          </DropdownMenuItem>
        )}
        {onDelete && (
          <DropdownMenuItem
            onClick={onDelete}
            className="text-red-600 dark:text-red-400"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {isDeleting ? t.bookmark.deleting : t.common.delete}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
