/**
 * 垃圾箱工具栏组件
 * 提供批量恢复、清空垃圾箱等操作
 */

"use client";

import { useState } from "react";
import { Trash2, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import { clientLogger } from "@/lib/client-logger";

interface TrashToolbarProps {
  // 批量选择
  selectedCount: number;
  onBatchRestore?: () => Promise<void>;
  onEmptyTrash?: () => Promise<void>;
  // 统计信息
  totalCount?: number;
}

export function TrashToolbar({
  selectedCount,
  onBatchRestore,
  onEmptyTrash,
  totalCount = 0,
}: TrashToolbarProps) {
  const [isRestoring, setIsRestoring] = useState(false);
  const [isEmptying, setIsEmptying] = useState(false);
  const [showEmptyDialog, setShowEmptyDialog] = useState(false);

  const handleBatchRestore = async () => {
    if (!onBatchRestore || selectedCount === 0) return;

    setIsRestoring(true);
    try {
      await onBatchRestore();
      toast.success(`已恢复 ${selectedCount} 个收藏`);
    } catch (error) {
      toast.error("批量恢复失败");
      clientLogger.error({ error }, "Batch restore failed");
    } finally {
      setIsRestoring(false);
    }
  };

  const handleEmptyTrash = async () => {
    if (!onEmptyTrash) return;

    setIsEmptying(true);
    try {
      await onEmptyTrash();
      toast.success("垃圾箱已清空");
      setShowEmptyDialog(false);
    } catch (error) {
      toast.error("清空垃圾箱失败");
      clientLogger.error({ error }, "Empty trash failed");
    } finally {
      setIsEmptying(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 border-b dark:border-gray-800">
        {/* 左侧：统计信息 */}
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {totalCount > 0 ? (
              <>
                垃圾箱 ({totalCount} 个收藏)
                {selectedCount > 0 && (
                  <span className="ml-2 text-blue-600 dark:text-blue-400">
                    已选择 {selectedCount} 个
                  </span>
                )}
              </>
            ) : (
              "垃圾箱为空"
            )}
          </div>
        </div>

        {/* 右侧：操作按钮 */}
        <div className="flex items-center gap-2">
          {/* 批量恢复按钮 */}
          {selectedCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleBatchRestore}
              disabled={isRestoring}
            >
              {isRestoring ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  恢复中...
                </>
              ) : (
                <>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  恢复选中项
                </>
              )}
            </Button>
          )}

          {/* 清空垃圾箱按钮 */}
          {totalCount > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowEmptyDialog(true)}
              disabled={isEmptying}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              清空垃圾箱
            </Button>
          )}
        </div>
      </div>

      {/* 清空垃圾箱确认对话框 */}
      <AlertDialog open={showEmptyDialog} onOpenChange={setShowEmptyDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确定要清空垃圾箱吗?</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将永久删除垃圾箱中的所有 {totalCount}{" "}
              个收藏，此操作不可恢复!
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isEmptying}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEmptyTrash}
              disabled={isEmptying}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isEmptying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  清空中...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  确定清空
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
