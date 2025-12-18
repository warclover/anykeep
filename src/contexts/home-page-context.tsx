/**
 * V4.2.17: 首页状态 Context
 *
 * Phase 2.1 - 适配层构建
 * 使用 React Context 替代 Window Event 通信模式
 *
 * 设计原则：
 * 1. Event Bridge - 与现有 window event 系统双向同步（渐进迁移）
 * 2. 类型安全 - 使用 types.ts 中定义的类型契约
 * 3. 向后兼容 - 不修改现有组件，仅提供新的数据源
 */

"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type { ViewMode, LayoutMode, DialogType } from "@/components/home/types";
import {
  VIEW_MODE_STORAGE_KEY,
  LAYOUT_MODE_STORAGE_KEY,
  FLIP_CARD_STORAGE_KEY,
  DEFAULT_VIEW_MODE,
  DEFAULT_LAYOUT_MODE,
} from "@/components/home/constants";

// ============================================================================
// Context 类型定义
// ============================================================================

/**
 * 视图模式状态
 */
interface ViewModeContextState {
  viewMode: ViewMode;
  layoutMode: LayoutMode;
  enableFlipCard: boolean;
  /** 有效视图模式（浏览器平台强制列表视图） */
  effectiveViewMode: ViewMode;
}

/**
 * 视图模式操作
 */
interface ViewModeContextActions {
  setViewMode: (mode: ViewMode) => void;
  setLayoutMode: (mode: LayoutMode) => void;
  setEnableFlipCard: (enabled: boolean) => void;
}

/**
 * 筛选状态
 */
interface FilterContextState {
  platform: string;
  folder: string;
  usageTags: readonly string[];
  isBrowserPlatform: boolean;
  isTrashFolder: boolean;
}

/**
 * 筛选操作
 */
interface FilterContextActions {
  setPlatform: (platform: string) => void;
  setFolder: (folder: string) => void;
  setUsageTags: (tags: string[]) => void;
}

/**
 * 对话框状态
 */
interface DialogContextState {
  openDialog: DialogType | null;
}

/**
 * 对话框操作
 */
interface DialogContextActions {
  openDialogAction: (type: DialogType) => void;
  closeDialog: () => void;
}

/**
 * 选择模式状态
 */
interface SelectionContextState {
  isSelectionMode: boolean;
}

/**
 * 选择模式操作
 */
interface SelectionContextActions {
  setSelectionMode: (enabled: boolean) => void;
  toggleSelectionMode: () => void;
}

/**
 * 完整的 Context 类型
 */
export interface HomePageContextType {
  // 视图模式
  view: ViewModeContextState & ViewModeContextActions;
  // 筛选
  filter: FilterContextState & FilterContextActions;
  // 对话框
  dialog: DialogContextState & DialogContextActions;
  // 选择模式
  selection: SelectionContextState & SelectionContextActions;
}

// ============================================================================
// Context 创建
// ============================================================================

const HomePageContext = createContext<HomePageContextType | null>(null);

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
// Provider Props
// ============================================================================

interface HomePageProviderProps {
  children: ReactNode;
  /** 初始平台值（从 URL 读取） */
  initialPlatform?: string;
  /** 初始文件夹值（从 URL 读取） */
  initialFolder?: string;
  /** 初始用途标签（从 URL 读取） */
  initialUsageTags?: string[];
  /**
   * 是否启用 Event Bridge（与旧 window event 系统双向同步）
   * @default true - 默认启用，保持向后兼容
   */
  enableEventBridge?: boolean;
}

// ============================================================================
// Provider 实现
// ============================================================================

