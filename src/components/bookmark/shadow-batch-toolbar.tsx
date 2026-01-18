/**
 * 影子分拣批量操作工具栏
 * 用于 Shadow Sorting (Inbox Zero) 功能
 * 提供批量确认/拒绝操作
 */

"use client";

import { Check, X, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ShadowBatchToolbarProps {
  totalCount: number;
  selectedCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBatchConfirm: () => void;
  onBatchReject: () => void;
  isLoading?: boolean;
}

/**
 * 影子分拣批量操作工具栏
 */
export function ShadowBatchToolbar({
  totalCount,
  selectedCount,
  onSelectAll,
  onDeselectAll,
  onBatchConfirm,
  onBatchReject,
  isLoading = false,
}: ShadowBatchToolbarProps) {
  const hasSelection = selectedCount > 0;
  const isAllSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card p-2">
      {/* 全选/取消全选 */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              onClick={isAllSelected ? onDeselectAll : onSelectAll}
              disabled={totalCount === 0 || isLoading}
              className="h-8 gap-1.5"
            >
              {isAllSelected ? (
                <CheckSquare className="h-4 w-4" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              <span className="text-xs">
                {isAllSelected ? "取消全选" : "全选"}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isAllSelected
              ? "取消选择所有书签"
              : `选择所有 ${totalCount} 个书签`}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Separator orientation="vertical" className="h-6" />

      {/* 选中数量显示 */}
      <div className="flex items-center gap-1.5 px-2">
        <span className="text-sm text-muted-foreground">已选择</span>
        <span className="text-sm font-semibold text-foreground">
          {selectedCount}
        </span>
        <span className="text-sm text-muted-foreground">/ {totalCount}</span>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* 批量确认按钮 */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="default"
              onClick={onBatchConfirm}
              disabled={!hasSelection || isLoading}
              className="h-8 gap-1.5 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
            >
              <Check className="h-4 w-4" />
              <span className="text-xs">批量确认</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>确认选中的 {selectedCount} 个建议</p>
            <p className="text-xs text-muted-foreground">
              书签将移动到建议的文件夹
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* 批量拒绝按钮 */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              onClick={onBatchReject}
              disabled={!hasSelection || isLoading}
              className="h-8 gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
            >
              <X className="h-4 w-4" />
              <span className="text-xs">批量拒绝</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>拒绝选中的 {selectedCount} 个建议</p>
            <p className="text-xs text-muted-foreground">
              书签将保持在当前位置
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
