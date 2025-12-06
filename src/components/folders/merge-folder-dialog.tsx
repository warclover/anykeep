/**
 * 合并文件夹对话框
 * 将当前文件夹的所有收藏移动到目标文件夹，然后删除当前文件夹
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertTriangle } from "lucide-react";
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
import type { Folder } from "@/types/supabase";

type FolderWithCount = Folder & {
  bookmark_count?: number;
};

interface MergeFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder: FolderWithCount;
  targetFolders: FolderWithCount[];
  onSuccess?: () => void;
  onMerged?: (
    sourceFolderId: number,
    targetFolderId: number,
    movedCount: number,
  ) => void;
}

export function MergeFolderDialog({
  open,
  onOpenChange,
  folder,
  targetFolders,
  onSuccess,
  onMerged,
}: MergeFolderDialogProps) {
  const router = useRouter();
  const { fetchWithAbort } = useAbortableFetch();
  const [targetFolderId, setTargetFolderId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bookmarkCount = folder.bookmark_count || 0;
  const selectedTarget = targetFolders.find(
    (f) => f.id.toString() === targetFolderId,
  );

  const handleSubmit = async () => {
    if (!targetFolderId) {
      setError("请选择目标文件夹");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetchWithAbort(`/api/folders/${folder.id}/merge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ targetFolderId: parseInt(targetFolderId) }),
      });

      const responseData = await res.json();

      if (!res.ok) {
        throw new Error(responseData.error?.message || "合并失败");
      }

      // API 响应格式: { success: true, data: { ... } }
      const result = responseData.data;
      toast.success(
        `已将 ${result.bookmarksMoved} 条收藏合并到「${result.targetFolderName}」，文件夹「${folder.name}」已删除`,
      );
      onOpenChange(false);
      setTargetFolderId("");
      // 先触发乐观更新
      onMerged?.(folder.id, parseInt(targetFolderId), result.bookmarksMoved);
      onSuccess?.();
      router.refresh();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      const message = err instanceof Error ? err.message : "合并失败";
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setTargetFolderId("");
      setError(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>合并文件夹</DialogTitle>
          <DialogDescription>
            将「{folder.name}」中的收藏移动到其他文件夹
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 警告提示 */}
          <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-200">
                此操作不可撤销
              </p>
              <p className="text-amber-700 dark:text-amber-300 mt-1">
                {bookmarkCount > 0 ? (
                  <>
                    将移动 <strong>{bookmarkCount}</strong> 条收藏到目标文件夹，
                  </>
                ) : (
                  <>此文件夹没有收藏，</>
                )}
                然后删除「{folder.name}」文件夹。
              </p>
            </div>
          </div>

          {/* 目标文件夹选择 */}
          <div className="space-y-2">
            <Label htmlFor="target-folder">目标文件夹</Label>
            <Select value={targetFolderId} onValueChange={setTargetFolderId}>
              <SelectTrigger className={error ? "border-red-500" : ""}>
                <SelectValue placeholder="选择目标文件夹" />
              </SelectTrigger>
              <SelectContent>
                {targetFolders.map((f) => (
                  <SelectItem key={f.id} value={f.id.toString()}>
                    {f.name}
                    <span className="ml-2 text-muted-foreground">
                      ({f.bookmark_count || 0})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error && <p className="text-xs text-red-500">{error}</p>}
            {selectedTarget && (
              <p className="text-xs text-muted-foreground">
                合并后「{selectedTarget.name}」将有{" "}
                {(selectedTarget.bookmark_count || 0) + bookmarkCount} 条收藏
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !targetFolderId}
              variant="default"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  合并中...
                </>
              ) : (
                "确认合并"
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
