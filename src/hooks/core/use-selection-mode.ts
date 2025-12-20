/**
 * 批量选择模式 Hook
 * 管理书签的批量选择状态和操作
 *
 * V2.0: 支持 Shift 范围选择
 * - 单击: 切换单个项目的选中状态
 * - Shift+点击: 选中从上次点击位置到当前位置的所有项目
 *
 * V2.1: 性能优化
 * - 使用 Map 缓存 ID->Index 映射，O(1) 查找替代 O(n) indexOf
 */

import { useState, useCallback, useRef } from "react";

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
  /**
   * V2.0: 处理带有 Shift 支持的项目点击
   * @param id - 点击的项目 ID
   * @param allIds - 所有项目的有序 ID 列表
   * @param isShiftKey - 是否按住了 Shift 键
   */
  handleItemClick: (id: number, allIds: number[], isShiftKey: boolean) => void;
}

export type UseSelectionModeReturn = SelectionModeState & SelectionModeActions;

/**
 * 批量选择模式 Hook
 */
export function useSelectionMode(): UseSelectionModeReturn {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  // V2.0: 记录上次点击的项目 ID（用于 Shift 范围选择）
  const lastClickedIdRef = useRef<number | null>(null);

  // V2.1: 缓存 ID->Index 映射，避免重复构建
  const idIndexMapRef = useRef<Map<number, number>>(new Map());
  const cachedAllIdsRef = useRef<number[]>([]);

  /**
   * V2.1: 获取或构建 ID->Index 映射
   * 仅当 allIds 数组引用变化时才重新构建
   */
  const getIdIndexMap = useCallback((allIds: number[]): Map<number, number> => {
    if (cachedAllIdsRef.current !== allIds) {
      // 构建新的映射
      const newMap = new Map<number, number>();
      for (let i = 0; i < allIds.length; i++) {
        newMap.set(allIds[i], i);
      }
      idIndexMapRef.current = newMap;
      cachedAllIdsRef.current = allIds;
    }
    return idIndexMapRef.current;
  }, []);

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
    // V2.0: 记录本次点击，用于后续 Shift 选择
    lastClickedIdRef.current = id;
  }, []);

  /**
   * V2.0: 处理带有 Shift 支持的项目点击
   * V2.1: 使用 Map 优化 O(1) 查找
   * @param id - 点击的项目 ID
   * @param allIds - 所有项目的有序 ID 列表
   * @param isShiftKey - 是否按住了 Shift 键
   */
  const handleItemClick = useCallback(
    (id: number, allIds: number[], isShiftKey: boolean) => {
      if (!isShiftKey || lastClickedIdRef.current === null) {
        // 普通点击：切换选中状态
        toggleSelect(id);
        return;
      }

      // Shift 点击：范围选择
      const lastId = lastClickedIdRef.current;

      // V2.1: 使用 Map 进行 O(1) 查找
      const idIndexMap = getIdIndexMap(allIds);
      const startIndex = idIndexMap.get(lastId);
      const endIndex = idIndexMap.get(id);

      if (startIndex === undefined || endIndex === undefined) {
        // ID 不在列表中，退化为普通点击
        toggleSelect(id);
        return;
      }

      // 确定范围的起止位置
      const minIndex = Math.min(startIndex, endIndex);
      const maxIndex = Math.max(startIndex, endIndex);

      // 获取范围内的所有 ID
      const rangeIds = allIds.slice(minIndex, maxIndex + 1);

      // 将范围内的所有 ID 添加到选中集合
      setSelectedIds((prev) => {
        const newSet = new Set(prev);
        rangeIds.forEach((rangeId) => newSet.add(rangeId));
        return newSet;
      });

      // 更新最后点击的 ID
      lastClickedIdRef.current = id;
    },
    [toggleSelect, getIdIndexMap],
  );

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
    handleItemClick,
  };
}
