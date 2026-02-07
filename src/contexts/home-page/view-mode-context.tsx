/**
 * 视图模式 Context
 *
 * Phase 2 性能优化：从 HomePageContext 拆分出视图模式相关状态
 * 只有订阅视图模式的组件才会在视图模式变化时重渲染
 *
 * @version 1.0.0
 * @since 2026-02-07
 */

"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import type { ViewMode, LayoutMode } from "@/components/home/types";
import { uiEventBus, UIEvents } from "@/lib/shared/event-bus";
import {
  VIEW_MODE_STORAGE_KEY,
  LAYOUT_MODE_STORAGE_KEY,
  FLIP_CARD_STORAGE_KEY,
  DEFAULT_VIEW_MODE,
  DEFAULT_LAYOUT_MODE,
} from "@/components/home/constants";

// ============================================================================
// 类型定义
// ============================================================================

export interface ViewModeContextState {
  viewMode: ViewMode;
  layoutMode: LayoutMode;
  enableFlipCard: boolean;
}

export interface ViewModeContextActions {
  setViewMode: (mode: ViewMode) => void;
  setLayoutMode: (mode: LayoutMode) => void;
  setEnableFlipCard: (enabled: boolean) => void;
}

export type ViewModeContextType = ViewModeContextState & ViewModeContextActions;

// ============================================================================
// Context 创建
// ============================================================================

export const ViewModeContext = createContext<ViewModeContextType | null>(null);

// ============================================================================
// localStorage 工具函数
// ============================================================================

function getStoredViewMode(): ViewMode {
  if (typeof window === "undefined") return DEFAULT_VIEW_MODE;
  const saved = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
  if (saved && ["card", "list", "compact"].includes(saved)) {
    return saved as ViewMode;
  }
  return DEFAULT_VIEW_MODE;
}

function getStoredLayoutMode(): LayoutMode {
  if (typeof window === "undefined") return DEFAULT_LAYOUT_MODE;
  const saved = localStorage.getItem(LAYOUT_MODE_STORAGE_KEY);
  if (saved && ["auto", "row", "column"].includes(saved)) {
    return saved as LayoutMode;
  }
  return DEFAULT_LAYOUT_MODE;
}

function getStoredFlipCard(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(FLIP_CARD_STORAGE_KEY) === "true";
}

// ============================================================================
// Provider 实现
// ============================================================================

interface ViewModeProviderProps {
  children: ReactNode;
}

export function ViewModeProvider({ children }: ViewModeProviderProps) {
  // 使用默认值初始化，useEffect 后读取 localStorage（避免 hydration 问题）
  const [viewMode, setViewModeState] = useState<ViewMode>(DEFAULT_VIEW_MODE);
  const [layoutMode, setLayoutModeState] =
    useState<LayoutMode>(DEFAULT_LAYOUT_MODE);
  const [enableFlipCard, setEnableFlipCardState] = useState<boolean>(false);

  // 客户端 hydration 后从 localStorage 读取初始值
  // 这是合法的 hydration 模式：SSR 使用默认值，客户端挂载后从 localStorage 同步
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 合法的 hydration 模式
    setViewModeState(getStoredViewMode());

    setLayoutModeState(getStoredLayoutMode());

    setEnableFlipCardState(getStoredFlipCard());
  }, []);

  // 使用 ref 存储回调需要的状态值，保持回调引用稳定
  const stateRef = useRef({ viewMode, layoutMode, enableFlipCard });
  useEffect(() => {
    stateRef.current = { viewMode, layoutMode, enableFlipCard };
  }, [viewMode, layoutMode, enableFlipCard]);

  // 视图模式操作（带持久化）
  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
    uiEventBus.emit(UIEvents.VIEW_MODE_CHANGE, { mode });
  }, []);

  const setLayoutMode = useCallback((mode: LayoutMode) => {
    setLayoutModeState(mode);
    localStorage.setItem(LAYOUT_MODE_STORAGE_KEY, mode);
    uiEventBus.emit(UIEvents.LAYOUT_MODE_CHANGE, { mode });
  }, []);

  const setEnableFlipCard = useCallback((enabled: boolean) => {
    setEnableFlipCardState(enabled);
    localStorage.setItem(FLIP_CARD_STORAGE_KEY, String(enabled));
    uiEventBus.emit(UIEvents.FLIP_CARD_CHANGE, { enabled });
  }, []);

  // 订阅外部事件（UIEventBus）
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    unsubscribers.push(
      uiEventBus.on(UIEvents.VIEW_MODE_CHANGE, (payload) => {
        setViewModeState(payload.mode);
      }),
    );
    unsubscribers.push(
      uiEventBus.on(UIEvents.LAYOUT_MODE_CHANGE, (payload) => {
        setLayoutModeState(payload.mode);
      }),
    );
    unsubscribers.push(
      uiEventBus.on(UIEvents.FLIP_CARD_CHANGE, (payload) => {
        setEnableFlipCardState(payload.enabled);
      }),
    );

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, []);

  const value = useMemo<ViewModeContextType>(
    () => ({
      viewMode,
      layoutMode,
      enableFlipCard,
      setViewMode,
      setLayoutMode,
      setEnableFlipCard,
    }),
    [
      viewMode,
      layoutMode,
      enableFlipCard,
      setViewMode,
      setLayoutMode,
      setEnableFlipCard,
    ],
  );

  return (
    <ViewModeContext.Provider value={value}>
      {children}
    </ViewModeContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * 获取视图模式相关状态和操作
 */
export function useViewMode(): ViewModeContextType {
  const context = useContext(ViewModeContext);
  if (!context) {
    throw new Error("useViewMode must be used within ViewModeProvider");
  }
  return context;
}

/**
 * 安全版本：如果不在 Provider 内则返回 null
 */
export function useViewModeSafe(): ViewModeContextType | null {
  return useContext(ViewModeContext);
}
