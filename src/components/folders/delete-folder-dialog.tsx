/**
 * 删除文件夹对话框
 * 如果文件夹有收藏，需要选择处理方式
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertTriangle, Trash2 } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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

interface DeleteFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder: FolderWithCount;
  targetFolders: FolderWithCount[];
  onSuccess?: () => void;
}

type DeleteOption = "move" | "delete";

export function DeleteFolderDialog({
  open,
  onOpenChange,
  folder,
  targetFolders,
  onSuccess,
}: DeleteFolderDialogProps) {
  const router = useRouter();
  const { fetchWithAbort } = useAbortableFetch();
  const [deleteOption, setDeleteOption] = useState<DeleteOption>("move");
  const [targetFolderId, setTargetFolderId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bookmarkCount = folder.bookmark_count || 0;
  const hasBookmarks = bookmarkCount > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    console.log("[DeleteFolderDialog] ========= SUBMIT CLICKED =========");
    console.log("[DeleteFolderDialog] folder.id:", folder.id);
    console.log("[DeleteFolderDialog] hasBookmarks:", hasBookmarks);
    console.log("[DeleteFolderDialog] deleteOption:", deleteOption);
    console.log("[DeleteFolderDialog] targetFolderId:", targetFolderId);

    // 如果有收藏且选择移动，需要验证目标文件夹
    if (hasBookmarks && deleteOption === "move" && !targetFolderId) {
      setError("请选择目标文件夹");
      return;
    }

    setIsSubmitting(true);

    try {
      // 如果有收藏，先处理收藏
      if (hasBookmarks) {
        if (deleteOption === "move") {
          // 合并到目标文件夹
          const mergeRes = await fetchWithAbort(
            `/api/folders/${folder.id}/merge`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                targetFolderId: parseInt(targetFolderId),
              }),
            },
          );

          const mergeData = await mergeRes.json();

          if (!mergeRes.ok) {
            throw new Error(mergeData.error?.message || "移动收藏失败");
          }

          // API 响应格式: { success: true, data: { ... } }
          const result = mergeData.data;
          toast.success(
            `已将 ${result.bookmarksMoved} 条收藏移动到「${result.targetFolderName}」，文件夹「${folder.name}」已删除`,
          );
        } else {
          // 直接删除所有收藏（软删除）
          const deleteBookmarksRes = await fetchWithAbort(
            `/api/folders/${folder.id}/bookmarks`,
            {
              method: "DELETE",
            },
          );

          if (!deleteBookmarksRes.ok) {
            const data = await deleteBookmarksRes.json();
            throw new Error(data.error?.message || "删除收藏失败");
          }

          // 然后删除文件夹
          const deleteFolderRes = await fetchWithAbort(
            `/api/folders/${folder.id}`,
            {
              method: "DELETE",
            },
          );

          if (!deleteFolderRes.ok) {
            const data = await deleteFolderRes.json();
            throw new Error(data.error?.message || "删除文件夹失败");
          }

          toast.success(
            `已删除文件夹「${folder.name}」及其 ${bookmarkCount} 条收藏`,
          );
        }
      } else {
        // 空文件夹直接删除
        console.log(
          "[DeleteFolderDialog] Deleting empty folder, calling DELETE /api/folders/" +
            folder.id,
        );
        const res = await fetchWithAbort(`/api/folders/${folder.id}`, {
          method: "DELETE",
        });
        console.log("[DeleteFolderDialog] DELETE response status:", res.status);

        const data = await res.json();
        console.log(
          "[DeleteFolderDialog] DELETE response data:",
          JSON.stringify(data, null, 2),
        );

        if (!res.ok) {
          throw new Error(data.error?.message || "删除失败");
        }

        toast.success(`已删除文件夹「${folder.name}」`);
      }

      onOpenChange(false);
      resetState();
      onSuccess?.();
      router.refresh();
    } catch (err) {
      console.error("[DeleteFolderDialog] ========= ERROR =========");
      console.error("[DeleteFolderDialog] Error:", err);
      if (err instanceof Error && err.name === "AbortError") {
        console.log("[DeleteFolderDialog] Request was aborted");
        return;
      }
      const message = err instanceof Error ? err.message : "删除失败";
      console.error("[DeleteFolderDialog] Error message:", message);
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetState = () => {
    setDeleteOption("move");
    setTargetFolderId("");
    setError(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetState();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <Trash2 className="size-5" />
            删除文件夹
          </DialogTitle>
          <DialogDescription>
            {hasBookmarks
              ? `「${folder.name}」中有 ${bookmarkCount} 条收藏，请选择处理方式`
              : `确定要删除空文件夹「${folder.name}」吗？`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 有收藏时显示选项 */}
          {hasBookmarks && (
            <>
              {/* 处理方式选择 */}
              <div className="space-y-3">
                <Label>收藏处理方式</Label>
                <RadioGroup
                  value={deleteOption}
                  onValueChange={(v) => setDeleteOption(v as DeleteOption)}
                  className="space-y-2"
                >
                  <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="move" id="move" className="mt-0.5" />
                    <div className="flex-1">
                      <Label
                        htmlFor="move"
                        className="cursor-pointer font-medium"
                      >
                        移动到其他文件夹
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        将收藏移动到选择的文件夹，然后删除此文件夹
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 rounded-lg border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer">
                    <RadioGroupItem
                      value="delete"
                      id="delete"
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <Label
                        htmlFor="delete"
                        className="cursor-pointer font-medium text-red-600 dark:text-red-400"
                      >
                        删除全部收藏
                      </Label>
                      <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-1">
                        ⚠️ 将永久删除 {bookmarkCount} 条收藏，此操作不可恢复
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {/* 目标文件夹选择（仅在选择移动时显示） */}
              {deleteOption === "move" && (
                <div className="space-y-2">
                  <Label htmlFor="target-folder">移动到</Label>
                  <Select
                    value={targetFolderId}
                    onValueChange={setTargetFolderId}
                  >
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
                </div>
              )}
            </>
          )}

          {/* 警告提示（空文件夹或选择删除收藏） */}
          {(!hasBookmarks || deleteOption === "delete") && (
            <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <AlertTriangle className="size-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="text-sm text-red-700 dark:text-red-300">
                {hasBookmarks ? (
                  <p>
                    即将删除文件夹「{folder.name}」及其{" "}
                    <strong>{bookmarkCount}</strong> 条收藏，此操作不可撤销！
                  </p>
                ) : (
                  <p>此操作不可撤销</p>
                )}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

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
              type="submit"
              disabled={
                isSubmitting ||
                (hasBookmarks && deleteOption === "move" && !targetFolderId)
              }
              variant="destructive"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  处理中...
                </>
              ) : (
                "确认删除"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
