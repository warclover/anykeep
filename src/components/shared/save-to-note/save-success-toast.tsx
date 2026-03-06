/**
 * Save Success Toast - 保存成功提示
 * @description 显示保存成功后的轻量提示
 */

import { Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NOTES } from "@/lib/constants/notes-messages";

interface SaveSuccessToastProps {
  /** 笔记标题 */
  noteTitle: string;
  /** 文件夹名称 */
  folderName: string;
  /** 查看笔记回调 */
  onViewNote: () => void;
}

export function SaveSuccessToast({
  noteTitle,
  folderName,
  onViewNote,
}: SaveSuccessToastProps) {
  return (
    <div className="flex items-start gap-3 min-w-[300px] bg-background border rounded-lg p-4 shadow-lg">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
        <Check className="w-4 h-4 text-green-600" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          {NOTES.SUCCESS_TOAST.SAVED_TO(folderName)}
        </p>
        <p className="text-sm text-muted-foreground truncate mt-0.5">
          {noteTitle}
        </p>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="flex-shrink-0 text-primary"
        onClick={onViewNote}
      >
        {NOTES.SUCCESS_TOAST.VIEW_NOTE}
        <ArrowRight className="w-3 h-3 ml-1" />
      </Button>
    </div>
  );
}
