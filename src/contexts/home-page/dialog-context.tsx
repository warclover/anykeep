/**
 * 对话框 Context
 *
 * Phase 2 性能优化：从 HomePageContext 拆分出对话框相关状态
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

  const openDialogAction = useCallback((type: DialogType) => {
    setOpenDialogState(type);
    uiEventBus.emit(UIEvents.DIALOG_OPEN, { type });
  }, []);

  const closeDialog = useCallback(() => {
    setOpenDialogState(null);
    uiEventBus.emit(UIEvents.DIALOG_CLOSE, {});
  }, []);

  // 订阅外部事件
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    unsubscribers.push(
      uiEventBus.on(UIEvents.DIALOG_OPEN, (payload) => {
        setOpenDialogState(payload.type);
      }),
    );

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
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
