/**
 * 主应用布局
 * 包含导航栏和侧边栏
 *
 * 性能优化：
 * 1. 用户数据通过 UserContext 客户端获取
 * 2. 页面切换使用客户端导航（Keep-Alive 模式）
 * 避免每次页面切换都执行服务端数据库查询
 *
 * Phase 4: 集成 AI 对话功能
 * Phase 5: 可折叠侧边栏，内容区联动
 * V4.3: AI 面板挤压式布局（与 MainContentWrapper 同级）
 *
 * 架构改进 v1.0 (2025-12-28):
 * - 添加 FeatureErrorBoundary 实现局部错误隔离
 */

export const dynamic = "force-dynamic";

import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { MainContent } from "@/components/main/main-content";
import { MainContentWrapper } from "@/components/layout/main-content-wrapper";
import { LayoutAIPanel } from "@/components/layout/layout-ai-panel";
import { MainLayoutErrorBoundary } from "@/components/layout/main-layout-error-boundary";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 注意：认证检查由 middleware 处理
  // 用户数据通过 UserContext 客户端获取（见 root-providers.tsx）
  // 页面切换通过 NavigationContext 客户端管理（见 navigation-context.tsx）

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden flex flex-col">
      {/* 顶部导航 */}
      <AppHeader />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* 侧边栏（桌面端） */}
        <AppSidebar />

        {/* 主内容区 - 使用 FeatureErrorBoundary 隔离错误 */}
        <MainLayoutErrorBoundary>
          <MainContentWrapper>
            <MainContent>{children}</MainContent>
          </MainContentWrapper>
        </MainLayoutErrorBoundary>

        {/* V4.3: AI 助手面板（挤压式布局，与主内容区同级） */}
        <LayoutAIPanel />
      </div>

      {/* 底部导航栏（移动端） */}
      <MobileBottomNav />
    </div>
  );
}
