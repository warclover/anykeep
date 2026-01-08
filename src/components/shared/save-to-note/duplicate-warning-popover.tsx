/**
 * Duplicate Warning Popover - 重复内容警告弹窗
 * @description 检测到重复内容时显示的警告弹窗
 */

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { DuplicateInfo } from "./types";

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
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <span className="sr-only">重复内容提示</span>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="font-medium">相似内容已存在</span>
          </div>

          <div className="p-2 bg-muted rounded-md">
            <p className="text-sm font-medium truncate">
              {duplicateNote.title}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              保存于 {formatDate(duplicateNote.savedAt)}
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onViewExisting}>
              查看已有
            </Button>
            <Button size="sm" onClick={onSaveAnyway}>
              仍然保存
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
