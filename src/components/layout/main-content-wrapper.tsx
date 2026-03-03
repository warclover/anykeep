/**
 * 主内容区包装器
 * 响应侧边栏折叠状态，动态调整左边距
 */

"use client";

import { memo } from "react";
import { useSafeSidebar, SIDEBAR_WIDTH } from "@/contexts/sidebar-context";
import { cn } from "@/lib/utils";

interface MainContentWrapperProps {
  children: React.ReactNode;
}

export const MainContentWrapper = memo(function MainContentWrapper({
  children,
}: MainContentWrapperProps) {
  // 安全获取侧边栏上下文
  const sidebarContext = useSafeSidebar();
  const displayWidth = sidebarContext?.displayWidth ?? SIDEBAR_WIDTH.expanded;

  return (
    <main
      style={{
        marginLeft: displayWidth,
        willChange: "margin-left", // GPU 优化提示
      }}
      className={cn(
        "flex-1 min-w-0 min-h-0 h-full flex flex-col",
        "p-4 md:p-6 pb-20 lg:pb-6",
        "transition-[margin-left] duration-200 ease-smooth",
        // 移动端不需要左边距（侧边栏隐藏）
        "max-lg:!ml-0",
      )}
    >
      {children}
    </main>
  );
});
