/**
 * 选择模式 Context
 *
 * Phase 2 性能优化：从 HomePageContext 拆分出选择模式相关状态
 *
 * @version 1.1.0
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
  useRef,
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

  // 防止自回环：标记当前 emit 来源是否为自身
  const isEmittingRef = useRef(false);

  const setSelectionMode = useCallback((enabled: boolean) => {
    setIsSelectionModeState(enabled);
    isEmittingRef.current = true;
    uiEventBus.emit(UIEvents.SELECTION_TOGGLE, { enabled });
    isEmittingRef.current = false;
  }, []);

  const toggleSelectionMode = useCallback(() => {
    setIsSelectionModeState((prev) => {
      const newValue = !prev;
      // 使用 queueMicrotask 将副作用移出 updater 函数，
      // 避免 React 严格模式下 updater 被调用两次导致 emit 两次
      queueMicrotask(() => {
        isEmittingRef.current = true;
        uiEventBus.emit(UIEvents.SELECTION_TOGGLE, { enabled: newValue });
        isEmittingRef.current = false;
      });
      return newValue;
    });
  }, []);

  // 订阅外部事件（仅响应非自身触发的事件）
  useEffect(() => {
    const unsubscribe = uiEventBus.on(UIEvents.SELECTION_TOGGLE, (payload) => {
      if (isEmittingRef.current) return;
      setIsSelectionModeState(payload.enabled);
    });

    return unsubscribe;
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
