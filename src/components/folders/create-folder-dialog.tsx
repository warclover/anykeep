/**
 * 创建文件夹对话框组件
 * 提供表单让用户创建新文件夹
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { useUser } from "@/contexts/user-context";

interface CreateFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders?: Folder[]; // 可选的父文件夹列表
  /** 创建成功后的回调，参数为新创建的文件夹数据 */
  onSuccess?: (folder: Folder) => void;
}

// 预设颜色
const PRESET_COLORS = [
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
  folders = [],
  onSuccess,
}: CreateFolderDialogProps) {
  const router = useRouter();
  const { fetchWithAbort } = useAbortableFetch();
  const { user } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 表单状态
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string>("");
  const [color, setColor] = useState<string>(PRESET_COLORS[0].value);

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
        parentId: parentId ? parseInt(parentId) : undefined,
        color: color || undefined,
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

      // P0-6 修复：先重置表单状态，再关闭对话框
      // 避免用户快速重新打开时看到旧状态
      setName("");
      setParentId("");
      setColor(PRESET_COLORS[0].value);
      setErrors({});

      // 关闭对话框
      onOpenChange(false);

      // 最后刷新页面数据
      router.refresh();
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

          {/* 父文件夹选择 */}
          {folders.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="parent">父文件夹（可选）</Label>
              <Select
                value={parentId || "__none__"}
                onValueChange={(val) =>
                  setParentId(val === "__none__" ? "" : val)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择父文件夹（可选）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">无（根文件夹）</SelectItem>
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id.toString()}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                选择父文件夹可以创建嵌套的文件夹结构
              </p>
            </div>
          )}

          {/* 颜色选择 */}
          <div className="space-y-2">
            <Label htmlFor="color">文件夹颜色</Label>
            <div className="flex gap-2">
              {PRESET_COLORS.map((presetColor) => (
                <button
                  key={presetColor.value}
                  type="button"
                  onClick={() => setColor(presetColor.value)}
                  className={`w-10 h-10 rounded-full border-2 transition-all ${
                    color === presetColor.value
                      ? "border-gray-900 dark:border-white scale-110"
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                  style={{ backgroundColor: presetColor.value }}
                  title={presetColor.name}
                />
              ))}
            </div>
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
