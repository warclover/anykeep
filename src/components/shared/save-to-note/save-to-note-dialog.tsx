"use client";

/**
 * Save to Note Dialog - 保存到笔记对话框
 * @description 可选的对话框形式保存（支持自定义标题）
 */

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import type { SaveSourceType } from "./types";

interface SaveToNoteDialogProps {
  /** 是否打开 */
  open: boolean;
  /** 打开状态变化回调 */
  onOpenChange: (open: boolean) => void;
  /** 要保存的内容 */
  content: string;
  /** 来源类型 */
  sourceType: SaveSourceType;
  /** 建议的标题 */
  suggestedTitle?: string;
  /** 保存回调 */
  onSave: (title: string) => Promise<void>;
  /** 是否保存中 */
  isSaving?: boolean;
}

export function SaveToNoteDialog({
  open,
  onOpenChange,
  content,
  suggestedTitle = "",
  onSave,
  isSaving = false,
}: SaveToNoteDialogProps) {
  const [title, setTitle] = React.useState(suggestedTitle);

  // 对话框打开时重置标题
  React.useEffect(() => {
    if (open && suggestedTitle) {
      setTitle(suggestedTitle);
    }
  }, [open, suggestedTitle]);

  const handleSave = async () => {
    await onSave(title);
  };

  // 内容预览（最多 200 字符）
  const contentPreview =
    content.slice(0, 200) + (content.length > 200 ? "..." : "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>保存到我的笔记</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">标题</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入笔记标题"
            />
          </div>

          <div className="space-y-2">
            <Label>保存位置</Label>
            <div className="p-2 bg-muted rounded-md text-sm">
              📁 AI 生成（默认）
            </div>
          </div>

          <div className="space-y-2">
            <Label>内容预览</Label>
            <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground max-h-[150px] overflow-y-auto">
              {contentPreview}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !title.trim()}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
