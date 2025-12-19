/**
 * 主内容区包装器
 * 响应侧边栏折叠状态，动态调整左边距
 */

"use client";

import { useSafeSidebar, SIDEBAR_WIDTH } from "@/contexts/sidebar-context";
import { cn } from "@/lib/utils";

interface MainContentWrapperProps {
  children: React.ReactNode;
}

export function MainContentWrapper({ children }: MainContentWrapperProps) {
  // 安全获取侧边栏上下文
  const sidebarContext = useSafeSidebar();
  const displayWidth = sidebarContext?.displayWidth ?? SIDEBAR_WIDTH.expanded;

  return (
    <main
      style={{
        marginLeft: displayWidth,
      }}
      className={cn(
        "flex-1 min-w-0 p-4 md:p-6 pb-20 lg:pb-6 overflow-hidden",
        "transition-[margin-left] duration-200 ease-out",
        // 移动端不需要左边距（侧边栏隐藏）
        "max-lg:!ml-0",
      )}
    >
      {children}
    </main>
  );
}
