/**
 * RelatedBookmarksV2 懒加载组件
 *
 * 使用 React.lazy + IntersectionObserver 实现：
 * 1. 代码分割 - 减少主包大小
 * 2. 视口懒加载 - 只有滚动到可见区域才开始加载和请求数据
 *
 * @version 1.1.0
 * @since 2025-12-19
 */

"use client";

import { lazy, Suspense, useState, useEffect, useRef } from "react";
import { Brain } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import type { LinkType } from "@/lib/knowledge-link";

// ============================================================================
// Constants
// ============================================================================

/** 提前加载的视口边距，优化感知性能 */
const PREFETCH_ROOT_MARGIN = "100px";

// ============================================================================
// Types
// ============================================================================

interface RelatedBookmarksV2LazyProps {
  bookmarkId: number;
  className?: string;
  defaultExpanded?: boolean;
  limit?: number;
  minStrength?: number;
  types?: LinkType[];
}

// ============================================================================
// Lazy Component (with webpack chunk naming)
// ============================================================================

const LazyRelatedBookmarksV2 = lazy(() =>
  import(
    /* webpackChunkName: "related-bookmarks-v2" */
    /* webpackPrefetch: true */
    "./related-bookmarks-v2"
  ).then((m) => ({
    default: m.RelatedBookmarksV2,
  })),
);

// ============================================================================
// Loading Fallback
// ============================================================================

function RelatedBookmarksFallback() {
  return (
    <Card className="border-dashed" role="status" aria-label="加载相关推荐中">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="size-5 text-muted-foreground animate-pulse" />
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-10 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Viewport Observer Hook
// ============================================================================

/**
 * 检测元素是否进入视口的 Hook
 *
 * @param ref - 目标元素的 ref
 * @returns 是否已进入视口（一旦为 true 则保持）
 */
function useInViewport(ref: React.RefObject<HTMLElement | null>): boolean {
  const [isInViewport, setIsInViewport] = useState(false);

  useEffect(() => {
    const element = ref.current;
    // 无元素或已在视口中，跳过
    if (!element || isInViewport) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInViewport(true);
          observer.disconnect(); // 只触发一次
        }
      },
      {
        rootMargin: PREFETCH_ROOT_MARGIN,
        threshold: 0,
      },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [ref, isInViewport]); // ref 是稳定引用，不会导致重复执行

  return isInViewport;
}

// ============================================================================
// Placeholder Component (before viewport intersection)
// ============================================================================

function RelatedBookmarksPlaceholder() {
  return (
    <Card
      className="border-dashed bg-muted/20"
      role="status"
      aria-label="相关推荐待加载"
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Brain className="size-5" aria-hidden="true" />
          <span className="text-sm" aria-live="polite">
            滚动加载相关推荐...
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * 相关推荐懒加载组件
 *
 * 特性：
 * - 视口触发：只有滚动到可见区域才开始加载
 * - 代码分割：RelatedBookmarksV2 的 JS 代码按需加载
 * - 骨架屏过渡：加载时显示骨架屏，避免布局跳动
 */
export function RelatedBookmarksV2Lazy(props: RelatedBookmarksV2LazyProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInViewport = useInViewport(containerRef);

  return (
    <div ref={containerRef}>
      {isInViewport ? (
        <Suspense fallback={<RelatedBookmarksFallback />}>
          <LazyRelatedBookmarksV2 {...props} />
        </Suspense>
      ) : (
        <RelatedBookmarksPlaceholder />
      )}
    </div>
  );
}

// ============================================================================
// Export Fallback for external use
// ============================================================================

export { RelatedBookmarksFallback };
