/**
 * 创建栏目对话框组件
 */

"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAbortableFetch } from "@/hooks/core";
import { API_FOLDER_CATEGORIES } from "@/lib/constants/api-paths";
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
import { createCategorySchema } from "@/lib/validation";
import type { FolderCategory } from "@/types/domain";

interface CreateCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (category: FolderCategory) => void;
}

const PRESET_COLORS = [
  { name: "默认", value: "" },
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
];

export function CreateCategoryDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateCategoryDialogProps) {
  const { fetchWithAbort } = useAbortableFetch();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("");
  const [icon, setIcon] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    try {
      const validation = createCategorySchema.safeParse({
        name,
        color: color || undefined,
        icon: icon || undefined,
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

      const res = await fetchWithAbort(API_FOLDER_CATEGORIES.list, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.data),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "创建栏目失败");
      }

      toast.success("栏目创建成功！");

      if (data.data && onSuccess) {
        onSuccess(data.data as FolderCategory);
      }

      setName("");
      setColor("");
      setIcon("");
      setErrors({});
      onOpenChange(false);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast.error(error instanceof Error ? error.message : "创建栏目失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>新建栏目</DialogTitle>
          <DialogDescription>
            创建一个栏目来组织你的文件夹，例如「学习收藏」「工作收藏」
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-category-name">
              栏目名称 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="create-category-name"
              placeholder="例如: 学习收藏"
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

          <div className="space-y-2">
            <Label>栏目图标</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_ICONS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() =>
                    setIcon(icon === preset.value ? "" : preset.value)
                  }
                  className={`w-10 h-10 rounded-lg border-2 transition-all flex items-center justify-center text-lg ${
                    icon === preset.value
                      ? "border-primary bg-primary/10 scale-110"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-400"
                  }`}
                  title={preset.name}
                >
                  {preset.emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>栏目颜色</Label>
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
                "创建栏目"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
