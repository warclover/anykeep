/**
 * 创建文件夹对话框组件
 * 提供表单让用户创建新文件夹（支持选择所属栏目）
 */

"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAbortableFetch } from "@/hooks/core";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createFolderSchema } from "@/lib/validation";
import { folderCacheInvalidation } from "@/lib/cache";
import type { Folder } from "@/types/supabase";
import type { FolderCategory } from "@/types/domain";
import { useUser } from "@/contexts/user-context";

interface CreateFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 可用的栏目列表 */
  categories?: FolderCategory[];
  /** 默认选中的栏目 ID */
  defaultCategoryId?: number;
  /** 创建成功后的回调，参数为新创建的文件夹数据 */
  onSuccess?: (folder: Folder) => void;
}

// 预设颜色
const PRESET_COLORS = [
  { name: "默认", value: "" }, // 无颜色选项
  { name: "蓝色", value: "#3B82F6" },
  { name: "绿色", value: "#10B981" },
  { name: "紫色", value: "#8B5CF6" },
  { name: "橙色", value: "#F59E0B" },
  { name: "红色", value: "#EF4444" },
  { name: "粉色", value: "#EC4899" },
];

export function CreateFolderDialog({
  open,
  onOpenChange,
  categories = [],
  defaultCategoryId,
  onSuccess,
}: CreateFolderDialogProps) {
  const { fetchWithAbort } = useAbortableFetch();
  const { user } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 表单状态
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>(
    defaultCategoryId ? String(defaultCategoryId) : "",
  );

  useEffect(() => {
    if (open) {
      setName("");
      setColor("");
      setCategoryId(defaultCategoryId ? String(defaultCategoryId) : "");
      setErrors({});
    }
  }, [open, defaultCategoryId]);

  // 表单错误
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    try {
      // 验证输入
      const validation = createFolderSchema.safeParse({
        name,
        color: color || undefined,
        categoryId:
          categoryId && categoryId !== "none"
            ? parseInt(categoryId, 10)
            : undefined,
      });

      if (!validation.success) {
        const fieldErrors: Record<string, string> = {};
        validation.error.issues.forEach((err) => {
          const field = err.path[0] as string;
          fieldErrors[field] = err.message;
        });
        setErrors(fieldErrors);
        return;
      }

      // 调用创建 API
      const res = await fetchWithAbort("/api/folders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(validation.data),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "创建文件夹失败");
      }

      toast.success("文件夹创建成功！");

      // 清除文件夹缓存，确保页面数据同步
      if (user?.id) {
        folderCacheInvalidation.onFolderCreate(user.id);
      }

      // 立即通知父组件更新状态（乐观更新）
      if (data.data && onSuccess) {
        onSuccess(data.data as Folder);
      }

      setName("");
      setColor(PRESET_COLORS[0].value);
      setCategoryId(defaultCategoryId ? String(defaultCategoryId) : "");
      setErrors({});

      // 关闭对话框
      onOpenChange(false);
    } catch (error) {
      // 如果是取消错误，不显示错误提示
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      toast.error(error instanceof Error ? error.message : "创建文件夹失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>创建文件夹</DialogTitle>
          <DialogDescription>创建一个新文件夹来整理你的收藏</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 文件夹名称 */}
          <div className="space-y-2">
            <Label htmlFor="create-folder-name">
              文件夹名称 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="create-folder-name"
              name="new-folder-name"
              placeholder="例如: 工作学习"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              required
              className={errors.name ? "border-red-500" : ""}
            />
            {errors.name && (
              <p className="text-xs text-red-500">{errors.name}</p>
            )}
          </div>

          {/* 所属栏目 */}
          {categories.length > 0 && (
            <div className="space-y-2">
              <Label>所属栏目</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择栏目（可选）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不指定栏目</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={String(cat.id)}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 颜色选择 */}
          <div className="space-y-2">
            <Label htmlFor="color">文件夹颜色</Label>
            <div className="flex gap-2 items-center">
              {PRESET_COLORS.map((presetColor) => (
                <button
                  key={presetColor.value || "default"}
                  type="button"
                  onClick={() => setColor(presetColor.value)}
                  className={`w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center ${
                    color === presetColor.value
                      ? "border-gray-900 dark:border-white scale-110"
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                  style={
                    presetColor.value
                      ? { backgroundColor: presetColor.value }
                      : { backgroundColor: "transparent" }
                  }
                  title={presetColor.name}
                >
                  {!presetColor.value && (
                    <svg
                      className="w-6 h-6 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                      />
                    </svg>
                  )}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              选择「默认」将使用系统自动分配的颜色
            </p>
            {errors.color && (
              <p className="text-xs text-red-500">{errors.color}</p>
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  创建中...
                </>
              ) : (
                "创建文件夹"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
