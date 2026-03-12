/**
 * Home V2 Zustand Store
 *
 * 管理首页高频状态（选择模式 + 对话框），替代旧版 SelectionContext + DialogContext。
 * 利用 Zustand selector 实现字段级订阅，避免无关状态变化触发重渲染。
 *
 * 解决问题：A3（Set 引用不稳定）、A14（queueMicrotask hack）、A15（对话框状态冗余）、A16（Provider 层级过深）
 *
 * @since home-v2
 */

import { create } from "zustand";

// ============================================================================
// 类型定义
// ============================================================================

/** 对话框类型枚举 */
export type HomeDialogType =
  | "create"
  | "import"
  | "browserImport"
  | "export"
  | "move"
  | "batchTag"
  | "synthesis"
  | null;

interface HomeV2State {
  // ========== 选择模式 ==========
  isSelectionMode: boolean;
  selectedIds: Set<number>;
  /** 上一次点击的 ID（用于 Shift 范围选择） */
  lastSelectedId: number | null;

  // ========== 对话框 ==========
  activeDialog: HomeDialogType;

  // ========== 批量操作状态 ==========
  isBatchDeleting: boolean;
  isBatchCreatingSnapshot: boolean;
}

interface HomeV2Actions {
  // ========== 选择模式操作 ==========
  toggleSelect: (id: number) => void;
  /** Shift 范围选择 */
  rangeSelect: (id: number, allIds: number[]) => void;
  selectAll: (ids: number[]) => void;
  deselectAll: () => void;
  enterSelectionMode: () => void;
  exitSelectionMode: () => void;

  // ========== 对话框操作 ==========
  openDialog: (type: HomeDialogType) => void;
  closeDialog: () => void;

  // ========== 批量操作状态 ==========
  setBatchDeleting: (value: boolean) => void;
  setBatchCreatingSnapshot: (value: boolean) => void;
}

export type HomeV2Store = HomeV2State & HomeV2Actions;

// ============================================================================
// Store 实现
// ============================================================================

export const useHomeV2Store = create<HomeV2Store>((set, get) => ({
  // ========== 初始状态 ==========
  isSelectionMode: false,
  selectedIds: new Set<number>(),
  lastSelectedId: null,
  activeDialog: null,
  isBatchDeleting: false,
  isBatchCreatingSnapshot: false,

  // ========== 选择模式操作 ==========
  toggleSelect: (id: number) => {
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { selectedIds: next, lastSelectedId: id };
    });
  },

  rangeSelect: (id: number, allIds: number[]) => {
    const { lastSelectedId, selectedIds } = get();
    if (lastSelectedId === null) {
      // 无上次选择，当作普通 toggle
      get().toggleSelect(id);
      return;
    }

    const startIdx = allIds.indexOf(lastSelectedId);
    const endIdx = allIds.indexOf(id);
    if (startIdx === -1 || endIdx === -1) return;

    const [from, to] =
      startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
    const next = new Set(selectedIds);
    for (let i = from; i <= to; i++) {
      next.add(allIds[i]);
    }

    set({ selectedIds: next, lastSelectedId: id });
  },

  selectAll: (ids: number[]) => {
    set({ selectedIds: new Set(ids) });
  },

  deselectAll: () => {
    set({ selectedIds: new Set<number>(), lastSelectedId: null });
  },

  enterSelectionMode: () => {
    set({ isSelectionMode: true });
  },

  exitSelectionMode: () => {
    set({
      isSelectionMode: false,
      selectedIds: new Set<number>(),
      lastSelectedId: null,
    });
  },

  // ========== 对话框操作 ==========
  openDialog: (type: HomeDialogType) => {
    set({ activeDialog: type });
  },

  closeDialog: () => {
    set({ activeDialog: null });
  },

  // ========== 批量操作状态 ==========
  setBatchDeleting: (value: boolean) => {
    set({ isBatchDeleting: value });
  },

  setBatchCreatingSnapshot: (value: boolean) => {
    set({ isBatchCreatingSnapshot: value });
  },
}));
