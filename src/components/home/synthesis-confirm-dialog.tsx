"use client";

import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SynthesisConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  isCreating: boolean;
  onConfirm: () => void;
}

/**
 * 综述确认对话框
 * 提取为独立组件以支持懒加载，减少首屏 AlertDialog/Radix UI 依赖
 */
export function SynthesisConfirmDialog({
  open,
  onOpenChange,
  selectedCount,
  isCreating,
  onConfirm,
}: SynthesisConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>生成主题综述</AlertDialogTitle>
          <AlertDialogDescription>
            将为选中的 {selectedCount} 个书签生成 AI 综述报告。
            报告将包含概述、共识、分歧点和知识盲区分��。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isCreating}>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isCreating}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                创建中...
              </>
            ) : (
              "开始生成"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
