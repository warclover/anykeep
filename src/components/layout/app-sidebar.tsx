/**
 * 应用侧边栏 - 客户端导航优化版
 * 使用客户端导航实现即时页面切换
 */

"use client";

import { useCallback } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Home,
  Search,
  Folder,
  BarChart3,
  Settings,
  Trash2,
  AlertCircle,
  Star,
  Inbox,
  Sparkles,
} from "lucide-react";
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

// 系统文件夹（虚拟）- 属于首页的子状态
const systemFolders = [
  {
    name: "高价值",
    param: "high-value",
    icon: Star,
  },
  {
    name: "已失效",
    param: "invalid",
    icon: AlertCircle,
  },
  {
    name: "垃圾箱",
    param: "trash",
    icon: Trash2,
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentFolder = searchParams.get("folder");

  // 安全获取导航上下文（不抛出错误）
  const navigationContext = useSafeNavigation();

  const { activePage, navigateTo, isClientNavEnabled } = navigationContext || {
    activePage: null,
    navigateTo: null,
    isClientNavEnabled: false,
  };

  /**
   * 处理主导航点击
   */
  const handleNavClick = useCallback(
    (pageId: PageId, e: React.MouseEvent) => {
      if (isClientNavEnabled && navigateTo) {
        e.preventDefault();
        navigateTo(pageId);
      }
      // 否则让 Link 正常工作
    },
    [isClientNavEnabled, navigateTo],
  );

  /**
   * 处理系统文件夹点击
   */
  const handleSystemFolderClick = useCallback(
    (folderParam: string, e: React.MouseEvent) => {
      if (isClientNavEnabled && navigateTo) {
        e.preventDefault();
        navigateTo("home", { folder: folderParam });
      }
    },
    [isClientNavEnabled, navigateTo],
  );

  return (
    <aside className="fixed left-0 top-14 z-40 hidden lg:block w-44 h-[calc(100vh-3.5rem)] border-r bg-white dark:bg-gray-950 dark:border-gray-800">
      <div className="flex flex-col h-full p-4">
        {/* 品牌区域 */}
        <div className="px-3 mb-6">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
            AnyKeep
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            智能收藏管理
          </p>
        </div>

        {/* 主导航 */}
        <nav className="flex-1 space-y-4">
          <div className="space-y-1">
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
                    "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                    isActive
                      ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white"
                      : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/50",
                  )}
                >
                  <Icon className="size-5" />
                  {item.name}
                </Link>
              );
            })}
          </div>

          {/* 系统文件夹 */}
          <div>
            <div className="px-3 mb-2">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase">
                系统文件夹
              </p>
            </div>
            <div className="space-y-1">
              {/* 待整理入口（独立页面，不使用客户端导航） */}
              <Link
                href="/inbox"
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                  pathname === "/inbox"
                    ? "bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 dark:from-amber-900/30 dark:to-orange-900/30 dark:text-amber-400"
                    : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/50",
                )}
              >
                <Inbox className="size-5" />
                待整理
              </Link>
              {systemFolders.map((item) => {
                const Icon = item.icon;
                const href = `/home?folder=${item.param}`;
                const isActive = currentFolder === item.param;

                return (
                  <Link
                    key={item.name}
                    href={href}
                    onClick={(e) => handleSystemFolderClick(item.param, e)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                      isActive
                        ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white"
                        : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/50",
                    )}
                  >
                    <Icon className="size-5" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* 开发者工具（仅开发环境） */}
          {process.env.NODE_ENV === "development" && (
            <div>
              <div className="px-3 mb-2">
                <p className="text-xs font-semibold text-purple-400 dark:text-purple-500 uppercase">
                  开发者工具
                </p>
              </div>
              <div className="space-y-1">
                <Link
                  href="/debug/ai-summary"
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                    pathname === "/debug/ai-summary"
                      ? "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                      : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/50",
                  )}
                >
                  <Sparkles className="size-5" />
                  摘要调试
                </Link>
              </div>
            </div>
          )}
        </nav>

        {/* 底部信息 */}
        <div className="pt-4 border-t dark:border-gray-800">
          <p className="px-3 text-xs text-gray-400">AnyKeep v1.0.0</p>
        </div>
      </div>
    </aside>
  );
}
