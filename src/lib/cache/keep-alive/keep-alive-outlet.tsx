"use client";

/**
 * KeepAlive Outlet
 * 渲染缓存的页面组件
 *
 * 特点：
 * - 通过 display: none 隐藏非活动页面（保持 DOM）
 * - 自动保存/恢复滚动位置
 * - 支持动态路由
 */

import {
  useEffect,
  useRef,
  memo,
  type ReactElement,
  type CSSProperties,
} from "react";
import { usePathname } from "next/navigation";
import { useKeepAlive, shouldCachePage } from "./keep-alive-context";

/**
 * 缓存页面包装器
 * 通过 CSS 控制显示/隐藏，保持 DOM 存在
 */
interface CachedPageProps {
  cacheKey: string;
  isActive: boolean;
  children: ReactElement;
}

const CachedPage = memo(function CachedPage({
  cacheKey,
  isActive,
  children,
}: CachedPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { saveScrollPosition, restoreScrollPosition } = useKeepAlive();

  // 激活时恢复滚动位置
  useEffect(() => {
    if (isActive) {
      restoreScrollPosition(cacheKey);
    }
  }, [isActive, cacheKey, restoreScrollPosition]);

  // 非激活时保存滚动位置
  useEffect(() => {
    return () => {
      if (isActive) {
        saveScrollPosition(cacheKey);
      }
    };
  }, [isActive, cacheKey, saveScrollPosition]);

  const style: CSSProperties = {
    display: isActive ? "block" : "none",
    // 保持隐藏页面的布局计算，避免切换时闪烁
    ...(isActive
      ? {}
      : {
          visibility: "hidden" as const,
          position: "absolute" as const,
          top: 0,
          left: 0,
          width: "100%",
          pointerEvents: "none" as const,
        }),
  };

  return (
    <div
      ref={containerRef}
      data-keep-alive-cache={cacheKey}
      data-active={isActive}
      style={style}
    >
      {children}
    </div>
  );
});

/**
 * KeepAlive Outlet Props
 */
interface KeepAliveOutletProps {
  /** 当前页面内容 */
  children: ReactElement;
  /** 自定义缓存键（默认使用 pathname） */
  cacheKey?: string;
  /** 强制不缓存 */
  noCache?: boolean;
}

/**
 * KeepAlive Outlet
 * 替代默认的页面渲染，实现页面缓存
 *
 * 使用方式：
 * ```tsx
 * // 在 layout.tsx 中
 * <KeepAliveOutlet>{children}</KeepAliveOutlet>
 * ```
 */
export function KeepAliveOutlet({
  children,
  cacheKey: customCacheKey,
  noCache = false,
}: KeepAliveOutletProps) {
  const pathname = usePathname();
  const cacheKey = customCacheKey || pathname;
  const { cache, getCached, setActiveKey, cachedKeys } = useKeepAlive();

  // 判断是否应该缓存当前页面
  const shouldCache = !noCache && shouldCachePage(pathname);

  // 更新活动键
  useEffect(() => {
    setActiveKey(shouldCache ? cacheKey : null);
  }, [cacheKey, shouldCache, setActiveKey]);

  // 缓存当前页面
  useEffect(() => {
    if (shouldCache) {
      cache(cacheKey, children);
    }
  }, [cacheKey, children, shouldCache, cache]);

  // 如果不需要缓存，直接渲染
  if (!shouldCache) {
    return children;
  }

  // 渲染所有缓存的页面（通过 CSS 控制显示）
  return (
    <>
      {cachedKeys.map((key) => {
        const cached = getCached(key);
        if (!cached) return null;

        return (
          <CachedPage key={key} cacheKey={key} isActive={key === cacheKey}>
            {cached.element}
          </CachedPage>
        );
      })}
      {/* 如果当前页面不在缓存中，显示新内容 */}
      {!getCached(cacheKey) && (
        <CachedPage cacheKey={cacheKey} isActive={true}>
          {children}
        </CachedPage>
      )}
    </>
  );
}

/**
 * 使用 KeepAlive 的 Hook
 * 提供页面级别的缓存控制
 */
export function usePageKeepAlive() {
  const pathname = usePathname();
  const {
    saveScrollPosition,
    restoreScrollPosition,
    savePageState,
    getPageState,
    remove,
  } = useKeepAlive();

  return {
    /** 保存当前页面滚动位置 */
    saveScroll: () => saveScrollPosition(pathname),

    /** 恢复当前页面滚动位置 */
    restoreScroll: () => restoreScrollPosition(pathname),

    /** 保存页面状态 */
    saveState: (state: unknown) => savePageState(pathname, state),

    /** 获取页面状态 */
    getState: <T,>() => getPageState(pathname) as T | undefined,

    /** 清除当前页面缓存 */
    clearCache: () => remove(pathname),

    /** 当前路径 */
    pathname,
  };
}
