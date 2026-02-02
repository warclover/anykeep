'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useState } from 'react';

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemCount: number;
  itemType?: 'bookmark' | 'folder' | 'tag';
  onConfirm: () => void;
  showDontAskAgain?: boolean;
  onDontAskAgainChange?: (checked: boolean) => void;
}

const ITEM_TYPE_LABELS: Record<string, string> = {
  bookmark: '书签',
  folder: '文件夹',
  tag: '标签',
};

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  itemCount,
  itemType = 'bookmark',
  onConfirm,
  showDontAskAgain = true,
  onDontAskAgainChange,
}: DeleteConfirmDialogProps) {
  const [dontAskAgain, setDontAskAgain] = useState(false);

  const typeLabel = ITEM_TYPE_LABELS[itemType] || '项目';

  const handleConfirm = () => {
    if (dontAskAgain && onDontAskAgainChange) {
      onDontAskAgainChange(true);
    }
    onConfirm();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <span>⚠️</span>
            确认删除
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              确定要删除选中的 <strong>{itemCount}</strong> 个{typeLabel}吗？
            </p>
            <p className="text-muted-foreground text-sm">
              删除后可在 10 秒内撤销操作。
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {showDontAskAgain && (
          <div className="flex items-center space-x-2 py-2">
            <Checkbox
              id="dont-ask-again"
              checked={dontAskAgain}
              onCheckedChange={(checked) => setDontAskAgain(checked === true)}
            />
            <label
              htmlFor="dont-ask-again"
              className="text-sm text-muted-foreground cursor-pointer"
            >
              不再询问
            </label>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
