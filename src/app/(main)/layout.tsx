/**
 * 主应用布局
 * 包含导航栏和侧边栏
 *
 * 性能优化：
 * 1. 用户数据通过 UserContext 客户端获取
 * 2. 页面切换使用客户端导航（Keep-Alive 模式）
 * 避免每次页面切换都执行服��端数据库查询
 *
 * Phase 4: 集成 AI 对话功能
 * Phase 5: 可折叠侧边栏，内容区联动
 * V4.3: AI 面板挤压式布局（与 MainContentWrapper 同级）
 *
 * 架构改进 v1.0 (2025-12-28):
 * - 添加 FeatureErrorBoundary 实现局部错误隔离
 *
 * V5.2 性能优化 (2026-02-01):
 * - 非关键组件使用 dynamic() 懒加载
 * - LayoutAIPanel、MobileBottomNav、FloatingActionMenu 延迟加载
 * - 添加 Suspense 边界实现流式渲染
 *
 * V5.3 性能优化 (2026-02-01):
 * - P2-3.3: 移动/桌面条件渲染，按设备类型按需加载组件
 */

// v2 性能优化：移除 force-dynamic，让 Next.js 自动决定渲染模式
// UserProvider 已优化为非阻塞式加载

import { Suspense } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { MainContent } from "@/components/main/main-content";
import { MainContentWrapper } from "@/components/layout/main-content-wrapper";
import { MainLayoutErrorBoundary } from "@/components/layout/main-layout-error-boundary";
import { MainContentSkeleton } from "@/components/layout/main-content-skeleton";
import { PageToolbarProvider } from "@/contexts/page-toolbar-context";
// PageToolbarSlot 已移入 AppHeader 内部渲染（页面工具栏替换第二行）
// V5.3: P2-3.3 响应式布局组件（条件渲染优化）
import {
  DesktopSidebar,
  MobileNav,
} from "@/components/layout/responsive-layout-wrapper";
// V5.4: 直接导入替代 dynamic() — 在服务端组件中使用 next/dynamic 会导致
// webpack 在 RSC payload 中产生异步模块标记（,1] 后缀），客户端 requireAsyncModule
// 预加载解析失败 → hydration 崩溃 → 整个页面回退 CSR → Suspense 流式内容丢失。
// 直接导入 "use client" 组件在服务端组件中是安全的，Next.js 自动处理边界，
// 且 Suspense fallback={null} 已保证不会阻塞首屏渲染。
import { LayoutAIPanel } from "@/components/layout/layout-ai-panel";
import { FloatingActionMenu } from "@/components/fab";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 注意：认证检查由 middleware 处理
  // 用户数据通过 UserContext 客户端获取（见 root-providers.tsx）
  // 页面切换通过 NavigationContext 客户端管理（见 navigation-context.tsx）

  return (
    <PageToolbarProvider>
      <div className="h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden flex flex-col">
        {/* 顶部导航 */}
        <AppHeader />

        {/* 页面工具栏已移入 AppHeader 内部（替换第二行平台筛选） */}

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* V5.3: 侧边栏（条件渲染 - 仅桌面端） */}
          <DesktopSidebar />

          {/* 主内容区 - 使用 Suspense + ErrorBoundary 隔离 */}
          <MainLayoutErrorBoundary>
            <Suspense fallback={<MainContentSkeleton />}>
              <MainContentWrapper>
                <MainContent>{children}</MainContent>
              </MainContentWrapper>
            </Suspense>
          </MainLayoutErrorBoundary>

          {/* V4.3: AI 助手面板（挤压式布局，与主内容区同级） */}
          <Suspense fallback={null}>
            <LayoutAIPanel />
          </Suspense>
        </div>

        {/* V5.3: 底部导航栏（条件渲染 - 仅移动端） */}
        <MobileNav />

        {/* 悬浮操作菜单（快速收藏 + 反馈建议） */}
        <Suspense fallback={null}>
          <FloatingActionMenu />
        </Suspense>
      </div>
    </PageToolbarProvider>
  );
}
