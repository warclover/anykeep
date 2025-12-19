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
 * Phase 6: CSS Grid 布局优化，消除 Layout Thrashing
 */

export const dynamic = "force-dynamic";

import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { MainContent } from "@/components/main/main-content";
import { ChatButton } from "@/components/chat";
import { MainContentWrapper } from "@/components/layout/main-content-wrapper";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 注意：认证检查由 middleware 处理
  // 用户数据通过 UserContext 客户端获取（见 root-providers.tsx）
  // 页面切换通过 NavigationContext 客户端管理（见 navigation-context.tsx）

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 overflow-x-hidden">
      {/* 顶部导航 */}
      <AppHeader />

      {/* CSS Grid 布局：侧边栏使用 transform 动画，主内容区无需响应宽度变化 */}
      {/* 高度 = 100vh - header高度(56px)，确保 Grid 填满剩余空间 */}
      <div className="grid grid-cols-[auto_1fr] h-[calc(100vh-3.5rem)] overflow-hidden">
        {/* 侧边栏（桌面端）- 使用 transform 动画，仅触发 Composite */}
        <AppSidebar />

        {/* 主内容区 - 固定在第二列，无需响应侧边栏宽度变化 */}
        <MainContentWrapper>
          <MainContent>{children}</MainContent>
        </MainContentWrapper>
      </div>

      {/* 底部导航栏（移动端） */}
      <MobileBottomNav />

      {/* AI 对话悬浮按钮 */}
      <ChatButton />
    </div>
  );
}
