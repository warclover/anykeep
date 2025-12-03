/**
 * 主应用布局
 * 包含导航栏和侧边栏
 *
 * 性能优化：用户数据通过 UserContext 客户端获取
 * 避免每次页面切换都执行服务端数据库查询
 */

import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 注意：认证检查由 middleware 处理
  // 用户数据通过 UserContext 客户端获取（见 root-providers.tsx）
  // 这样页面切换时不会重复执行数据库查询

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* 顶部导航 */}
      <AppHeader />

      <div className="flex">
        {/* 侧边栏（桌面端） */}
        <AppSidebar />

        {/* 主内容区 */}
        <main className="flex-1 p-4 md:p-6 lg:ml-44 pb-20 lg:pb-6">
          {children}
        </main>
      </div>

      {/* 底部导航栏（移动端） */}
      <MobileBottomNav />
    </div>
  );
}
