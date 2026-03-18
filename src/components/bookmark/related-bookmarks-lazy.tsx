/**
 * RelatedBookmarksV2 懒加载组件
 *
 * - 代码分割（React.lazy）：减小主包
 * - 默认进入详情页即挂载并请求数据，避免「须滚动才加载」的误判
 * - 可选 deferUntilVisible：仅在区块进入视口后再加载（省首屏请求）
 *
 * @version 1.2.0
 * @since 2025-12-19
 */

"use client";

import {
  lazy,
  Suspense,
  useState,
  useEffect,
  useRef,
  type RefObject,
} from "react";
import { Brain } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SilentErrorBoundary } from "@/components/ui/lazy-error-boundary";
import { Card, CardContent } from "@/components/ui/card";
import type { LinkType } from "@/lib/knowledge-link";

// ============================================================================
// Constants
// ============================================================================

/** 视口懒加载模式下的提前量 */
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
  /**
   * 为 true 时仅在区块进入视口后加载 JS 与数据（旧行为）。
   * 默认 false：打开详情页即拉取知识关联，无需滚动。
   */
  deferUntilVisible?: boolean;
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
 * 检测元素是否进入视口（仅 deferUntilVisible 时使用）
 */
function useInViewport(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
): boolean {
  const [isInViewport, setIsInViewport] = useState(false);

  useEffect(() => {
    if (!enabled || isInViewport) return;
    const element = ref.current;
    if (!element) return;

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
  }, [enabled, ref, isInViewport]);

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

function RelatedBookmarksInner(
  rest: Omit<RelatedBookmarksV2LazyProps, "deferUntilVisible">,
) {
  return (
    <SilentErrorBoundary>
      <Suspense fallback={<RelatedBookmarksFallback />}>
        <LazyRelatedBookmarksV2 {...rest} />
      </Suspense>
    </SilentErrorBoundary>
  );
}

/**
 * 相关推荐：默认随详情页打开即加载；可选视口延迟加载。
 */
export function RelatedBookmarksV2Lazy(props: RelatedBookmarksV2LazyProps) {
  const { deferUntilVisible = false, ...rest } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const isInViewport = useInViewport(containerRef, deferUntilVisible);

  if (!deferUntilVisible) {
    return (
      <div ref={containerRef}>
        <RelatedBookmarksInner {...rest} />
      </div>
    );
  }

  return (
    <div ref={containerRef}>
      {isInViewport ? (
        <RelatedBookmarksInner {...rest} />
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
