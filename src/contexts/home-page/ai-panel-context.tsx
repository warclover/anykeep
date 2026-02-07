/**
 * AI 面板 Context
 *
 * Phase 2 性能优化：从 HomePageContext 拆分出 AI 面板相关状态
 *
 * @version 1.0.0
 * @since 2026-02-07
 */

"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";

// ============================================================================
// 类型定义
// ============================================================================

export interface AIPanelContextState {
  isAIPanelOpen: boolean;
  isFilterPanelOpen: boolean;
  isCreatePanelOpen: boolean;
}

export interface AIPanelContextActions {
  openAIPanel: () => void;
  closeAIPanel: () => void;
  toggleAIPanel: () => void;
  openFilterPanel: () => void;
  closeFilterPanel: () => void;
  toggleFilterPanel: () => void;
  openCreatePanel: () => void;
  closeCreatePanel: () => void;
  toggleCreatePanel: () => void;
}

export type AIPanelContextType = AIPanelContextState & AIPanelContextActions;

// ============================================================================
// Context 创���
// ============================================================================

export const AIPanelContext = createContext<AIPanelContextType | null>(null);

// ============================================================================
// Provider 实现
// ============================================================================

interface AIPanelProviderProps {
  children: ReactNode;
}

export function AIPanelProvider({ children }: AIPanelProviderProps) {
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [isCreatePanelOpen, setIsCreatePanelOpen] = useState(false);

  // AI 面板操作
  const openAIPanel = useCallback(() => setIsAIPanelOpen(true), []);
  const closeAIPanel = useCallback(() => setIsAIPanelOpen(false), []);
  const toggleAIPanel = useCallback(
    () => setIsAIPanelOpen((prev) => !prev),
    [],
  );

  // 用途筛选面板操作
  const openFilterPanel = useCallback(() => setIsFilterPanelOpen(true), []);
  const closeFilterPanel = useCallback(() => setIsFilterPanelOpen(false), []);
  const toggleFilterPanel = useCallback(
    () => setIsFilterPanelOpen((prev) => !prev),
    [],
  );

  // 手动创建面板操作
  const openCreatePanel = useCallback(() => setIsCreatePanelOpen(true), []);
  const closeCreatePanel = useCallback(() => setIsCreatePanelOpen(false), []);
  const toggleCreatePanel = useCallback(
    () => setIsCreatePanelOpen((prev) => !prev),
    [],
  );

  const value = useMemo<AIPanelContextType>(
    () => ({
      isAIPanelOpen,
      isFilterPanelOpen,
      isCreatePanelOpen,
      openAIPanel,
      closeAIPanel,
      toggleAIPanel,
      openFilterPanel,
      closeFilterPanel,
      toggleFilterPanel,
      openCreatePanel,
      closeCreatePanel,
      toggleCreatePanel,
    }),
    [
      isAIPanelOpen,
      isFilterPanelOpen,
      isCreatePanelOpen,
      openAIPanel,
      closeAIPanel,
      toggleAIPanel,
      openFilterPanel,
      closeFilterPanel,
      toggleFilterPanel,
      openCreatePanel,
      closeCreatePanel,
      toggleCreatePanel,
    ],
  );

  return (
    <AIPanelContext.Provider value={value}>{children}</AIPanelContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

export function useAIPanel(): AIPanelContextType {
  const context = useContext(AIPanelContext);
  if (!context) {
    throw new Error("useAIPanel must be used within AIPanelProvider");
  }
  return context;
}

export function useAIPanelSafe(): AIPanelContextType | null {
  return useContext(AIPanelContext);
}
