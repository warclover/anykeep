/**
 * 批量选择模式 Hook
 * 管理书签的批量选择状态和操作
 */

import { useState, useCallback } from "react";

export interface SelectionModeState {
  isSelectionMode: boolean;
  selectedIds: Set<number>;
  isBatchDeleting: boolean;
}

export interface SelectionModeActions {
  toggleSelectionMode: () => void;
  toggleSelect: (id: number) => void;
  selectAll: (allIds: number[]) => void;
  deselectAll: () => void;
  setIsBatchDeleting: (deleting: boolean) => void;
  exitSelectionMode: () => void;
}

export type UseSelectionModeReturn = SelectionModeState & SelectionModeActions;

/**
 * 批量选择模式 Hook
 */
export function useSelectionMode(): UseSelectionModeReturn {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  // 切换选择模式
  const toggleSelectionMode = useCallback(() => {
    setIsSelectionMode((prev) => !prev);
    setSelectedIds(new Set());
  }, []);

  // 退出选择模式
  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  // 切换单个项目的选中状态
  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // 全选
  const selectAll = useCallback((allIds: number[]) => {
    setSelectedIds(new Set(allIds));
  }, []);

  // 取消全选
  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  return {
    // 状态
    isSelectionMode,
    selectedIds,
    isBatchDeleting,

    // 操作
    toggleSelectionMode,
    toggleSelect,
    selectAll,
    deselectAll,
    setIsBatchDeleting,
    exitSelectionMode,
  };
}
