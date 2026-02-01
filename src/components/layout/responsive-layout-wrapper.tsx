/**
 * 响应式布局包装器
 * P2-3.3: 移动/桌面条件渲染优化
 *
 * 使用 JavaScript 条件渲染替代 CSS 隐藏，减少 DOM 节点数量
 * - 桌面端：渲染 AppSidebar，不渲染 MobileBottomNav
 * - 移动端：渲染 MobileBottomNav，不渲染 AppSidebar
 *
 * @since V5.3 (2026-02-01)
 */

"use client";

import { Suspense, memo } from "react";
import dynamic from "next/dynamic";
import { useIsMobile } from "@/hooks/ai/use-is-mobile";

// 懒加载组件
const AppSidebar = dynamic(
  () => import("@/components/layout/app-sidebar").then((mod) => mod.AppSidebar),
  { ssr: false },
);

const MobileBottomNav = dynamic(
  () =>
    import("@/components/layout/mobile-bottom-nav").then(
      (mod) => mod.MobileBottomNav,
    ),
  { ssr: false },
);

/**
 * 桌面端侧边栏（仅桌面端渲染）
 * 使用 memo 避免不必要的重渲染
 */
export const DesktopSidebar = memo(function DesktopSidebar() {
  const isMobile = useIsMobile();

  // 移动端���渲染侧边栏，减少 DOM 节点
  if (isMobile) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <AppSidebar />
    </Suspense>
  );
});

/**
 * 移动端底部导航（仅移动端渲染）
 * 使用 memo 避免不必要的重渲染
 */
export const MobileNav = memo(function MobileNav() {
  const isMobile = useIsMobile();

  // 桌面端不渲染底部导航，减少 DOM 节点
  if (!isMobile) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <MobileBottomNav />
    </Suspense>
  );
});
