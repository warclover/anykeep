/**
 * Phase 3: 首页客户端组件入口
 *
 * 通过 Feature Flag 控制新旧架构切换：
 * - V1 (Legacy): 原有单组件实现
 * - V2 (Layered): 分层架构（数据层 + 视图层分离）
 *
 * @version 3.0.0
 * @since 2026-02-05
 */

"use client";

import { lazy, Suspense } from "react";
import { VirtualListSkeleton } from "./virtual-list-skeleton";
import { useHomeLayeredArchitectureFeature } from "@/lib/feature-flags";
import type { HomePageClientLayeredProps } from "./home-page-client-layered";

// ============================================================================
// 懒加载两个版本（根据 Feature Flag 动态加载）
// ============================================================================

// V1: 原有实现（Legacy）
const HomePageClientLegacy = lazy(() =>
  import("./home-page-client").then((mod) => ({
    default: mod.HomePageClient,
  })),
);

// V2: 新分层架构实现
const HomePageClientLayered = lazy(() =>
  import("./home-page-client-layered").then((mod) => ({
    default: mod.HomePageClientLayered,
  })),
);

// ============================================================================
// 类型定义
// ============================================================================

// 类型别名，指向 Layered 版本的 Props
export type HomePageClientProps = HomePageClientLayeredProps;

// ============================================================================
// 组件实现
// ============================================================================

/**
 * 首页组件入口
 * 根据 Feature Flag 动态选择实现版本
 */
export function HomePageClient(props: HomePageClientProps) {
  const useLayeredArchitecture = useHomeLayeredArchitectureFeature();

  const Component = useLayeredArchitecture
    ? HomePageClientLayered
    : HomePageClientLegacy;

  return (
    <Suspense fallback={<VirtualListSkeleton variant="grid" count={8} />}>
      <Component {...props} />
    </Suspense>
  );
}
