/**
 * 编辑收藏对话框组件
 * 提供表单让用户编辑收藏的标题、描述、文件夹、标签、备注等信息
 * P2-010: 集成自动快照触发（修改标签时检查）
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FolderCombobox } from "./folder-combobox";
import { updateBookmarkSchema } from "@/lib/validation";
import type { Bookmark, CustomUsageTag } from "@/types/supabase";
import { UsageTagSelector } from "./usage-tag-selector";
import { separateUserTagsExtended } from "@/lib/constants/usage-tags";
import { useAutoSnapshot } from "@/hooks/domain/bookmark";

interface EditBookmarkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookmark: Bookmark & {
    folders?: { id: number; name: string } | null;
  };
  folders?: Array<{ id: number; name: string }>;
}

export function EditBookmarkDialog({
  open,
  onOpenChange,
  bookmark,
  folders: foldersProp = [],
}: EditBookmarkDialogProps) {
  const router = useRouter();
  const { fetchWithAbort } = useAbortableFetch();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 当外部未传入 folders 时，内部自动获取（仅在对话框打开时请求）
  const { folders: fetchedFolders = [] } = useFolders({
    enabled: open && foldersProp.length === 0,
  });
  const folders = foldersProp.length > 0 ? foldersProp : fetchedFolders;

  // 表单状态
  const [title, setTitle] = useState(bookmark.title ?? "");
  const [description, setDescription] = useState(bookmark.ai_summary || "");
  const [folderId, setFolderId] = useState<string>(
    bookmark.folders?.id?.toString() || "",
  );

  // 用途标签和普通标签分离
  const [customUsageTags, setCustomUsageTags] = useState<CustomUsageTag[]>([]);
  const [selectedUsageTags, setSelectedUsageTags] = useState<string[]>([]);
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState(bookmark.notes || "");

  // 表单错误
  const [errors, setErrors] = useState<Record<string, string>>({});

  // P2-010: 自动快照触发
  // 注：hasSnapshot 暂时默认 false，API 会处理重复创建（返回 ALREADY_EXISTS）
  const originalUsageTagsRef = useRef<string[]>([]);
  const { checkAndTriggerSnapshot } = useAutoSnapshot({
    bookmarkId: bookmark.id,
    bookmarkUrl: bookmark.url,
    hasSnapshot: false,
  });

  // 当 bookmark 变化时重置表单
  useEffect(() => {
    setTitle(bookmark.title ?? "");
    setDescription(bookmark.ai_summary || "");
    setFolderId(bookmark.folders?.id?.toString() || "");
    setNotes(bookmark.notes || "");
    setErrors({});

    // 分离用途标签和普通标签
    // 注意：需要等自定义标签加载后才能正确分离
    const { usageTags, regularTags } = separateUserTagsExtended(
      bookmark.user_tags,
      customUsageTags,
    );
    setSelectedUsageTags(usageTags);
    setTags(regularTags.join(", "));
    // P2-010: 保存原始用途标签用于比较
    originalUsageTagsRef.current = usageTags;
  }, [bookmark, customUsageTags]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    try {
      // 解析标签字符串
      const regularTags = tags
        .split(/[,，\s]+/)
        .map((t) => t.trim())
        .filter(Boolean);

      // 合并用途标签和普通标签（用途标签在前）
      const userTags = Array.from(
        new Set([...selectedUsageTags, ...regularTags]),
      );

      // 验证输入
      const validation = updateBookmarkSchema.safeParse({
        title,
        description: description || undefined,
        folderId: folderId ? parseInt(folderId) : undefined,
        userTags: userTags.length > 0 ? userTags : undefined,
        notes: notes || undefined,
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

      // 调用更新 API
      const res = await fetchWithAbort(`/api/bookmarks/${bookmark.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(validation.data),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "更新收藏失败");
      }

      toast.success("收藏更新成功！");

      // P2-010: 检查是否需要触发自动快照
      checkAndTriggerSnapshot(originalUsageTagsRef.current, selectedUsageTags);

      onOpenChange(false);

      // 刷新页面数据
      router.refresh();
    } catch (error) {
      // 如果是取消错误，不显示错误提示
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      toast.error(error instanceof Error ? error.message : "更新收藏失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>编辑收藏</DialogTitle>
          <DialogDescription>修改收藏的信息，点击保存后生效</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 原文链接 - 只读显示 */}
          <div className="space-y-2">
            <Label htmlFor="url">原文链接</Label>
            <Input
              id="url"
              type="url"
              value={bookmark.url}
              readOnly
              disabled
              className="bg-gray-50 dark:bg-gray-800"
            />
            <p className="text-xs text-gray-500">原文链接不可修改</p>
          </div>

          {/* 标题输入 */}
          <div className="space-y-2">
            <Label htmlFor="title">
              标题 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              placeholder="输入收藏标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className={errors.title ? "border-red-500" : ""}
            />
            {errors.title && (
              <p className="text-xs text-red-500">{errors.title}</p>
            )}
          </div>

          {/* 描述输入 */}
          <div className="space-y-2">
            <Label htmlFor="description">描述</Label>
            <Textarea
              id="description"
              placeholder="简单描述这篇内容..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={errors.description ? "border-red-500" : ""}
            />
            {errors.description && (
              <p className="text-xs text-red-500">{errors.description}</p>
            )}
            <p className="text-xs text-gray-500">
              {bookmark.ai_summary ? "修改 AI 生成的摘要" : "添加描述"}
            </p>
          </div>

          {/* 文件夹选择 */}
          {folders.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="folder">文件夹</Label>
              <FolderCombobox
                value={folderId}
                onValueChange={setFolderId}
                folders={folders}
                placeholder="选择文件夹（可选）"
                allowClear={true}
                clearLabel="无文件夹"
              />
            </div>
          )}

          {/* 用途标签选择 */}
          <div className="space-y-2">
            <Label>用途标签</Label>
            <UsageTagSelector
              selectedTags={selectedUsageTags}
              onSelectedTagsChange={setSelectedUsageTags}
              customUsageTags={customUsageTags}
              onCustomTagsChange={setCustomUsageTags}
              disabled={isSubmitting}
            />
            <p className="text-xs text-gray-500">
              标记收藏的用途，方便日后快速筛选
            </p>
          </div>

          {/* 标签输入 */}
          <div className="space-y-2">
            <Label htmlFor="tags">自定义标签</Label>
            <Input
              id="tags"
              placeholder="技术, 前端, React（逗号或空格分隔）"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className={errors.userTags ? "border-red-500" : ""}
            />
            {errors.userTags && (
              <p className="text-xs text-red-500">{errors.userTags}</p>
            )}
            <p className="text-xs text-gray-500">
              最多 20 个标签，每个标签不超过 30 个字符
            </p>
          </div>

          {/* 备注输入 */}
          <div className="space-y-2">
            <Label htmlFor="notes">备注</Label>
            <Textarea
              id="notes"
              placeholder="记录一些个人想法..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className={errors.notes ? "border-red-500" : ""}
            />
            {errors.notes && (
              <p className="text-xs text-red-500">{errors.notes}</p>
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
                  保存中...
                </>
              ) : (
                "保存修改"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
