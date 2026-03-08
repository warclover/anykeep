/**
 * 响应式布局包装器
 * P2-3.3: 移动/桌面条件渲染优化
 *
 * 使用 JavaScript 条件渲染替代 CSS 隐藏，减少 DOM 节点数量
 * - 桌面端：渲染 AppSidebar，不渲染 MobileBottomNav
 * - 移动端：渲染 MobileBottomNav，不渲染 AppSidebar
 *
 * V5.4 修复 (2026-03-08):
 * - 移除 dynamic({ ssr: false })，改为直接导入
 * - 在服务端组件中使用 next/dynamic 会导致 RSC payload 异步模块标记，
 *   客户端 requireAsyncModule 解析失败 → hydration 崩溃
 * - 直接导入 "use client" 组件是安全的，Suspense fallback={null} 不阻塞首屏
 *
 * @since V5.3 (2026-02-01)
 */

"use client";

import { Suspense, memo } from "react";
import { useIsMobile } from "@/hooks/ai/use-is-mobile";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";

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
