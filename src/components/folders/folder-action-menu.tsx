/**
 * 文件夹操作菜单组件
 * 提供重命名、合并、停用、删除等操作
 */

"use client";

import { useState, useEffect } from "react";
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
  Lock,
  Unlock,
  Folder,
  Pin,
  Download,
  Sparkles,
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
import { useUser } from "@/contexts/user-context";
import { folderCacheInvalidation } from "@/lib/cache";
import type {
  Folder as FolderType,
  FolderGroup,
  FolderDisplayGroup,
} from "@/types/supabase";

type FolderWithCount = FolderType & {
  bookmark_count?: number;
};

/**
 * V4.2.1: 初始锁状态（从批量查询结果传入）
 */
interface InitialLockStatus {
  isLocked: boolean;
  isAiRenamable: boolean;
}

interface FolderActionMenuProps {
  folder: FolderWithCount;
  allFolders: FolderWithCount[];
  onActionComplete?: () => void;
  onFolderDeleted?: (folderId: number) => void;
  onFolderRenamed?: (folderId: number, newName: string) => void;
  onFolderMerged?: (
    sourceFolderId: number,
    targetFolderId: number,
    movedCount: number,
  ) => void;
  /** 导出文件夹内书签回调 */
  onExportFolder?: (folderId: number) => void;
  /** 打开 AI 助手回调（传入当前文件夹上下文） */
  onOpenAIAssistant?: (folder: FolderWithCount) => void;
  /**
   * V4.2.1: 从父组件批量查询结果传入的初始锁状态
   * 如果提供，则跳过单独的 API 请求
   */
  initialLockStatus?: InitialLockStatus;
}

// 文件夹分组配置（包含 UI 显示用的虚拟分组）
const FOLDER_GROUPS: Record<
  FolderDisplayGroup,
  { label: string; icon: typeof Folder }
