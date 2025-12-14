/**
 * 重命名文件夹对话框
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Folder } from "@/types/supabase";
import { useUser } from "@/contexts/user-context";
import { folderCacheInvalidation } from "@/lib/cache";

interface RenameFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder: Folder;
  onSuccess?: () => void;
  onRenamed?: (newName: string) => void;
}

export function RenameFolderDialog({
  open,
  onOpenChange,
  folder,
  onSuccess,
  onRenamed,
}: RenameFolderDialogProps) {
  const router = useRouter();
  const { fetchWithAbort } = useAbortableFetch();
  const { user } = useUser();
  const [name, setName] = useState(folder.name);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 打开时重置状态
  useEffect(() => {
    if (open) {
      setName(folder.name);
      setError(null);
    }
  }, [open, folder.name]);

  const handleSubmit = async () => {
    // 验证
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("文件夹名称不能为空");
      return;
    }

    if (trimmedName.length > 50) {
      setError("文件夹名称不能超过 50 个字符");
      return;
    }

    if (trimmedName === folder.name) {
      onOpenChange(false);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetchWithAbort(`/api/folders/${folder.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: trimmedName }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "重命名失败");
      }

      toast.success("文件夹已重命名");

      // 清除文件夹缓存
      if (user?.id) {
        folderCacheInvalidation.onFolderRename(user.id);
      }

      onOpenChange(false);
      onRenamed?.(trimmedName); // 先触发乐观更新
      onSuccess?.();
      router.refresh();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      const message = err instanceof Error ? err.message : "重命名失败";
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>重命名文件夹</DialogTitle>
          <DialogDescription>为「{folder.name}」设置新名称</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="folder-name">文件夹名称</Label>
            <Input
              id="folder-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isSubmitting) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="输入新名称"
              autoFocus
              className={error ? "border-red-500" : ""}
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
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
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                "保存"
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
