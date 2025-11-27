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

interface RenameFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder: Folder;
  onSuccess?: () => void;
}

export function RenameFolderDialog({
  open,
  onOpenChange,
  folder,
  onSuccess,
}: RenameFolderDialogProps) {
  const router = useRouter();
  const { fetchWithAbort } = useAbortableFetch();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
      onOpenChange(false);
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="folder-name">文件夹名称</Label>
            <Input
              id="folder-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
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
            <Button type="submit" disabled={isSubmitting}>
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
        </form>
      </DialogContent>
    </Dialog>
  );
}
