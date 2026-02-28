/**
 * 栏目操作菜单组件
 * 提供重命名、修改颜色、删除等操作
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, Edit2, Trash2, Loader2, Palette } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAbortableFetch } from "@/hooks/core";
import type { FolderCategory } from "@/types/domain";

interface CategoryActionMenuProps {
  category: FolderCategory;
  folderCount: number;
  onDeleted?: (categoryId: number) => void;
  onRenamed?: (categoryId: number, newName: string) => void;
}

const PRESET_COLORS = [
  { name: "蓝色", value: "#3B82F6" },
  { name: "绿色", value: "#10B981" },
  { name: "紫色", value: "#8B5CF6" },
  { name: "橙色", value: "#F59E0B" },
  { name: "红色", value: "#EF4444" },
  { name: "粉色", value: "#EC4899" },
];

export function CategoryActionMenu({
  category,
  folderCount,
  onDeleted,
  onRenamed,
}: CategoryActionMenuProps) {
  const router = useRouter();
  const { fetchWithAbort } = useAbortableFetch();
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showColorDialog, setShowColorDialog] = useState(false);
  const [newName, setNewName] = useState(category.name);
  const [newColor, setNewColor] = useState(category.color || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRename = async () => {
    if (!newName.trim() || newName.trim() === category.name) {
      setShowRenameDialog(false);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetchWithAbort(
        `/api/folder-categories/${category.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newName.trim() }),
        },
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "重命名失败");
      }

      toast.success("栏目已重命名");
      onRenamed?.(category.id, newName.trim());
      setShowRenameDialog(false);
      router.refresh();
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast.error(error instanceof Error ? error.message : "重命名失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangeColor = async (color: string) => {
    setIsSubmitting(true);
    try {
      const res = await fetchWithAbort(
        `/api/folder-categories/${category.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ color }),
        },
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "修改颜色失败");
      }

      toast.success("栏目颜色已更新");
      setNewColor(color);
      setShowColorDialog(false);
      router.refresh();
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast.error(error instanceof Error ? error.message : "修改颜色失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetchWithAbort(
        `/api/folder-categories/${category.id}`,
        {
          method: "DELETE",
        },
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "删除失败");
      }

      toast.success("栏目已删除");
      onDeleted?.(category.id);
      setShowDeleteDialog(false);
      router.refresh();
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast.error(error instanceof Error ? error.message : "删除失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="size-3.5" />
            <span className="sr-only">栏目操作</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              setNewName(category.name);
              setShowRenameDialog(true);
            }}
          >
            <Edit2 className="size-4 mr-2" />
            重命名
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              setShowColorDialog(true);
            }}
          >
            <Palette className="size-4 mr-2" />
            修改颜色
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              setShowDeleteDialog(true);
            }}
            className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
          >
            <Trash2 className="size-4 mr-2" />
            删除栏目
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 重命名对话框 */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>重命名栏目</DialogTitle>
            <DialogDescription>输入新的栏目名称</DialogDescription>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="栏目名称"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
            }}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRenameDialog(false)}
              disabled={isSubmitting}
            >
              取消
            </Button>
            <Button onClick={handleRename} disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : null}
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 修改颜色对话框 */}
      <Dialog open={showColorDialog} onOpenChange={setShowColorDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>修改栏目颜色</DialogTitle>
            <DialogDescription>选择栏目的主题颜色</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-3 justify-center py-4">
            {PRESET_COLORS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => handleChangeColor(preset.value)}
                disabled={isSubmitting}
                className={`w-12 h-12 rounded-full border-2 transition-all ${
                  newColor === preset.value
                    ? "border-gray-900 dark:border-white scale-110"
                    : "border-gray-300 dark:border-gray-600"
                }`}
                style={{ backgroundColor: preset.value }}
                title={preset.name}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              确认删除栏目「{category.name}」？
            </AlertDialogTitle>
            <AlertDialogDescription>
              {folderCount > 0
                ? `该栏目下有 ${folderCount} 个文件夹，删除栏目后这些文件夹将变为「未分类」状态。文件夹和书签数据不会丢失。`
                : "此操作不可撤销。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isSubmitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : null}
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
