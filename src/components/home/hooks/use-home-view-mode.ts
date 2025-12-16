/**
 * V4.2.15: 首页视图模式 Hook
 *
 * 从 home-page-client.tsx 提取，管理：
 * - 视图模式（card/list/compact）
 * - 布局模式（auto/row/column）
 * - 翻转卡片开关
 * - localStorage 持久化
 */

import { useState, useEffect, useCallback } from "react";
import {
  type ViewMode,
  type LayoutMode,
  DEFAULT_VIEW_MODE,
  DEFAULT_LAYOUT_MODE,
  VIEW_MODE_STORAGE_KEY,
  LAYOUT_MODE_STORAGE_KEY,
  FLIP_CARD_STORAGE_KEY,
} from "../constants";

interface UseHomeViewModeOptions {
  /** 是否为浏览器书签平台（强制使用列表视图） */
  isBrowserPlatform: boolean;
}

interface UseHomeViewModeReturn {
  /** 当前视图模式 */
  viewMode: ViewMode;
  /** 设置视图模式 */
  setViewMode: (mode: ViewMode) => void;
  /** 当前布局模式 */
  layoutMode: LayoutMode;
  /** 设置布局模式 */
  setLayoutMode: (mode: LayoutMode) => void;
  /** 是否启用翻转卡片 */
  enableFlipCard: boolean;
  /** 设置翻转卡片开关 */
  setEnableFlipCard: (enabled: boolean) => void;
  /** 有效的视图模式（考虑平台限制） */
  effectiveViewMode: ViewMode;
}

/**
 * 从 localStorage 获取初始视图模式（惰性初始化）
 */
function getInitialViewMode(): ViewMode {
  if (typeof window === "undefined") return DEFAULT_VIEW_MODE;
  const saved = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
  if (saved && ["card", "list", "compact"].includes(saved)) {
    return saved as ViewMode;
  }
  return DEFAULT_VIEW_MODE;
}

/**
 * 从 localStorage 获取初始布局模式（惰性初始化）
 */
function getInitialLayoutMode(): LayoutMode {
  if (typeof window === "undefined") return DEFAULT_LAYOUT_MODE;
  const saved = localStorage.getItem(LAYOUT_MODE_STORAGE_KEY);
  if (saved && ["auto", "row", "column"].includes(saved)) {
    return saved as LayoutMode;
  }
  return DEFAULT_LAYOUT_MODE;
}

/**
 * 从 localStorage 获取初始翻转卡片状态（惰性初始化）
 */
function getInitialFlipCard(): boolean {
  if (typeof window === "undefined") return false;
  const saved = localStorage.getItem(FLIP_CARD_STORAGE_KEY);
  return saved === "true";
}

/**
 * 首页视图模式管理 Hook
 */
export function useHomeViewMode({
  isBrowserPlatform,
}: UseHomeViewModeOptions): UseHomeViewModeReturn {
  // 使用惰性初始化从 localStorage 读取（避免 useEffect 中调用 setState）
  const [viewMode, setViewModeState] = useState<ViewMode>(getInitialViewMode);
  const [layoutMode, setLayoutModeState] =
    useState<LayoutMode>(getInitialLayoutMode);
  const [enableFlipCard, setEnableFlipCardState] =
    useState<boolean>(getInitialFlipCard);

  // 设置视图模式（带持久化）
  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  }, []);

  // 设置布局模式（带持久化）
  const setLayoutMode = useCallback((mode: LayoutMode) => {
    setLayoutModeState(mode);
    localStorage.setItem(LAYOUT_MODE_STORAGE_KEY, mode);
  }, []);

  // 设置翻转卡片（带持久化）
  const setEnableFlipCard = useCallback((enabled: boolean) => {
    setEnableFlipCardState(enabled);
    localStorage.setItem(FLIP_CARD_STORAGE_KEY, String(enabled));
  }, []);

  // 监听全局事件（从其他组件更新）
  useEffect(() => {
    const handleViewModeChange = (event: CustomEvent<ViewMode>) => {
      setViewModeState(event.detail);
    };

    const handleLayoutModeChange = (event: CustomEvent<LayoutMode>) => {
      setLayoutModeState(event.detail);
    };

    const handleFlipCardChange = (event: CustomEvent<boolean>) => {
      setEnableFlipCardState(event.detail);
    };

    window.addEventListener(
      "viewModeChange",
      handleViewModeChange as EventListener,
    );
    window.addEventListener(
      "layoutModeChange",
      handleLayoutModeChange as EventListener,
    );
    window.addEventListener(
      "flipCardChange",
      handleFlipCardChange as EventListener,
    );

    return () => {
      window.removeEventListener(
        "viewModeChange",
        handleViewModeChange as EventListener,
      );
      window.removeEventListener(
        "layoutModeChange",
        handleLayoutModeChange as EventListener,
      );
      window.removeEventListener(
        "flipCardChange",
        handleFlipCardChange as EventListener,
      );
    };
  }, []);

  // 有效视图模式（浏览器书签强制使用列表）
  const effectiveViewMode: ViewMode = isBrowserPlatform ? "list" : viewMode;

  return {
    viewMode,
    setViewMode,
    layoutMode,
    setLayoutMode,
    enableFlipCard,
    setEnableFlipCard,
    effectiveViewMode,
  };
}
