/**
 * 详情页洞察卡片懒加载容器
 *
 * 使用 IntersectionObserver 实现视口懒加载，
 * 复用 related-bookmarks-lazy.tsx 的 useInViewport 模式。
 *
 * @version 1.0.0
 * @since 2026-03-17
 */

"use client";

import { lazy, Suspense, useState, useEffect, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { SilentErrorBoundary } from "@/components/ui/lazy-error-boundary";
import type { DetailInsightsProps } from "./types";

// ============================================================================
// Constants
// ============================================================================

/** 提前加载的视口边距 */
const PREFETCH_ROOT_MARGIN = "100px";

// ============================================================================
// Lazy Component
// ============================================================================

const LazyDetailInsightsContainer = lazy(() =>
  import(
    /* webpackChunkName: "detail-insights" */
    /* webpackPrefetch: true */
    "./detail-insights-container"
  ).then((m) => ({
    default: m.DetailInsightsContainer,
  })),
);

// ============================================================================
// Viewport Hook
// ============================================================================

function useInViewport(ref: React.RefObject<HTMLElement | null>): boolean {
  const [isInViewport, setIsInViewport] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || isInViewport) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInViewport(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: PREFETCH_ROOT_MARGIN,
        threshold: 0,
      },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, isInViewport]);

  return isInViewport;
}

// ============================================================================
// Fallback
// ============================================================================

function InsightsFallback() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function DetailInsightsLazy(props: DetailInsightsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInViewport = useInViewport(containerRef);

  return (
    <div ref={containerRef}>
      {isInViewport ? (
        <SilentErrorBoundary>
          <Suspense fallback={<InsightsFallback />}>
            <LazyDetailInsightsContainer {...props} />
          </Suspense>
        </SilentErrorBoundary>
      ) : (
        // 占位符：最小高度确保 IntersectionObserver 可触发
        <div className="h-4" />
      )}
    </div>
  );
}
