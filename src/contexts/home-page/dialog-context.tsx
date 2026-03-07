/**
 * 对话框 Context
 *
 * Phase 2 性能优化：从 HomePageContext 拆分出对话框相关状态
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
import type { DialogType } from "@/components/home/types";
import { uiEventBus, UIEvents } from "@/lib/shared/event-bus";

// ============================================================================
// 类型定义
// ============================================================================

export interface DialogContextState {
  openDialog: DialogType | null;
}

export interface DialogContextActions {
  openDialogAction: (type: DialogType) => void;
  closeDialog: () => void;
}

export type DialogContextType = DialogContextState & DialogContextActions;

// ============================================================================
// Context 创建
// ============================================================================

export const DialogContext = createContext<DialogContextType | null>(null);

// ============================================================================
// Provider 实现
// ============================================================================

interface DialogProviderProps {
  children: ReactNode;
}

export function DialogProvider({ children }: DialogProviderProps) {
  const [openDialogState, setOpenDialogState] = useState<DialogType | null>(
    null,
  );

  // 防止自回环：标记当前 emit 来源是否为自身
  const isEmittingRef = useRef(false);

  const openDialogAction = useCallback((type: DialogType) => {
    setOpenDialogState(type);
    isEmittingRef.current = true;
    uiEventBus.emit(UIEvents.DIALOG_OPEN, { type });
    isEmittingRef.current = false;
  }, []);

  const closeDialog = useCallback(() => {
    setOpenDialogState(null);
    isEmittingRef.current = true;
    uiEventBus.emit(UIEvents.DIALOG_CLOSE, {});
    isEmittingRef.current = false;
  }, []);

  // 订阅外部事件（仅响应非自身触发的事件）
  useEffect(() => {
    const unsubscribe = uiEventBus.on(UIEvents.DIALOG_OPEN, (payload) => {
      if (isEmittingRef.current) return;
      setOpenDialogState(payload.type);
    });

    return unsubscribe;
  }, []);

  const value = useMemo<DialogContextType>(
    () => ({
      openDialog: openDialogState,
      openDialogAction,
      closeDialog,
    }),
    [openDialogState, openDialogAction, closeDialog],
  );

  return (
    <DialogContext.Provider value={value}>{children}</DialogContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

export function useDialog(): DialogContextType {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("useDialog must be used within DialogProvider");
  }
  return context;
}

export function useDialogSafe(): DialogContextType | null {
  return useContext(DialogContext);
}
