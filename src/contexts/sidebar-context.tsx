/**
 * 侧边栏状态管理 Context
 * 实现可折叠/展开的侧边栏，支持悬停展开和锁定功能
 *
 * 核心功能：
 * - 折叠/展开状态管理
 * - 悬停自动展开（带延迟折叠）
 * - 锁定展开状态
 * - localStorage 持久化
 */

"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

// ==================== 常量定义 ====================

/** localStorage 存储键 */
const STORAGE_KEY = "anykeep-sidebar-state";

/** 鼠标移出后折叠延迟（毫秒） */
const COLLAPSE_DELAY_MS = 300;

/** 侧边栏宽度配置 */
export const SIDEBAR_WIDTH = {
  collapsed: 64,
  expanded: 192,
} as const;

// ==================== 类型定义 ====================

/** 侧边栏持久化状态 */
interface SidebarPersistedState {
  isCollapsed: boolean;
  isLocked: boolean;
}

/** Context 值类型 */
interface SidebarContextValue {
  /** 是否处于折叠状态 */
  isCollapsed: boolean;
  /** 是否锁定展开（用户主动点击展开按钮） */
  isLocked: boolean;
  /** 是否处于悬停展开状态 */
  isHoverExpanded: boolean;
  /** 实际显示宽度（考虑悬停状态） */
  displayWidth: number;
  /** 是否显示为展开状态（折叠但悬停时也算展开） */
  isVisuallyExpanded: boolean;

  /** 切换折叠状态 */
  toggleCollapse: () => void;
  /** 设置折叠状态 */
  setCollapsed: (collapsed: boolean) => void;
  /** 锁定展开状态 */
  lockExpanded: () => void;
  /** 解锁并折叠 */
  unlockAndCollapse: () => void;
  /** 处理鼠标进入（悬停展开） */
  handleMouseEnter: () => void;
  /** 处理鼠标离开（延迟折叠） */
  handleMouseLeave: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

// ==================== 工具函数 ====================

/** 从 localStorage 读取状态 */
function loadPersistedState(): SidebarPersistedState {
  if (typeof window === "undefined") {
    return { isCollapsed: true, isLocked: false };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as SidebarPersistedState;
      return {
        isCollapsed: parsed.isCollapsed ?? true,
        isLocked: parsed.isLocked ?? false,
      };
    }
  } catch {
    // 忽略解析错误
  }

  return { isCollapsed: true, isLocked: false };
}

/** 保存状态到 localStorage */
function savePersistedState(state: SidebarPersistedState): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 忽略存储错误
  }
}

// ==================== Provider 组件 ====================

interface SidebarProviderProps {
  children: ReactNode;
}

export function SidebarProvider({ children }: SidebarProviderProps) {
  // 初始状态从 localStorage 读取
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [isHoverExpanded, setIsHoverExpanded] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // 延迟折叠定时器
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 客户端初始化 - 从 localStorage 恢复状态
  /* eslint-disable react-hooks/set-state-in-effect -- 必须在客户端挂载后从 localStorage 读取 */
  useEffect(() => {
    const persisted = loadPersistedState();
    setIsCollapsed(persisted.isCollapsed);
    setIsLocked(persisted.isLocked);
    setIsInitialized(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // 持久化状态变化
  useEffect(() => {
    if (isInitialized) {
      savePersistedState({ isCollapsed, isLocked });
    }
  }, [isCollapsed, isLocked, isInitialized]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current);
      }
    };
  }, []);

  /** 切换折叠状态 */
  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
    setIsLocked(false);
    setIsHoverExpanded(false);
  }, []);

  /** 设置折叠状态 */
  const setCollapsed = useCallback((collapsed: boolean) => {
    setIsCollapsed(collapsed);
    if (collapsed) {
      setIsLocked(false);
      setIsHoverExpanded(false);
    }
  }, []);

  /** 锁定展开状态 */
  const lockExpanded = useCallback(() => {
    setIsCollapsed(false);
    setIsLocked(true);
    setIsHoverExpanded(false);
    // 清除任何待执行的折叠定时器
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
  }, []);

  /** 解锁并折叠 */
  const unlockAndCollapse = useCallback(() => {
    setIsLocked(false);
    setIsCollapsed(true);
    setIsHoverExpanded(false);
  }, []);

  /** 处理鼠标进入 */
  const handleMouseEnter = useCallback(() => {
    // 清除待执行的折叠定时器
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }

    // 如果已锁定，不需要处理悬停
    if (isLocked) return;

    // 如果处于折叠状态，悬停展开
    if (isCollapsed) {
      setIsHoverExpanded(true);
    }
  }, [isCollapsed, isLocked]);

  /** 处理鼠标离开 */
  const handleMouseLeave = useCallback(() => {
    // 如果已锁定，不自动折叠
    if (isLocked) return;

    // 延迟折叠，防止误触
    collapseTimerRef.current = setTimeout(() => {
      setIsHoverExpanded(false);
    }, COLLAPSE_DELAY_MS);
  }, [isLocked]);

  // 计算派生状态
  const isVisuallyExpanded = !isCollapsed || isHoverExpanded;
  const displayWidth = isVisuallyExpanded
    ? SIDEBAR_WIDTH.expanded
    : SIDEBAR_WIDTH.collapsed;

  const value = useMemo<SidebarContextValue>(
    () => ({
      isCollapsed,
      isLocked,
      isHoverExpanded,
      displayWidth,
      isVisuallyExpanded,
      toggleCollapse,
      setCollapsed,
      lockExpanded,
      unlockAndCollapse,
      handleMouseEnter,
      handleMouseLeave,
    }),
    [
      isCollapsed,
      isLocked,
      isHoverExpanded,
      displayWidth,
      isVisuallyExpanded,
      toggleCollapse,
      setCollapsed,
      lockExpanded,
      unlockAndCollapse,
      handleMouseEnter,
      handleMouseLeave,
    ],
  );

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
}

// ==================== Hooks ====================

/**
 * 使用侧边栏 Context
 * @throws 如果在 SidebarProvider 外部使用
 */
export function useSidebar(): SidebarContextValue {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}

/**
 * 安全获取侧边栏上下文（不抛出错误）
 */
export function useSafeSidebar(): SidebarContextValue | null {
  return useContext(SidebarContext);
}