export function HomePageProvider({
  children,
  initialPlatform = "",
  initialFolder = "",
  initialUsageTags = [],
  enableEventBridge = true,
}: HomePageProviderProps) {
  // ========== 视图模式状态 ==========
  // Phase 2.4: 修复 hydration 问题 - 使用默认值初始化，useEffect 后读取 localStorage
  const [viewMode, setViewModeState] = useState<ViewMode>(DEFAULT_VIEW_MODE);
  const [layoutMode, setLayoutModeState] =
    useState<LayoutMode>(DEFAULT_LAYOUT_MODE);
  const [enableFlipCard, setEnableFlipCardState] = useState<boolean>(false);

  // Phase 2.4: 客户端 hydration 后从 localStorage 读取初始值
  // 这是合法的 hydration 模式：SSR 使用默认值，客户端挂载后从 localStorage 同步
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setViewModeState(getStoredViewMode());
    setLayoutModeState(getStoredLayoutMode());
    setEnableFlipCardState(getStoredFlipCard());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // ========== 筛选状态 ==========
  const [platform, setPlatformState] = useState(initialPlatform);
  const [folder, setFolderState] = useState(initialFolder);
  const [usageTags, setUsageTagsState] =
    useState<readonly string[]>(initialUsageTags);

  // ========== 对话框状态 ==========
  const [openDialogState, setOpenDialogState] = useState<DialogType | null>(
    null,
  );

  // ========== 选择模式状态 ==========
  const [isSelectionMode, setIsSelectionModeState] = useState(false);

  // ========== 派生状态 ==========
  const isBrowserPlatform = platform === "browser";
  const isTrashFolder = folder === "trash";
  const effectiveViewMode: ViewMode = isBrowserPlatform ? "list" : viewMode;

  // ========== 视图模式操作（带持久化） ==========
  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
    // Event Bridge: 同步到旧系统
    window.dispatchEvent(new CustomEvent("viewModeChange", { detail: mode }));
  }, []);

  const setLayoutMode = useCallback((mode: LayoutMode) => {
    setLayoutModeState(mode);
    localStorage.setItem(LAYOUT_MODE_STORAGE_KEY, mode);
    window.dispatchEvent(new CustomEvent("layoutModeChange", { detail: mode }));
  }, []);

  const setEnableFlipCard = useCallback((enabled: boolean) => {
    setEnableFlipCardState(enabled);
    localStorage.setItem(FLIP_CARD_STORAGE_KEY, String(enabled));
    window.dispatchEvent(
      new CustomEvent("flipCardChange", { detail: enabled }),
    );
  }, []);

  // ========== 筛选操作 ==========
  const setPlatform = useCallback((newPlatform: string) => {
    setPlatformState(newPlatform);
    // 注意：platformChange 事件的 payload 格式与旧系统一致
    window.dispatchEvent(
      new CustomEvent("platformChange", {
        detail: { platform: newPlatform, folder: "" },
      }),
    );
  }, []);

  const setFolder = useCallback((newFolder: string) => {
    setFolderState(newFolder);
  }, []);

  const setUsageTags = useCallback((tags: string[]) => {
    setUsageTagsState(tags);
    window.dispatchEvent(
      new CustomEvent("usageTagFilterChange", { detail: { usageTags: tags } }),
    );
  }, []);

  // ========== 对话框操作 ==========
  const openDialogAction = useCallback((type: DialogType) => {
    setOpenDialogState(type);
    window.dispatchEvent(new CustomEvent("openDialog", { detail: type }));
  }, []);

  const closeDialog = useCallback(() => {
    setOpenDialogState(null);
  }, []);

  // ========== 选择模式操作 ==========
  const setSelectionMode = useCallback((enabled: boolean) => {
    setIsSelectionModeState(enabled);
    window.dispatchEvent(
      new CustomEvent("toggleSelectionMode", { detail: enabled }),
    );
  }, []);

  const toggleSelectionMode = useCallback(() => {
    setIsSelectionModeState((prev) => {
      const newValue = !prev;
      window.dispatchEvent(
        new CustomEvent("toggleSelectionMode", { detail: newValue }),
      );
      return newValue;
    });
  }, []);

  // ========== Event Bridge: 监听旧系统事件 ==========
  useEffect(() => {
    if (!enableEventBridge) return;

    // 监听视图模式变化
    const handleViewModeEvent = (e: CustomEvent<ViewMode>) => {
      setViewModeState(e.detail);
    };
    const handleLayoutModeEvent = (e: CustomEvent<LayoutMode>) => {
      setLayoutModeState(e.detail);
    };
    const handleFlipCardEvent = (e: CustomEvent<boolean>) => {
      setEnableFlipCardState(e.detail);
    };

    // 监听筛选变化
    const handlePlatformEvent = (
      e: CustomEvent<{ platform: string; folder: string }>,
    ) => {
      setPlatformState(e.detail.platform);
      if (e.detail.folder !== undefined) {
        setFolderState(e.detail.folder);
      }
    };
    const handleUsageTagEvent = (e: CustomEvent<{ usageTags: string[] }>) => {
      setUsageTagsState(e.detail.usageTags);
    };

    // 监听对话框事件
    const handleOpenDialogEvent = (e: CustomEvent<DialogType>) => {
      setOpenDialogState(e.detail);
    };

    // 监听选择模式事件
    const handleSelectionModeEvent = (e: CustomEvent<boolean>) => {
      setIsSelectionModeState(e.detail);
    };

    // 订阅事件
    window.addEventListener(
      "viewModeChange",
      handleViewModeEvent as EventListener,
    );
    window.addEventListener(
      "layoutModeChange",
      handleLayoutModeEvent as EventListener,
    );
    window.addEventListener(
      "flipCardChange",
      handleFlipCardEvent as EventListener,
    );
    window.addEventListener(
      "platformChange",
      handlePlatformEvent as EventListener,
    );
    window.addEventListener(
      "usageTagFilterChange",
      handleUsageTagEvent as EventListener,
    );
    window.addEventListener(
      "openDialog",
      handleOpenDialogEvent as EventListener,
    );
    window.addEventListener(
      "toggleSelectionMode",
      handleSelectionModeEvent as EventListener,
    );

    // 清理
    return () => {
      window.removeEventListener(
        "viewModeChange",
        handleViewModeEvent as EventListener,
      );
      window.removeEventListener(
        "layoutModeChange",
        handleLayoutModeEvent as EventListener,
      );
      window.removeEventListener(
        "flipCardChange",
        handleFlipCardEvent as EventListener,
      );
      window.removeEventListener(
        "platformChange",
        handlePlatformEvent as EventListener,
      );
      window.removeEventListener(
        "usageTagFilterChange",
        handleUsageTagEvent as EventListener,
      );
      window.removeEventListener(
        "openDialog",
        handleOpenDialogEvent as EventListener,
      );
      window.removeEventListener(
        "toggleSelectionMode",
        handleSelectionModeEvent as EventListener,
      );
    };
  }, [enableEventBridge]);

  // ========== Context Value ==========
  const value = useMemo<HomePageContextType>(
    () => ({
      view: {
        viewMode,
        layoutMode,
        enableFlipCard,
        effectiveViewMode,
        setViewMode,
        setLayoutMode,
        setEnableFlipCard,
      },
      filter: {
        platform,
        folder,
        usageTags,
        isBrowserPlatform,
        isTrashFolder,
        setPlatform,
        setFolder,
        setUsageTags,
      },
      dialog: {
        openDialog: openDialogState,
        openDialogAction,
        closeDialog,
      },
      selection: {
        isSelectionMode,
        setSelectionMode,
        toggleSelectionMode,
      },
    }),
    [
      viewMode,
      layoutMode,
      enableFlipCard,
      effectiveViewMode,
      setViewMode,
      setLayoutMode,
      setEnableFlipCard,
      platform,
      folder,
      usageTags,
      isBrowserPlatform,
      isTrashFolder,
      setPlatform,
      setFolder,
      setUsageTags,
      openDialogState,
      openDialogAction,
      closeDialog,
      isSelectionMode,
      setSelectionMode,
      toggleSelectionMode,
    ],
  );

  return (
    <HomePageContext.Provider value={value}>
      {children}
    </HomePageContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * 获取完整的首页 Context
 * @throws 如果在 Provider 外部调用会抛出错误
 */
export function useHomePageContext(): HomePageContextType {
  const context = useContext(HomePageContext);
  if (!context) {
    throw new Error("useHomePageContext must be used within HomePageProvider");
  }
  return context;
}

/**
 * 安全版本：获取首页 Context，如果不在 Provider 内则返回 null
 * 用于 Feature Flag 切换时的兼容检测
 */
export function useHomePageSafe(): HomePageContextType | null {
  return useContext(HomePageContext);
}

/**
 * 获取视图模式相关状态和操作
 */
export function useHomeViewMode() {
  const { view } = useHomePageContext();
  return view;
}

/**
 * 获取筛选相关状态和操作
 */
export function useHomeFilter() {
  const { filter } = useHomePageContext();
  return filter;
}

/**
 * 获取对话框相关状态和操作
 */
export function useHomeDialogs() {
  const { dialog } = useHomePageContext();
  return dialog;
}

/**
 * 获取选择模式相关状态和操作
 */
export function useHomeSelection() {
  const { selection } = useHomePageContext();
  return selection;
}
