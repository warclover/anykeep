/**
 * Duplicate Warning Dialog - 重复内容警告弹窗
 * @description 检测到重复内容时显示的警告弹窗
 *
 * v1.1.0: 从 Popover 改为 AlertDialog，解决 sr-only 触发器无法定位的问题
 */

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { DuplicateInfo } from "./types";
import { NOTES } from "@/lib/constants/notes-messages";

interface DuplicateWarningPopoverProps {
  /** 是否打开 */
  open: boolean;
  /** 打开状态变化回调 */
  onOpenChange: (open: boolean) => void;
  /** 重复笔记信息 */
  duplicateNote: DuplicateInfo | null;
  /** 查看已有笔记回调 */
  onViewExisting: () => void;
  /** 仍然保存回调 */
  onSaveAnyway: () => void;
}

export function DuplicateWarningPopover({
  open,
  onOpenChange,
  duplicateNote,
  onViewExisting,
  onSaveAnyway,
}: DuplicateWarningPopoverProps) {
  if (!duplicateNote) return null;

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[400px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            {NOTES.DUPLICATE_WARNING.TITLE}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="p-2 bg-muted rounded-md mt-2">
              <p className="text-sm font-medium truncate">
                {duplicateNote.title}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {NOTES.DUPLICATE_WARNING.SAVED_AT}{" "}
                {formatDate(duplicateNote.savedAt)}
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <Button variant="outline" size="sm" onClick={onViewExisting}>
            {NOTES.DUPLICATE_WARNING.VIEW_EXISTING}
          </Button>
          <Button size="sm" onClick={onSaveAnyway}>
            {NOTES.DUPLICATE_WARNING.SAVE_ANYWAY}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
