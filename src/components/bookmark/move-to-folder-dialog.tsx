/**
 * 移动到文件夹对话框组件
 * 提供快速移动收藏到指定文件夹的功能
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Folder, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useAbortableFetch } from "@/hooks/use-abortable-fetch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Folder as FolderType } from "@/types/supabase";

/**
 * 树形文件夹节点类型
 */
interface FolderTreeNode extends FolderType {
  children: FolderTreeNode[];
}

/**
 * 扁平化文件夹项（带层级信息）
 */
interface FlattenedFolder {
  id: number;
  name: string;
  level: number; // 层级深度（0 为根节点）
}

interface MoveToFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookmark: {
    id: number;
    folder_id: number | null;
    folders?: { id: number; name: string } | null;
  };
}

export function MoveToFolderDialog({
  open,
  onOpenChange,
  bookmark,
}: MoveToFolderDialogProps) {
  const router = useRouter();
  const { fetchWithAbort } = useAbortableFetch();

  // 文件夹数据状态
  const [folders, setFolders] = useState<FolderTreeNode[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 选择状态
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");
  const [isMoving, setIsMoving] = useState(false);

  /**
   * 加载文件夹列表
   */
  const loadFolders = useCallback(async () => {
    setIsLoadingFolders(true);
    setLoadError(null);

    try {
      const res = await fetchWithAbort("/api/folders");

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "加载文件夹失败");
      }

      const data = await res.json();
      setFolders(data.data || []);
    } catch (error) {
      // 如果是取消错误，不显示错误提示
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      const errorMsg =
        error instanceof Error ? error.message : "加载文件夹失败";
      setLoadError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoadingFolders(false);
    }
  }, [fetchWithAbort]);

  // 对话框打开时加载文件夹列表并初始化选中状态
  useEffect(() => {
    if (open) {
      loadFolders();
      // 使用 'none' 表示无文件夹，避免空字符串导致的错误
      setSelectedFolderId(bookmark.folder_id?.toString() || "none");
    }
  }, [open, bookmark.folder_id, loadFolders]);

  /**
   * 递归扁平化文件夹树，添加层级信息
   */
  const flattenFolderTree = (
    nodes: FolderTreeNode[],
    level: number = 0,
  ): FlattenedFolder[] => {
    const result: FlattenedFolder[] = [];

    for (const node of nodes) {
      // 跳过系统文件夹（INBOX 等）
      if (node.is_system) {
        continue;
      }

      result.push({
        id: node.id,
        name: node.name,
        level,
      });

      // 递归处理子文件夹
      if (node.children && node.children.length > 0) {
        result.push(...flattenFolderTree(node.children, level + 1));
      }
    }

    return result;
  };

  /**
   * 生成带缩进的文件夹名称
   */
  const getIndentedName = (folder: FlattenedFolder): string => {
    const indent = "　".repeat(folder.level); // 使用全角空格缩进
    return `${indent}${folder.name}`;
  };

  /**
   * 提交移动操作
   */
  const handleMove = async () => {
    if (isMoving) return;

    // 'none' 表示无文件夹（folder_id = null）
    const targetFolderId =
      selectedFolderId === "none" ? null : parseInt(selectedFolderId);

    // 检查是否移动到当前文件夹
    if (targetFolderId === bookmark.folder_id) {
      toast.info("收藏已在该文件夹中");
      onOpenChange(false);
      return;
    }

    setIsMoving(true);

    try {
      const res = await fetchWithAbort(`/api/bookmarks/${bookmark.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          folderId: targetFolderId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "移动失败");
      }

      const targetFolderName =
        targetFolderId === null
          ? "无文件夹"
          : flattenFolderTree(folders).find((f) => f.id === targetFolderId)
              ?.name || "未知文件夹";

      toast.success(`已移动到「${targetFolderName}」`);
      onOpenChange(false);

      // 刷新页面数据
      router.refresh();
    } catch (error) {
      // 如果是取消错误，不显示错误提示
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      toast.error(error instanceof Error ? error.message : "移动失败");
    } finally {
      setIsMoving(false);
    }
  };

  // 扁平化文件夹列表
  const flattenedFolders = flattenFolderTree(folders);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>移动到文件夹</DialogTitle>
          <DialogDescription>
            选择目标文件夹，移动后将自动刷新页面
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 当前文件夹显示 */}
          {bookmark.folders && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Folder className="size-4" />
              <span>
                当前位置：
                <span className="font-medium text-gray-900 dark:text-white">
                  {bookmark.folders.name}
                </span>
              </span>
            </div>
          )}

          {/* 文件夹选择器 */}
          <div className="space-y-2">
            <Label htmlFor="target-folder">目标文件夹</Label>

            {isLoadingFolders ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-6 animate-spin text-gray-400" />
                <span className="ml-2 text-sm text-gray-500">加载中...</span>
              </div>
            ) : loadError ? (
              <div className="flex flex-col items-center gap-2 py-4">
                <AlertCircle className="size-8 text-red-500" />
                <p className="text-sm text-red-600 dark:text-red-400">
                  {loadError}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadFolders}
                  className="mt-2"
                >
                  重试
                </Button>
              </div>
            ) : flattenedFolders.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <Folder className="size-8 text-gray-400" />
                <p className="text-sm text-gray-500">
                  暂无文件夹，请先创建文件夹
                </p>
              </div>
            ) : (
              <Select
                value={selectedFolderId}
                onValueChange={setSelectedFolderId}
              >
                <SelectTrigger id="target-folder">
                  <SelectValue placeholder="选择文件夹" />
                </SelectTrigger>
                <SelectContent>
                  {/* 「无文件夹」选项 */}
                  <SelectItem value="none">
                    <span className="text-gray-500">无文件夹</span>
                  </SelectItem>

                  {/* 文件夹列表 */}
                  {flattenedFolders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id.toString()}>
                      {getIndentedName(folder)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isMoving}
          >
            取消
          </Button>
          <Button
            type="button"
            onClick={handleMove}
            disabled={isMoving || isLoadingFolders || !!loadError}
          >
            {isMoving ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                移动中...
              </>
            ) : (
              "确认移动"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
