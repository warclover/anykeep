/**
 * 文件夹操作菜单组件
 * 提供重命名、合并、停用、删除等操作
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MoreVertical,
  Edit2,
  Merge,
  Trash2,
  Archive,
  ArchiveRestore,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RenameFolderDialog } from "./rename-folder-dialog";
import { MergeFolderDialog } from "./merge-folder-dialog";
import { DeleteFolderDialog } from "./delete-folder-dialog";
import { useAbortableFetch } from "@/hooks/use-abortable-fetch";
import type { Folder } from "@/types/supabase";

type FolderWithCount = Folder & {
  bookmark_count?: number;
};

interface FolderActionMenuProps {
  folder: FolderWithCount;
  allFolders: FolderWithCount[];
  onActionComplete?: () => void;
}

export function FolderActionMenu({
  folder,
  allFolders,
  onActionComplete,
}: FolderActionMenuProps) {
  const router = useRouter();
  const { fetchWithAbort } = useAbortableFetch();
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  // 系统文件夹限制
  const isSystemFolder = folder.is_system;
  const isArchived = folder.is_archived;
  const hasBookmarks = (folder.bookmark_count || 0) > 0;

  // 可合并到的目标文件夹（排除自己和系统文件夹）
  const targetFolders = allFolders.filter(
    (f) => f.id !== folder.id && !f.is_system,
  );

  const handleActionComplete = () => {
    onActionComplete?.();
  };

  // 处理停用/启用
  const handleToggleArchive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsArchiving(true);

    try {
      const res = await fetchWithAbort(`/api/folders/${folder.id}/archive`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ archived: !isArchived }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "操作失败");
      }

      toast.success(data.data.message);
      onActionComplete?.();
      router.refresh();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      const message = err instanceof Error ? err.message : "操作失败";
      toast.error(message);
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="size-4" />
            <span className="sr-only">打开菜单</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {/* 重命名 */}
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              setShowRenameDialog(true);
            }}
            disabled={isSystemFolder}
          >
            <Edit2 className="size-4 mr-2" />
            重命名
            {isSystemFolder && (
              <span className="ml-auto text-xs text-muted-foreground">
                系统
              </span>
            )}
          </DropdownMenuItem>

          {/* 合并至 */}
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              setShowMergeDialog(true);
            }}
            disabled={isSystemFolder || targetFolders.length === 0}
          >
            <Merge className="size-4 mr-2" />
            合并至...
          </DropdownMenuItem>

          {/* 停用/启用 */}
          <DropdownMenuItem
            onClick={handleToggleArchive}
            disabled={isSystemFolder || isArchiving}
          >
            {isArchiving ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : isArchived ? (
              <ArchiveRestore className="size-4 mr-2" />
            ) : (
              <Archive className="size-4 mr-2" />
            )}
            {isArchived ? "启用" : "停用"}
            {isSystemFolder && (
              <span className="ml-auto text-xs text-muted-foreground">
                系统
              </span>
            )}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* 删除 */}
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              setShowDeleteDialog(true);
            }}
            disabled={isSystemFolder}
            className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
          >
            <Trash2 className="size-4 mr-2" />
            删除
            {hasBookmarks && (
              <span className="ml-auto text-xs">({folder.bookmark_count})</span>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 重命名对话框 */}
      <RenameFolderDialog
        open={showRenameDialog}
        onOpenChange={setShowRenameDialog}
        folder={folder}
        onSuccess={handleActionComplete}
      />

      {/* 合并对话框 */}
      <MergeFolderDialog
        open={showMergeDialog}
        onOpenChange={setShowMergeDialog}
        folder={folder}
        targetFolders={targetFolders}
        onSuccess={handleActionComplete}
      />

      {/* 删除对话框 */}
      <DeleteFolderDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        folder={folder}
        targetFolders={targetFolders}
        onSuccess={handleActionComplete}
      />
    </>
  );
}