> = {
  default: {
    label: "默认",
    icon: Folder,
  },
  pinned: {
    label: "已固定",
    icon: Pin,
  },
  archived: {
    label: "已归档",
    icon: Archive,
  },
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

// 可用于数据库存储的有效分组（用于"移至类别"菜单）
const VALID_FOLDER_GROUPS: FolderGroup[] = [
  "work",
  "study",
  "life",
  "entertainment",
  "other",
];

export function FolderActionMenu({
  folder,
  allFolders,
  onActionComplete,
  onFolderDeleted,
  onFolderRenamed,
  onFolderMerged,
  onExportFolder,
  onOpenAIAssistant,
  initialLockStatus,
}: FolderActionMenuProps) {
  const router = useRouter();
  const { fetchWithAbort } = useAbortableFetch();
  const { user } = useUser();
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [isReclassifying, setIsReclassifying] = useState(false);

  // 系统文件夹限制
  const isSystemFolder = folder.is_system ?? false;
  const isInboxFolder = folder.system_type === "INBOX";
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
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

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
      // 清除文件夹缓存
      if (user?.id) {
        folderCacheInvalidation.onFolderGroupChange(user.id);
      }
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
      // 清除文件夹缓存
      if (user?.id) {
        folderCacheInvalidation.onAnyChange(user.id);
      }
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
      // 清除文件夹缓存
      if (user?.id) {
        folderCacheInvalidation.onAnyChange(user.id);
      }
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

  // V4.2.1: 获取锁定状态
  // 优先使用父组件批量查询的结果，否则才进行单独请求
  // P0-5 修复：添加 AbortController 避免内存泄漏
  useEffect(() => {
    // 如果父组件已提供锁状态，直接使用
    if (initialLockStatus !== undefined) {
      setIsLocked(initialLockStatus.isLocked);
      return;
    }

    // 否则进行单独请求（兜底逻辑）
    const abortController = new AbortController();

    const fetchLockStatus = async () => {
      try {
        const res = await fetch(`/api/folders/${folder.id}/lock`, {
          signal: abortController.signal,
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setIsLocked(data.data.isLocked);
          }
        }
      } catch (err) {
        // 忽略 AbortError，静默处理其他错误
        if (err instanceof Error && err.name !== "AbortError") {
          // 默认为未锁定
        }
      }
    };

    if (!isSystemFolder) {
      fetchLockStatus();
    }

    // Cleanup: 取消进行中的请求
    return () => {
      abortController.abort();
    };
  }, [folder.id, isSystemFolder, initialLockStatus]);

  // 处理锁定/解锁
  const handleToggleLock = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLocking(true);

    try {
      const res = await fetchWithAbort(`/api/folders/${folder.id}/lock`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ locked: !isLocked }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "操作失败");
      }

      setIsLocked(!isLocked);
      toast.success(data.data.message);
      // 清除文件夹缓存
      if (user?.id) {
        folderCacheInvalidation.onAnyChange(user.id);
      }
      onActionComplete?.();
      router.refresh();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      const message = err instanceof Error ? err.message : "操作失败";
      toast.error(message);
    } finally {
      setIsLocking(false);
    }
  };

  // 处理一键分类（仅限待整理文件夹）
  // 注意：不使用 fetchWithAbort，因为菜单关闭后请求会被取消
  const handleReclassify = async () => {
    setIsReclassifying(true);

    // 使用持久化 toast 显示进度
    const toastId = toast.loading(
      `正在为 ${folder.bookmark_count} 个书签执行 AI 分类...`,
      {
        description: "AI 正在分析内容并匹配最佳文件夹",
      },
    );

    try {
      const res = await fetch("/api/reclassify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ forceRun: true }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "一键分类失败");
      }

      const { movedCount, suggestionsCreated, processed, message } = data.data;

      // 清除文件夹缓存，确保 bookmark_count 更新
      if (user?.id) {
        folderCacheInvalidation.onAnyChange(user.id);
      }

      // 根据结果更新 toast
      if (movedCount > 0) {
        toast.success(`✅ 分类完成`, {
          id: toastId,
          description: message,
          duration: 5000,
        });
      } else if (suggestionsCreated > 0) {
        toast.success(`📋 已生成分类建议`, {
          id: toastId,
          description: `${message}，请前往消息中心查看`,
          duration: 5000,
        });
      } else if (processed > 0) {
        toast.info(`分析完成`, {
          id: toastId,
          description: `已分析 ${processed} 个书签，${message}`,
          duration: 4000,
        });
      } else {
        toast.info(message, {
          id: toastId,
          duration: 3000,
        });
      }

      onActionComplete?.();
      router.refresh();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "一键分类失败";
      toast.error("分类失败", {
        id: toastId,
        description: errorMessage,
        duration: 5000,
      });
    } finally {
      setIsReclassifying(false);
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

          {/* 导出文件夹书签 */}
          {onExportFolder && hasBookmarks && (
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onExportFolder(folder.id);
              }}
              className="text-teal-600 dark:text-teal-400"
            >
              <Download className="size-4 mr-2" />
              导出
              <span className="ml-auto text-xs">({folder.bookmark_count})</span>
            </DropdownMenuItem>
          )}

          {/* 一键分类（仅限待整理文件夹） */}
          {isInboxFolder && hasBookmarks && (
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                handleReclassify();
              }}
              disabled={isReclassifying}
              className="text-violet-600 dark:text-violet-400"
            >
              {isReclassifying ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="size-4 mr-2" />
              )}
              一键分类
              <span className="ml-auto text-xs">({folder.bookmark_count})</span>
            </DropdownMenuItem>
          )}

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
              {VALID_FOLDER_GROUPS.map((groupKey) => {
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

          {/* AI 锁定/解锁 */}
          <DropdownMenuItem
            onClick={handleToggleLock}
            disabled={isSystemFolder || isLocking}
          >
            {isLocking ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : isLocked ? (
              <Unlock className="size-4 mr-2" />
            ) : (
              <Lock className="size-4 mr-2" />
            )}
            {isLocked ? "解锁 AI 管理" : "锁定 AI 管理"}
            {isSystemFolder && (
              <span className="ml-auto text-xs text-muted-foreground">
                系统
              </span>
            )}
          </DropdownMenuItem>

          {/* AI 协助管理（可选） */}
          {onOpenAIAssistant && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenAIAssistant(folder);
                }}
                className="text-violet-600 dark:text-violet-400"
              >
                <Sparkles className="size-4 mr-2" />
                AI 协助管理
              </DropdownMenuItem>
            </>
          )}

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
        onMerged={(sourceFolderId, targetFolderId, movedCount) =>
          onFolderMerged?.(sourceFolderId, targetFolderId, movedCount)
        }
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
