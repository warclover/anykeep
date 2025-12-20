/**
 * 批量操作工具栏组件
 * 显示选中数量和批量操作按钮
 */

"use client";

import { memo } from "react";
import { CheckSquare, Tag, Trash2, X, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BATCH_TEXT } from "./constants";

interface BatchToolbarProps {
  /** 选中数量 */
  selectedCount: number;
  /** 总数量 */
  totalCount: number;
  /** 全选回调 */
  onSelectAll: () => void;
  /** 清空选择回调 */
  onClearSelection: () => void;
  /** 打开标签对话框回调 */
  onOpenTagDialog: () => void;
  /** 打开导出对话框回调 */
  onOpenExportDialog?: () => void;
  /** 批量删除回调 */
  onBatchDelete?: () => void;
  /** 是否正在处理 */
  isProcessing?: boolean;
}

/**
 * 批量操作工具栏组件
 */
export const BatchToolbar = memo(function BatchToolbar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onOpenTagDialog,
  onOpenExportDialog,
  onBatchDelete,
  isProcessing = false,
}: BatchToolbarProps) {
  const isAllSelected = selectedCount > 0 && selectedCount === totalCount;

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800">
      {/* 左侧：选择操作 */}
      <div className="flex items-center gap-2">
        {/* 全选/取消全选 */}
        <Button
          variant="ghost"
          size="sm"
          onClick={isAllSelected ? onClearSelection : onSelectAll}
          className="h-8 px-2 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800/50"
        >
          <CheckSquare className="h-4 w-4 mr-1" />
          {isAllSelected ? "取消全选" : BATCH_TEXT.SELECT_ALL}
        </Button>

        {/* 分隔线 */}
        <div className="h-4 w-px bg-blue-200 dark:bg-blue-700" />

        {/* 标签操作 */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenTagDialog}
          disabled={selectedCount === 0 || isProcessing}
          className="h-8 px-2 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800/50"
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Tag className="h-4 w-4 mr-1" />
          )}
          标签
        </Button>

        {/* 导出操作 */}
        {onOpenExportDialog && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenExportDialog}
            disabled={selectedCount === 0 || isProcessing}
            className="h-8 px-2 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20"
          >
            <Download className="h-4 w-4 mr-1" />
            {BATCH_TEXT.EXPORT}
          </Button>
        )}

        {/* 删除操作 */}
        {onBatchDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onBatchDelete}
            disabled={selectedCount === 0 || isProcessing}
            className="h-8 px-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            {BATCH_TEXT.DELETE}
          </Button>
        )}
      </div>

      {/* 右侧：选中数量和清空 */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-blue-700 dark:text-blue-300">
          {BATCH_TEXT.SELECTED_COUNT(selectedCount)}
        </span>

        {selectedCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            className="h-8 px-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="h-4 w-4 mr-1" />
            {BATCH_TEXT.CLEAR_SELECTION}
          </Button>
        )}
      </div>
    </div>
  );
});
