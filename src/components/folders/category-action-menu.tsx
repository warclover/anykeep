/**
 * 栏目操作菜单组件
 * 提供重命名、修改图标、修改颜色、上移/下移、删除等操作
 */

"use client";

import { useState } from "react";
import {
  MoreVertical,
  Edit2,
  Trash2,
  Loader2,
  Palette,
  Smile,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
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
  /** 全部栏目（已按 sort_order 排序），用于计算上移/下移的邻居 */
  allCategories: FolderCategory[];
  onDeleted?: (categoryId: number) => void;
  onRenamed?: (categoryId: number, newName: string) => void;
  onIconChanged?: (categoryId: number, newIcon: string) => void;
  onColorChanged?: (categoryId: number, newColor: string) => void;
  onMoved?: (
    categoryId: number,
    newSortOrder: number,
    neighborId: number,
    neighborNewOrder: number,
  ) => void;
}

const PRESET_COLORS = [
  { name: "蓝色", value: "#3B82F6" },
  { name: "绿色", value: "#10B981" },
  { name: "紫色", value: "#8B5CF6" },
  { name: "橙色", value: "#F59E0B" },
  { name: "红色", value: "#EF4444" },
  { name: "粉色", value: "#EC4899" },
];

const PRESET_ICONS = [
  { name: "公文包", value: "Briefcase", emoji: "💼" },
  { name: "学习", value: "GraduationCap", emoji: "🎓" },
  { name: "爱心", value: "Heart", emoji: "❤️" },
  { name: "游戏", value: "Gamepad2", emoji: "🎮" },
  { name: "星星", value: "Star", emoji: "⭐" },
  { name: "书本", value: "BookOpen", emoji: "📖" },
  { name: "代码", value: "Code", emoji: "💻" },
  { name: "音乐", value: "Music", emoji: "🎵" },
  { name: "相机", value: "Camera", emoji: "📷" },
  { name: "地球", value: "Globe", emoji: "🌍" },
  { name: "文件夹", value: "MoreHorizontal", emoji: "📂" },
];

export function CategoryActionMenu({
  category,
  folderCount,
  allCategories,
  onDeleted,
  onRenamed,
  onIconChanged,
  onColorChanged,
  onMoved,
}: CategoryActionMenuProps) {
  const { fetchWithAbort } = useAbortableFetch();
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showColorDialog, setShowColorDialog] = useState(false);
  const [showIconDialog, setShowIconDialog] = useState(false);
  const [newName, setNewName] = useState(category.name);
  const [newColor, setNewColor] = useState(category.color || "");
  const [selectedIcon, setSelectedIcon] = useState(category.icon || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 按 sort_order 排序后的当前位置
  const sorted = [...allCategories].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );
  const currentIdx = sorted.findIndex((c) => c.id === category.id);
  const canMoveUp = currentIdx > 0;
  const canMoveDown = currentIdx < sorted.length - 1 && currentIdx >= 0;

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
      onColorChanged?.(category.id, color);
      setShowColorDialog(false);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast.error(error instanceof Error ? error.message : "修改颜色失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangeIcon = async () => {
    if (selectedIcon === (category.icon || "")) {
      setShowIconDialog(false);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetchWithAbort(
        `/api/folder-categories/${category.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ icon: selectedIcon || null }),
        },
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "修改图标失败");
      }

      toast.success("栏目图标已更新");
      onIconChanged?.(category.id, selectedIcon);
      setShowIconDialog(false);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast.error(error instanceof Error ? error.message : "修改图标失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMove = async (direction: "up" | "down") => {
    if (currentIdx < 0) return;
    const neighborIdx = direction === "up" ? currentIdx - 1 : currentIdx + 1;
    if (neighborIdx < 0 || neighborIdx >= sorted.length) return;

    const neighbor = sorted[neighborIdx];
    const myCurrentOrder = category.sort_order ?? currentIdx;
    const neighborCurrentOrder = neighbor.sort_order ?? neighborIdx;

    // 若 sort_order 相同，用位置偏移区分
    const myNewOrder =
      myCurrentOrder === neighborCurrentOrder
        ? direction === "up"
          ? myCurrentOrder - 1
          : myCurrentOrder + 1
        : neighborCurrentOrder;
    const neighborNewOrder =
      myCurrentOrder === neighborCurrentOrder
        ? neighborCurrentOrder
        : myCurrentOrder;

    // 乐观更新
    onMoved?.(category.id, myNewOrder, neighbor.id, neighborNewOrder);

    try {
      await Promise.all([
        fetchWithAbort(`/api/folder-categories/${category.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort_order: myNewOrder }),
        }),
        fetchWithAbort(`/api/folder-categories/${neighbor.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort_order: neighborNewOrder }),
        }),
      ]);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast.error("移动失败，请刷新页面");
      // 移动失败时乐观状态已脏，需要刷新恢复
      window.location.reload();
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
            className="h-6 w-6 p-0 text-muted-foreground/50 hover:text-foreground transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="size-3.5" />
            <span className="sr-only">栏目操作</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
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
              setSelectedIcon(category.icon || "");
              setShowIconDialog(true);
            }}
          >
            <Smile className="size-4 mr-2" />
            修改图标
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
              handleMove("up");
            }}
            disabled={!canMoveUp}
          >
            <ArrowUp className="size-4 mr-2" />
            向上移动
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              handleMove("down");
            }}
            disabled={!canMoveDown}
          >
            <ArrowDown className="size-4 mr-2" />
            向下移动
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

      {/* 修改图标对话框 */}
      <Dialog open={showIconDialog} onOpenChange={setShowIconDialog}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>修改栏目图标</DialogTitle>
            <DialogDescription>选择栏目图标</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2 justify-center py-4">
            {PRESET_ICONS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() =>
                  setSelectedIcon(
                    selectedIcon === preset.value ? "" : preset.value,
                  )
                }
                disabled={isSubmitting}
                className={`w-12 h-12 rounded-lg border-2 transition-all flex items-center justify-center text-xl ${
                  selectedIcon === preset.value
                    ? "border-primary bg-primary/10 scale-110"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-400"
                }`}
                title={preset.name}
              >
                {preset.emoji}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowIconDialog(false)}
              disabled={isSubmitting}
            >
              取消
            </Button>
            <Button onClick={handleChangeIcon} disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : null}
              确认
            </Button>
          </DialogFooter>
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
