/**
 * 选择模式 Context
 *
 * Phase 2 性能优化：从 HomePageContext 拆分出选择模式相关状态
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
  useEffect,
  type ReactNode,
} from "react";
import { uiEventBus, UIEvents } from "@/lib/shared/event-bus";

// ============================================================================
// 类型定义
// ============================================================================

export interface SelectionContextState {
  isSelectionMode: boolean;
}

export interface SelectionContextActions {
  setSelectionMode: (enabled: boolean) => void;
  toggleSelectionMode: () => void;
}

export type SelectionContextType = SelectionContextState &
  SelectionContextActions;

// ============================================================================
// Context 创建
// ============================================================================

export const SelectionContext = createContext<SelectionContextType | null>(
  null,
);

// ============================================================================
// Provider 实现
// ============================================================================

interface SelectionProviderProps {
  children: ReactNode;
}

export function SelectionProvider({ children }: SelectionProviderProps) {
  const [isSelectionMode, setIsSelectionModeState] = useState(false);

  const setSelectionMode = useCallback((enabled: boolean) => {
    setIsSelectionModeState(enabled);
    uiEventBus.emit(UIEvents.SELECTION_TOGGLE, { enabled });
  }, []);

  const toggleSelectionMode = useCallback(() => {
    setIsSelectionModeState((prev) => {
      const newValue = !prev;
      uiEventBus.emit(UIEvents.SELECTION_TOGGLE, { enabled: newValue });
      return newValue;
    });
  }, []);

  // 订阅外部事件
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    unsubscribers.push(
      uiEventBus.on(UIEvents.SELECTION_TOGGLE, (payload) => {
        setIsSelectionModeState(payload.enabled);
      }),
    );

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, []);

  const value = useMemo<SelectionContextType>(
    () => ({
      isSelectionMode,
      setSelectionMode,
      toggleSelectionMode,
    }),
    [isSelectionMode, setSelectionMode, toggleSelectionMode],
  );

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

export function useSelection(): SelectionContextType {
  const context = useContext(SelectionContext);
  if (!context) {
    throw new Error("useSelection must be used within SelectionProvider");
  }
  return context;
}

export function useSelectionSafe(): SelectionContextType | null {
  return useContext(SelectionContext);
}
