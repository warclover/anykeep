/**
 * 移动端底部导航栏 - 客户端导航优化版
 * 在小屏幕设备上替代侧边栏导航
 */

"use client";

import { useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Folder, BarChart3, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useSafeNavigation,
  type PageId,
  PAGE_ROUTES,
} from "@/contexts/navigation-context";

// 主导航配置
const navigation: {
  name: string;
  pageId: PageId;
  icon: typeof Home;
}[] = [
  { name: "首页", pageId: "home", icon: Home },
  { name: "搜索", pageId: "search", icon: Search },
  { name: "收藏夹", pageId: "folders", icon: Folder },
  { name: "数据", pageId: "analytics", icon: BarChart3 },
  { name: "设置", pageId: "settings", icon: Settings },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  // 安全获取导航上下文（不抛出错误）
  const navigationContext = useSafeNavigation();

  const { activePage, navigateTo, isClientNavEnabled } = navigationContext || {
    activePage: null,
    navigateTo: null,
    isClientNavEnabled: false,
  };

  /**
   * 处理导航点击
   */
  const handleNavClick = useCallback(
    (pageId: PageId, e: React.MouseEvent) => {
      if (isClientNavEnabled && navigateTo) {
        e.preventDefault();
        navigateTo(pageId);
      }
    },
    [isClientNavEnabled, navigateTo],
  );

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-16 px-2">
        {navigation.map((item) => {
          const Icon = item.icon;
          const href = PAGE_ROUTES[item.pageId];
          // 客户端导航模式下使用 activePage，否则使用 pathname
          const isActive = isClientNavEnabled
            ? activePage === item.pageId
            : pathname === href || pathname.startsWith(href + "/");

          return (
            <Link
              key={item.name}
              href={href}
              onClick={(e) => handleNavClick(item.pageId, e)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 min-w-[60px] h-14 rounded-lg transition-colors",
                isActive
                  ? "text-purple-600 dark:text-purple-400"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200",
              )}
            >
              <Icon
                className={cn(
                  "size-5 transition-transform",
                  isActive && "scale-110",
                )}
              />
              <span
                className={cn(
                  "text-xs font-medium",
                  isActive && "font-semibold",
                )}
              >
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
