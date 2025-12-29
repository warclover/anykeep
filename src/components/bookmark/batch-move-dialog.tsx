/**
 * 批量移动到文件夹对话框
 * 允许用户将选中的收藏移动到指定文件夹
 * V4.2.24: 使用 useFolders Hook 统一缓存
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Folder, FolderOpen, Check } from "lucide-react";
import { toast } from "sonner";
import { useAbortableFetch } from "@/hooks/core";
import { useFolders } from "@/hooks/data";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Folder as FolderType } from "@/types/supabase";

interface FolderTreeNode extends FolderType {
  children: FolderTreeNode[];
}

interface BatchMoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: Set<number>;
  onSuccess?: () => void;
}

export function BatchMoveDialog({
  open,
  onOpenChange,
  selectedIds,
  onSuccess,
}: BatchMoveDialogProps) {
  const router = useRouter();
  const { fetchWithAbort } = useAbortableFetch();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(
    new Set(),
  );

  // V4.2.24: 使用统一的文件夹缓存 Hook（仅在对话框打开时获取）
  const {
    folders: rawFolders,
    isLoading,
    error: loadError,
  } = useFolders({ enabled: open });

  // 转换为树形结构类型
  const folders = (rawFolders || []) as FolderTreeNode[];

  const handleSubmit = async () => {
    if (selectedIds.size === 0) return;

    setIsSubmitting(true);
    try {
      // 使用 v1 API
      const res = await fetchWithAbort("/api/v1/bookmarks/batch/move", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          folderId: selectedFolderId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "移动失败");
      }

      const movedCount = data.data?.movedCount || 0;
      const targetName =
        selectedFolderId === null
          ? "根目录"
          : findFolderName(folders, selectedFolderId);

      toast.success(`成功将 ${movedCount} 条收藏移动到「${targetName}」`);
      onOpenChange(false);
      onSuccess?.();

      // 刷新页面数据
      router.refresh();
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      toast.error(error instanceof Error ? error.message : "移动失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 递归查找文件夹名称
  const findFolderName = (folders: FolderTreeNode[], id: number): string => {
    for (const folder of folders) {
      if (folder.id === id) return folder.name;
      if (folder.children.length > 0) {
        const found = findFolderName(folder.children, id);
        if (found) return found;
      }
    }
    return "未知文件夹";
  };

  // 切换文件夹展开状态
  const toggleExpand = (folderId: number) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  // 递归渲染文件夹树
  const renderFolderTree = (folders: FolderTreeNode[], level = 0) => {
    return folders.map((folder) => {
      const hasChildren = folder.children.length > 0;
      const isExpanded = expandedFolders.has(folder.id);
      const isSelected = selectedFolderId === folder.id;

      return (
        <div key={folder.id}>
          <button
            type="button"
            onClick={() => setSelectedFolderId(folder.id)}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors",
              isSelected
                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100"
                : "hover:bg-gray-100 dark:hover:bg-gray-700",
            )}
            style={{ paddingLeft: `${level * 16 + 12}px` }}
          >
            {hasChildren && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(folder.id);
                }}
                className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
              >
                <svg
                  className={cn(
                    "w-4 h-4 transition-transform",
                    isExpanded && "rotate-90",
                  )}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            )}
            {!hasChildren && <span className="w-5" />}

            {isExpanded ? (
              <FolderOpen className="w-5 h-5 text-yellow-500" />
            ) : (
              <Folder className="w-5 h-5 text-yellow-500" />
            )}

            <span className="flex-1 truncate">{folder.name}</span>

            {isSelected && (
              <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            )}
          </button>

          {hasChildren && isExpanded && (
            <div>{renderFolderTree(folder.children, level + 1)}</div>
          )}
        </div>
      );
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>移动到文件夹</DialogTitle>
          <DialogDescription>
            将选中的 {selectedIds.size} 条收藏移动到指定文件夹
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">加载文件夹...</span>
            </div>
          ) : loadError ? (
            <div className="flex items-center justify-center py-8 text-red-500">
              {loadError.message || "加载文件夹失败"}
            </div>
          ) : (
            <div className="h-[300px] border rounded-lg overflow-y-auto">
              <div className="p-2">
                {/* 根目录选项 */}
                <button
                  type="button"
                  onClick={() => setSelectedFolderId(null)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors",
                    selectedFolderId === null
                      ? "bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100"
                      : "hover:bg-gray-100 dark:hover:bg-gray-700",
                  )}
                >
                  <span className="w-5" />
                  <Folder className="w-5 h-5 text-gray-400" />
                  <span className="flex-1">根目录（无文件夹）</span>
                  {selectedFolderId === null && (
                    <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  )}
                </button>

                {/* 文件夹列表 */}
                {folders.length > 0 ? (
                  renderFolderTree(folders)
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    暂无文件夹，请先创建文件夹
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || isLoading}>
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                移动中...
              </>
            ) : (
              `移动 ${selectedIds.size} 条收藏`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
