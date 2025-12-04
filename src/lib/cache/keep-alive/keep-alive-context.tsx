"use client";

/**
 * KeepAlive Context
 * 实现类似 Vue 的 keep-alive 功能
 *
 * 核心功能：
 * - 缓存页面组件实例
 * - 切换时保持 DOM 和状态
 * - LRU 淘汰策略
 * - 滚动位置恢复
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
  type ReactElement,
} from "react";
import { KEEP_ALIVE_CONFIG, PAGE_CACHE_CONFIG } from "../cache-config";

/**
 * 缓存条目
 */
interface CacheEntry {
  key: string;
  element: ReactElement;
  scrollPosition: { x: number; y: number };
  timestamp: number;
  state?: unknown;
}

/**
 * KeepAlive Context 值类型
 */
interface KeepAliveContextValue {
  // 缓存操作
  cache: (key: string, element: ReactElement) => void;
  getCached: (key: string) => CacheEntry | undefined;
  remove: (key: string) => void;
  clear: () => void;

  // 状态
  cachedKeys: string[];
  activeKey: string | null;

  // 滚动位置
  saveScrollPosition: (key: string) => void;
  restoreScrollPosition: (key: string) => void;

  // 页面状态
  savePageState: (key: string, state: unknown) => void;
  getPageState: (key: string) => unknown | undefined;

  // 激活控制
  setActiveKey: (key: string | null) => void;
}

const KeepAliveContext = createContext<KeepAliveContextValue | null>(null);

/**
 * KeepAlive Provider Props
 */
interface KeepAliveProviderProps {
  children: ReactNode;
  maxCacheSize?: number;
}

/**
 * KeepAlive Provider
 * 管理页面缓存和状态
 */
export function KeepAliveProvider({
  children,
  maxCacheSize = KEEP_ALIVE_CONFIG.maxCachedPages,
}: KeepAliveProviderProps) {
  // 缓存存储
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());

  // 当前激活的缓存键
  const [activeKey, setActiveKey] = useState<string | null>(null);

  // 缓存键列表状态
  const [cachedKeys, setCachedKeys] = useState<string[]>([]);

  /**
   * 更新缓存键列表（用于触发重渲染）
   */
  const updateCachedKeys = useCallback(() => {
    setCachedKeys(Array.from(cacheRef.current.keys()));
  }, []);

  /**
   * LRU 淘汰：移除最旧的缓存
   */
  const evictOldest = useCallback(() => {
    const cache = cacheRef.current;
    if (cache.size <= maxCacheSize) return;

    // 找到最旧的条目（排除当前激活的）
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    cache.forEach((entry, key) => {
      if (key !== activeKey && entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    });

    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }, [maxCacheSize, activeKey]);

  /**
   * 缓存页面
   */
  const cache = useCallback(
    (key: string, element: ReactElement) => {
      const cacheMap = cacheRef.current;
      const existing = cacheMap.get(key);

      cacheMap.set(key, {
        key,
        element,
        scrollPosition: existing?.scrollPosition || { x: 0, y: 0 },
        timestamp: Date.now(),
        state: existing?.state,
      });

      // 执行 LRU 淘汰
      evictOldest();

      updateCachedKeys();
    },
    [evictOldest, updateCachedKeys],
  );

  /**
   * 获取缓存的页面
   */
  const getCached = useCallback((key: string): CacheEntry | undefined => {
    const entry = cacheRef.current.get(key);
    if (entry) {
      // 更新访问时间（LRU）
      entry.timestamp = Date.now();
    }
    return entry;
  }, []);

  /**
   * 移除缓存
   */
  const remove = useCallback(
    (key: string) => {
      cacheRef.current.delete(key);
      updateCachedKeys();
    },
    [updateCachedKeys],
  );

  /**
   * 清空所有缓存
   */
  const clear = useCallback(() => {
    cacheRef.current.clear();
    updateCachedKeys();
  }, [updateCachedKeys]);

  /**
   * 保存滚动位置
   */
  const saveScrollPosition = useCallback((key: string) => {
    const entry = cacheRef.current.get(key);
    if (entry) {
      entry.scrollPosition = {
        x: window.scrollX,
        y: window.scrollY,
      };
    }
  }, []);

  /**
   * 恢复滚动位置
   */
  const restoreScrollPosition = useCallback((key: string) => {
    const entry = cacheRef.current.get(key);
    if (entry) {
      // 使用 requestAnimationFrame 确保 DOM 已更新
      requestAnimationFrame(() => {
        window.scrollTo(entry.scrollPosition.x, entry.scrollPosition.y);
      });
    }
  }, []);

  /**
   * 保存页面状态
   */
  const savePageState = useCallback((key: string, state: unknown) => {
    const entry = cacheRef.current.get(key);
    if (entry) {
      entry.state = state;
    }
  }, []);

  /**
   * 获取页面状态
   */
  const getPageState = useCallback((key: string): unknown | undefined => {
    return cacheRef.current.get(key)?.state;
  }, []);

  const value = useMemo<KeepAliveContextValue>(
    () => ({
      cache,
      getCached,
      remove,
      clear,
      cachedKeys,
      activeKey,
      saveScrollPosition,
      restoreScrollPosition,
      savePageState,
      getPageState,
      setActiveKey,
    }),
    [
      cache,
      getCached,
      remove,
      clear,
      cachedKeys,
      activeKey,
      saveScrollPosition,
      restoreScrollPosition,
      savePageState,
      getPageState,
    ],
  );

  return (
    <KeepAliveContext.Provider value={value}>
      {children}
    </KeepAliveContext.Provider>
  );
}

/**
 * 使用 KeepAlive Context
 */
export function useKeepAlive(): KeepAliveContextValue {
  const context = useContext(KeepAliveContext);
  if (!context) {
    throw new Error("useKeepAlive must be used within a KeepAliveProvider");
  }
  return context;
}

/**
 * 检查页面是否应该被缓存
 */
export function shouldCachePage(pathname: string): boolean {
  const config = PAGE_CACHE_CONFIG[pathname as keyof typeof PAGE_CACHE_CONFIG];
  return config?.keepAlive ?? false;
}

/**
 * 获取页面缓存优先级
 */
export function getPagePriority(pathname: string): "high" | "medium" | "low" {
  const config = PAGE_CACHE_CONFIG[pathname as keyof typeof PAGE_CACHE_CONFIG];
  return config?.priority ?? "low";
}
