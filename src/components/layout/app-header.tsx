/**
 * 应用顶部导航栏
 *
 * 用户数据通过 UserContext 客户端获取
 * 避免每次页面切换都执行服务端数据库查询
 *
 * V4.3: 集成快速添加区域（第二行）
 *
 * V5.3 性能优化 (2026-02-01):
 * - P2-3.4: 使用 React.memo 避免不必要的重渲染
 */

"use client";

import { useState, memo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { PlatformFilter } from "@/components/layout/platform-filter";
import { HeaderMenu } from "@/components/layout/header-menu";
import { HeaderToolbar } from "@/components/layout/header-toolbar";
import { NotificationDropdown } from "@/components/layout/notification-dropdown";
import { useUser } from "@/contexts/user-context";
import { useHomePageSafe } from "@/contexts/home-page-context";
import { QuickAddBookmark } from "@/components/quick-add";
import { useIsMobile } from "@/hooks/use-media-query";
import { useUiText } from "@/lib/i18n";

export const AppHeader = memo(function AppHeader() {
  const { user, profile, isLoading } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();
  const t = useUiText();

  // 获取首页上下文（用于平台筛选判断）
  const homeContext = useHomePageSafe();

  // 获取当前文件夹和平台（用于判断浏览器书签）
  const currentFolder =
    homeContext?.filter.folder ?? searchParams?.get("folder") ?? "";
  const currentPlatform =
    homeContext?.filter.platform ?? searchParams?.get("platform") ?? "";

  // 判断是否为浏览器书签
  const isBrowserPlatform = currentPlatform === "browser";

  // 是否显示快速添加区域：非移动端（所有桌面端页面都显示）
  // V5.4: 扩展到全局，用户可在任意页面快速收藏
  const showQuickAdd = !isMobile;

  // 手动创建按钮点击事件 - 使用挤压式面板
  const handleOpenCreatePanel = () => {
    if (homeContext) {
      homeContext.aiPanel.toggleCreatePanel();
    }
  };

  // 用途筛选按钮点击事件 - 使用挤压式面板
  const handleOpenFilterPanel = () => {
    if (homeContext) {
      homeContext.aiPanel.toggleFilterPanel();
    }
  };

  const handleSignOut = async () => {
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        toast.error(t.common.logoutFailed, {
          description: error.message,
        });
        return;
      }

      toast.success(t.common.logoutSuccess);
      router.push("/login");
      router.refresh();
    } catch {
      toast.error(t.common.logoutFailed, {
        description: t.common.logoutRetry,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white dark:bg-gray-950 dark:border-gray-800">
      {/* 第一行：Logo + 平台筛选 + 右侧操作区 */}
      <div className="flex h-14 items-center px-4 lg:px-6 gap-2">
        {/* 移动端汉堡菜单 */}
        <MobileMenu />

        {/* Logo */}
        <Link href="/home" className="flex items-center space-x-2 shrink-0">
          <span className="text-lg md:text-xl font-bold text-pink-600 dark:text-pink-400">
            AnyKeep
          </span>
        </Link>

        {/* 快速添加（首页非回收站）或 平台筛选（其他情况） */}
        {showQuickAdd ? (
          <div className="hidden sm:flex flex-1 items-center gap-2 ml-4 lg:ml-20 mr-2 overflow-hidden">
            <div className="flex-1 min-w-0 max-w-2xl">
              <QuickAddBookmark />
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 h-7 px-2 text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={handleOpenCreatePanel}
            >
              {t.mobileMenu.manualCreate}
            </Button>

            {!isBrowserPlatform && !currentFolder && homeContext && (
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 h-7 px-2 text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={handleOpenFilterPanel}
              >
                {t.nav.usageFilter}
              </Button>
            )}

            {homeContext && (
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 h-7 px-2 text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => homeContext.aiPanel.toggleAIPanel()}
              >
                {t.mobileMenu.aiAssistant}
              </Button>
            )}
          </div>
        ) : (
          <div className="hidden sm:flex flex-1 justify-start overflow-hidden ml-4 lg:ml-20 mr-2">
            <PlatformFilter />
          </div>
        )}

        {/* 右侧操作区 */}
        <div className="flex items-center gap-1 ml-auto shrink-0">
          {/* 首页工具栏（视图切换 + 排序） */}
          <HeaderToolbar />

          {/* 更多菜单 */}
          <HeaderMenu />

          {/* 通知按钮 */}
          <NotificationDropdown />

          {/* 主题切换按钮 */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="hidden sm:flex"
            aria-label={t.common.toggleTheme}
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>

          {/* 用户菜单 */}
          {isLoading ? (
            // 加载状态骨架屏
            <Skeleton className="h-8 w-8 rounded-full" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900">
                    <span className="text-sm font-medium text-purple-600 dark:text-purple-300">
                      {profile?.nickname?.[0] ||
                        user.email?.[0]?.toUpperCase() ||
                        "U"}
                    </span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {profile?.nickname || t.common.user}
                    </p>
                    <p className="text-xs leading-none text-gray-500">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <span className="text-sm">
                    {t.common.usedQuota
                      .replace("{used}", String(profile?.storage_used || 0))
                      .replace(
                        "{total}",
                        String(profile?.storage_quota || 500),
                      )}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  disabled={loading}
                  className="text-red-600 focus:text-red-600"
                >
                  {loading ? t.common.loggingOut : t.settings.header.logout}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      {/* 第二行：平台筛选区域（仅首页非回收站显示） */}
      {showQuickAdd && (
        <div className="flex items-center h-11 px-4 lg:px-6 gap-2 border-t border-gray-100 dark:border-gray-800">
          {/* Logo 占位（桌面端：不可见但占用相同空间，实现与第一行左对齐） */}
          <div
            className="hidden sm:flex items-center space-x-2 shrink-0 invisible"
            aria-hidden="true"
          >
            <span className="text-lg md:text-xl font-bold">AnyKeep</span>
          </div>

          <div className="flex flex-1 items-center gap-2 sm:ml-2 lg:ml-10">
            <PlatformFilter />
          </div>
        </div>
      )}
    </header>
  );
});
