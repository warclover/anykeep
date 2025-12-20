/**
 * V4.2.17: 首页批量操作工具栏组件
 *
 * Phase 2.3.3 - 从 home-page-client.tsx 提取
 *
 * 职责：批量选择模式下的操作工具栏
 * 特性：全选/取消、删除、移动、标签、创建快照
 */

"use client";

import { memo } from "react";
import { Trash2, FolderInput, Camera, Loader2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";

// ============================================================================
// Props 类型
// ============================================================================

export interface HomeBatchToolbarProps {
  /** 已选择数量 */
  selectedCount: number;
  /** 书签总数（用于全选） */
  totalCount: number;
  /** 批量删除中状态 */
  isBatchDeleting: boolean;
  /** 批量创建快照中状态 */
  isBatchCreatingSnapshot: boolean;
  /** 快照功能是否启用 */
  isSnapshotEnabled: boolean;
  /** 全选回调 */
  onSelectAll: () => void;
  /** 取消全选回调 */
  onDeselectAll: () => void;
  /** 批量删除回调 */
  onBatchDelete: () => void;
  /** 打开移动对话框回调 */
  onOpenMoveDialog: () => void;
  /** 打开标签对话框回调 */
  onOpenTagDialog?: () => void;
  /** 批量创建快照回调 */
  onBatchCreateSnapshot?: () => void;
}

// ============================================================================
// 组件实现
// ============================================================================

export const HomeBatchToolbar = memo(function HomeBatchToolbar({
  selectedCount,
  totalCount,
  isBatchDeleting,
  isBatchCreatingSnapshot,
  isSnapshotEnabled,
  onSelectAll,
  onDeselectAll,
  onBatchDelete,
  onOpenMoveDialog,
  onOpenTagDialog,
  onBatchCreateSnapshot,
}: HomeBatchToolbarProps) {
  // 无选中项时不渲染
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between">
      {/* 左侧：选择信息 + 全选操作 */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
          已选择 {selectedCount} 条
        </span>

        {/* 全选按钮 */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onSelectAll}
          disabled={selectedCount === totalCount}
          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          全选
        </Button>

        {/* 取消全选按钮 */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onDeselectAll}
          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          取消全选
        </Button>
      </div>

      {/* 右侧：批量操作按钮 */}
      <div className="flex items-center gap-2">
        {/* 删除按钮 */}
        <Button
          variant="outline"
          size="sm"
          onClick={onBatchDelete}
          disabled={isBatchDeleting}
          className="text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:border-red-800 dark:hover:bg-red-900/20"
        >
          {isBatchDeleting ? (
            <>
              <Loader2 className="size-4 mr-1.5 animate-spin" />
              删除中...
            </>
          ) : (
            <>
              <Trash2 className="size-4 mr-1.5" />
              删除
            </>
          )}
        </Button>

        {/* 移动到文件夹按钮 */}
        <Button variant="outline" size="sm" onClick={onOpenMoveDialog}>
          <FolderInput className="size-4 mr-1.5" />
          移动到文件夹
        </Button>

        {/* 标签操作按钮 */}
        {onOpenTagDialog && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenTagDialog}
            className="text-purple-600 hover:text-purple-700 border-purple-200 hover:bg-purple-50 dark:text-purple-400 dark:hover:text-purple-300 dark:border-purple-800 dark:hover:bg-purple-900/20"
          >
            <Tag className="size-4 mr-1.5" />
            标签
          </Button>
        )}

        {/* 创建快照按钮（功能开关控制） */}
        {isSnapshotEnabled && onBatchCreateSnapshot && (
          <Button
            variant="outline"
            size="sm"
            onClick={onBatchCreateSnapshot}
            disabled={isBatchCreatingSnapshot}
            className="text-blue-600 hover:text-blue-700 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-900/20"
          >
            {isBatchCreatingSnapshot ? (
              <>
                <Loader2 className="size-4 mr-1.5 animate-spin" />
                创建中...
              </>
            ) : (
              <>
                <Camera className="size-4 mr-1.5" />
                创建快照
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
});

export default HomeBatchToolbar;
