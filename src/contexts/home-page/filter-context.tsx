/**
 * 筛选 Context
 *
 * Phase 2 性能优化：从 HomePageContext 拆分出筛选相关状态
 * 只有订阅筛选的组件才会在筛选变化时重渲染
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

export interface FilterContextState {
  platform: string;
  folder: string;
  usageTags: readonly string[];
  isBrowserPlatform: boolean;
  isTrashFolder: boolean;
}

export interface FilterContextActions {
  setPlatform: (platform: string) => void;
  setFolder: (folder: string) => void;
  setUsageTags: (tags: string[]) => void;
}

export type FilterContextType = FilterContextState & FilterContextActions;

// ============================================================================
// Context 创建
// ============================================================================

export const FilterContext = createContext<FilterContextType | null>(null);

// ============================================================================
// Provider 实现
// ============================================================================

interface FilterProviderProps {
  children: ReactNode;
  initialPlatform?: string;
  initialFolder?: string;
  initialUsageTags?: string[];
}

export function FilterProvider({
  children,
  initialPlatform = "",
  initialFolder = "",
  initialUsageTags = [],
}: FilterProviderProps) {
  const [platform, setPlatformState] = useState(initialPlatform);
  const [folder, setFolderState] = useState(initialFolder);
  const [usageTags, setUsageTagsState] =
    useState<readonly string[]>(initialUsageTags);

  // 派生状态
  const isBrowserPlatform = platform === "browser";
  const isTrashFolder = folder === "trash";

  // 防止自回环：标记当前 emit 来源是否为自身
  const isEmittingRef = useRef(false);

  // 使用 ref 存储回调需要的状态值
  const filterRef = useRef({ platform, folder });
  useEffect(() => {
    filterRef.current = { platform, folder };
  }, [platform, folder]);

  // 筛选操作
  const setPlatform = useCallback((newPlatform: string) => {
    setPlatformState(newPlatform);
    isEmittingRef.current = true;
    uiEventBus.emit(UIEvents.PLATFORM_CHANGE, {
      platform: newPlatform,
      folder: filterRef.current.folder,
    });
    isEmittingRef.current = false;
  }, []);

  const setFolder = useCallback((newFolder: string) => {
    setFolderState(newFolder);
  }, []);

  const setUsageTags = useCallback((tags: string[]) => {
    setUsageTagsState(tags);
    isEmittingRef.current = true;
    uiEventBus.emit(UIEvents.USAGE_TAGS_CHANGE, { usageTags: tags });
    isEmittingRef.current = false;
  }, []);

  // 订阅外部事件（仅响应非自身触发的事件）
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    unsubscribers.push(
      uiEventBus.on(UIEvents.PLATFORM_CHANGE, (payload) => {
        if (isEmittingRef.current) return;
        setPlatformState(payload.platform);
        if (payload.folder !== undefined) {
          setFolderState(payload.folder);
        }
      }),
    );
    unsubscribers.push(
      uiEventBus.on(UIEvents.USAGE_TAGS_CHANGE, (payload) => {
        if (isEmittingRef.current) return;
        setUsageTagsState(payload.usageTags);
      }),
    );

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, []);

  const value = useMemo<FilterContextType>(
    () => ({
      platform,
      folder,
      usageTags,
      isBrowserPlatform,
      isTrashFolder,
      setPlatform,
      setFolder,
      setUsageTags,
    }),
    [
      platform,
      folder,
      usageTags,
      isBrowserPlatform,
      isTrashFolder,
      setPlatform,
      setFolder,
      setUsageTags,
    ],
  );

  return (
    <FilterContext.Provider value={value}>{children}</FilterContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

export function useFilter(): FilterContextType {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error("useFilter must be used within FilterProvider");
  }
  return context;
}

export function useFilterSafe(): FilterContextType | null {
  return useContext(FilterContext);
}
