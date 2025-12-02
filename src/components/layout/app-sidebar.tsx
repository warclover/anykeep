/**
 * 应用侧边栏 - Figma 设计版本
 */

"use client";

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
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  {
    name: "首页",
    href: "/home",
    icon: Home,
  },
  {
    name: "搜索",
    href: "/search",
    icon: Search,
  },
  {
    name: "收藏夹",
    href: "/folders",
    icon: Folder,
  },
  {
    name: "数据",
    href: "/analytics",
    icon: BarChart3,
  },
  {
    name: "设置",
    href: "/settings",
    icon: Settings,
  },
];

// 系统文件夹（虚拟）
const systemFolders = [
  {
    name: "高价值",
    href: "/home?folder=high-value",
    icon: Star,
    param: "high-value",
  },
  {
    name: "已失效",
    href: "/home?folder=invalid",
    icon: AlertCircle,
    param: "invalid",
  },
  {
    name: "垃圾箱",
    href: "/home?folder=trash",
    icon: Trash2,
    param: "trash",
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentFolder = searchParams.get("folder");

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
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.name}
                  href={item.href}
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
              {systemFolders.map((item) => {
                const Icon = item.icon;
                const isActive = currentFolder === item.param;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
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
        </nav>

        {/* 底部信息 */}
        <div className="pt-4 border-t dark:border-gray-800">
          <p className="px-3 text-xs text-gray-400">AnyKeep v1.0.0</p>
        </div>
      </div>
    </aside>
  );
}
