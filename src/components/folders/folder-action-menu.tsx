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
  ArrowLeft,
  ArrowRight,
  ChevronsLeft,
  ChevronsRight,
  FolderInput,
  Briefcase,
  GraduationCap,
  Heart,
  Gamepad2,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { RenameFolderDialog } from "./rename-folder-dialog";
import { MergeFolderDialog } from "./merge-folder-dialog";
import { DeleteFolderDialog } from "./delete-folder-dialog";
import { useAbortableFetch } from "@/hooks/use-abortable-fetch";
import type { Folder, FolderGroup } from "@/types/supabase";

type FolderWithCount = Folder & {
  bookmark_count?: number;
};

interface FolderActionMenuProps {
  folder: FolderWithCount;
  allFolders: FolderWithCount[];
  onActionComplete?: () => void;
  onFolderDeleted?: (folderId: number) => void;
  onFolderRenamed?: (folderId: number, newName: string) => void;
}

// 文件夹分组配置
const FOLDER_GROUPS: Record<
  FolderGroup,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  work: {
    label: "工作相关",
    icon: Briefcase,
  },
  study: {
    label: "学习成长",
    icon: GraduationCap,
  },
  life: {
    label: "生活方式",
    icon: Heart,
  },
  entertainment: {
    label: "休闲娱乐",
    icon: Gamepad2,
  },
  other: {
    label: "其他收藏",
    icon: MoreHorizontal,
  },
};

export function FolderActionMenu({
  folder,
  allFolders,
  onActionComplete,
  onFolderDeleted,
  onFolderRenamed,
}: FolderActionMenuProps) {
  const router = useRouter();
  const { fetchWithAbort } = useAbortableFetch();
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isMoving, setIsMoving] = useState(false);

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

  // 获取同组文件夹（用于计算移动位置）
  const groupFolders = allFolders
    .filter((f) => !f.is_system && f.folder_group === folder.folder_group)
    .sort((a, b) => a.sort_order - b.sort_order);

  const currentIndex = groupFolders.findIndex((f) => f.id === folder.id);
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === groupFolders.length - 1;

  // 处理移至类别
  const handleMoveToGroup = async (newGroup: FolderGroup) => {
    setIsMoving(true);
    try {
      const res = await fetchWithAbort(`/api/folders/${folder.id}/move-group`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder_group: newGroup }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "移动失败");
      }

      toast.success(`已移至「${FOLDER_GROUPS[newGroup].label}」`);
      onActionComplete?.();
      router.refresh();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      const message = err instanceof Error ? err.message : "移动失败";
      toast.error(message);
    } finally {
      setIsMoving(false);
    }
  };

  // 处理同组内移动（上移/下移/置顶/置底）
  const handleMove = async (direction: "up" | "down" | "top" | "bottom") => {
    // 计算新位置
    let newIndex = currentIndex;
    switch (direction) {
      case "up":
        newIndex = Math.max(0, currentIndex - 1);
        break;
      case "down":
        newIndex = Math.min(groupFolders.length - 1, currentIndex + 1);
        break;
      case "top":
        newIndex = 0;
        break;
      case "bottom":
        newIndex = groupFolders.length - 1;
        break;
    }

    if (newIndex === currentIndex) return;

    // 重新排列
    const reordered = [...groupFolders];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(newIndex, 0, moved);

    // 生成更新列表
    const updates = reordered.map((f, index) => ({
      id: f.id,
      sort_order: index,
    }));

    setIsMoving(true);
    try {
      const res = await fetchWithAbort("/api/folders/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      if (!res.ok) {
        throw new Error("移动失败");
      }

      toast.success("移动成功");
      onActionComplete?.();
      router.refresh();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      toast.error("移动失败");
    } finally {
      setIsMoving(false);
    }
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

          <DropdownMenuSeparator />

          {/* 左移 */}
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              handleMove("up");
            }}
            disabled={isSystemFolder || isMoving || isFirst}
          >
            {isMoving ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <ArrowLeft className="size-4 mr-2" />
            )}
            左移
          </DropdownMenuItem>

          {/* 右移 */}
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              handleMove("down");
            }}
            disabled={isSystemFolder || isMoving || isLast}
          >
            {isMoving ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <ArrowRight className="size-4 mr-2" />
            )}
            右移
          </DropdownMenuItem>

          {/* 移到最左侧 */}
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              handleMove("top");
            }}
            disabled={isSystemFolder || isMoving || isFirst}
          >
            {isMoving ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <ChevronsLeft className="size-4 mr-2" />
            )}
            移到最左侧
          </DropdownMenuItem>

          {/* 移到最右侧 */}
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              handleMove("bottom");
            }}
            disabled={isSystemFolder || isMoving || isLast}
          >
            {isMoving ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <ChevronsRight className="size-4 mr-2" />
            )}
            移到最右侧
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* 移至类别 - 子菜单 */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={isSystemFolder || isMoving}>
              <FolderInput className="size-4 mr-2" />
              移至类别
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {(Object.keys(FOLDER_GROUPS) as FolderGroup[]).map((groupKey) => {
                const groupConfig = FOLDER_GROUPS[groupKey];
                const GroupIcon = groupConfig.icon;
                const isCurrent = folder.folder_group === groupKey;
                return (
                  <DropdownMenuItem
                    key={groupKey}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveToGroup(groupKey);
                    }}
                    disabled={isCurrent || isMoving}
                  >
                    <GroupIcon className="size-4 mr-2" />
                    {groupConfig.label}
                    {isCurrent && (
                      <Badge variant="secondary" className="ml-auto text-xs">
                        当前
                      </Badge>
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

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
        onRenamed={(newName) => onFolderRenamed?.(folder.id, newName)}
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
        onSuccess={() => {
          // 先触发乐观更新，再执行通用回调
          onFolderDeleted?.(folder.id);
          handleActionComplete();
        }}
      />
    </>
  );
}
