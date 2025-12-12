/**
 * Snapshot Lazy Loading Components (V4.2.1)
 * 快照组件懒加载包装器
 *
 * 使用 React.lazy 和 Suspense 实现代码分割
 * 确保快照功能不影响主包大小
 */

"use client";

import { lazy, Suspense } from "react";
import { Loader2, Camera } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSnapshotFeature } from "@/lib/feature-flags";
import type { SnapshotButtonProps } from "./snapshot-button";
import type { SnapshotSectionProps } from "./snapshot-section";
import type { SnapshotQuotaBarProps } from "./snapshot-quota-bar";

// ============================================================================
// 懒加载组件
// ============================================================================

const LazySnapshotButton = lazy(() =>
  import("./snapshot-button").then((m) => ({ default: m.SnapshotButton })),
);

const LazySnapshotSection = lazy(() =>
  import("./snapshot-section").then((m) => ({ default: m.SnapshotSection })),
);

const LazySnapshotQuotaBar = lazy(() =>
  import("./snapshot-quota-bar").then((m) => ({ default: m.SnapshotQuotaBar })),
);

const LazySnapshotQuotaSection = lazy(() =>
  import("./snapshot-quota-section").then((m) => ({
    default: m.SnapshotQuotaSection,
  })),
);

// ============================================================================
// Loading Fallbacks
// ============================================================================

function ButtonFallback() {
  return (
    <div className="inline-flex items-center justify-center size-8 text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
    </div>
  );
}

function SectionFallback() {
  return (
    <div className="border rounded-lg p-4 bg-muted/30">
      <div className="flex items-center gap-2">
        <Camera className="size-5 text-muted-foreground animate-pulse" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    </div>
  );
}

function QuotaBarFallback() {
  return (
    <div className="flex items-center gap-2">
      <Loader2 className="size-4 animate-spin text-muted-foreground" />
      <span className="text-xs text-muted-foreground">加载中...</span>
    </div>
  );
}

function QuotaSectionFallback() {
  return (
    <div className="border rounded-lg p-6 bg-card">
      <div className="flex items-center gap-2 mb-4">
        <Camera className="size-5 text-muted-foreground animate-pulse" />
        <Skeleton className="h-5 w-24" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-2 w-3/4" />
      </div>
    </div>
  );
}

// ============================================================================
// 带功能开关的组件包装器
// ============================================================================

/**
 * 快照按钮（带功能开关和懒加载）
 */
export function SnapshotButtonLazy(props: SnapshotButtonProps) {
  const isEnabled = useSnapshotFeature();

  if (!isEnabled) {
    return null;
  }

  return (
    <Suspense fallback={<ButtonFallback />}>
      <LazySnapshotButton {...props} />
    </Suspense>
  );
}

/**
 * 快照区域（带功能开关和懒加载）
 */
export function SnapshotSectionLazy(props: SnapshotSectionProps) {
  const isEnabled = useSnapshotFeature();

  if (!isEnabled) {
    return null;
  }

  return (
    <Suspense fallback={<SectionFallback />}>
      <LazySnapshotSection {...props} />
    </Suspense>
  );
}

/**
 * 快照配额条（带功能开关和懒加载）
 */
export function SnapshotQuotaBarLazy(props: SnapshotQuotaBarProps) {
  const isEnabled = useSnapshotFeature();

  if (!isEnabled) {
    return null;
  }

  return (
    <Suspense fallback={<QuotaBarFallback />}>
      <LazySnapshotQuotaBar {...props} />
    </Suspense>
  );
}

/**
 * 快照配额设置区块（带功能开关和懒加载）
 * 用于 Settings 页面
 */
export function SnapshotQuotaSectionLazy(props: { className?: string }) {
  const isEnabled = useSnapshotFeature();

  if (!isEnabled) {
    return null;
  }

  return (
    <Suspense fallback={<QuotaSectionFallback />}>
      <LazySnapshotQuotaSection {...props} />
    </Suspense>
  );
}

// ============================================================================
// 条件渲染 Hook
// ============================================================================

/**
 * 获取快照功能状态的 Hook
 * 供外部组件判断是否需要渲染快照相关内容
 */
export { useSnapshotFeature } from "@/lib/feature-flags";
