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
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Moon, Sun, Search, Plus, Sparkles, Filter } from "lucide-react";
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
import { NotificationDropdown } from "@/components/layout/notification-dropdown";
import { useUser } from "@/contexts/user-context";
import { useSafeNavigation } from "@/contexts/navigation-context";
import { useHomePageSafe } from "@/contexts/home-page-context";
import { QuickAddBookmark } from "@/components/quick-add";
import { useIsMobile } from "@/hooks/use-media-query";
import { useUiText } from "@/lib/i18n";

export const AppHeader = memo(function AppHeader() {
  const { user, profile, isLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();
  const t = useUiText();

  // 获取导航和首页上下文
  const navigationContext = useSafeNavigation();
  const homeContext = useHomePageSafe();

  const { activePage, isClientNavEnabled } = navigationContext || {
    activePage: null,
    isClientNavEnabled: false,
  };

  // 判断是否在首页
  const isHomePage = isClientNavEnabled
    ? activePage === "home"
    : pathname === "/home";

  // 获取当前文件夹和平台（用于判断回收站和浏览器书签）
  const currentFolder =
    homeContext?.filter.folder ?? searchParams?.get("folder") ?? "";
  const currentPlatform =
    homeContext?.filter.platform ?? searchParams?.get("platform") ?? "";

  // 判断是否为回收站或浏览器书签
  const isTrashFolder = currentFolder === "trash";
  const isBrowserPlatform = currentPlatform === "browser";

  // 是否显示快速添加区域：首页 + 非回收站 + 非移动端
  const showQuickAdd = isHomePage && !isTrashFolder && !isMobile;

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
          <span className="text-lg md:text-xl font-bold text-purple-600 dark:text-purple-400">
            AnyKeep
          </span>
        </Link>

        {/* 平台筛选（仅首页显示） */}
        <div className="hidden sm:flex flex-1 justify-start overflow-hidden ml-4 lg:ml-20 mr-2">
          <PlatformFilter />
        </div>

        {/* 右侧操作区 */}
        <div className="flex items-center gap-1 ml-auto shrink-0">
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

          {/* 搜索按钮 - 使用 Link + Button asChild 启用预取并保持样式一致 */}
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="hidden sm:flex"
          >
            <Link href="/search" aria-label={t.common.search} prefetch={true}>
              <Search className="h-5 w-5" />
            </Link>
          </Button>

          {/* 通知按钮 */}
          <NotificationDropdown />

          {/* 更多菜单 */}
          <HeaderMenu />

          {/* 用户菜单 */}
          {isLoading ? (
            // 加载状态骨架屏
            <div className="flex items-center gap-2 px-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="hidden md:block h-4 w-16" />
            </div>
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-9 gap-2 rounded-full px-2 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900 flex-shrink-0">
                    <span className="text-sm font-medium text-purple-600 dark:text-purple-300">
                      {profile?.nickname?.[0] ||
                        user.email?.[0]?.toUpperCase() ||
                        "U"}
                    </span>
                  </div>
                  {/* 用户名 - 在中等及以上屏幕显示 */}
                  <span className="hidden md:inline-block text-sm font-medium text-gray-700 dark:text-gray-200 max-w-[120px] truncate">
                    {profile?.nickname ||
                      user.email?.split("@")[0] ||
                      t.common.user}
                  </span>
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

      {/* 第二行：快速添加区域（仅首页非回收站显示） */}
      {showQuickAdd && (
        <div className="flex items-center h-11 px-4 lg:px-6 gap-2 border-t border-gray-100 dark:border-gray-800">
          {/* Logo 占位（桌面端：不可见但占用相同空间，实现与第一行平台筛选左对齐） */}
          <div
            className="hidden sm:flex items-center space-x-2 shrink-0 invisible"
            aria-hidden="true"
          >
            <span className="text-lg md:text-xl font-bold">AnyKeep</span>
          </div>

          {/* 快速添加区域（向左靠拢，略小于第一行平台筛选） */}
          <div className="flex flex-1 items-center gap-2 sm:ml-2 lg:ml-10">
            <div className="flex-1 min-w-0 max-w-2xl">
              <QuickAddBookmark />
            </div>

            {/* 手动创建按钮 - 主操作（粉红描边，无底色） */}
            <Button
              variant="outline"
              className="shrink-0 h-8 px-3 text-sm border-2 border-pink-400 text-pink-600 bg-transparent hover:bg-pink-50 hover:border-pink-500 dark:text-pink-400 dark:border-pink-500 dark:hover:bg-pink-950/30 dark:hover:border-pink-400 transition-all duration-200"
              onClick={handleOpenCreatePanel}
            >
              <Plus className="size-3.5 mr-1" />
              {t.mobileMenu.manualCreate}
            </Button>

            {/* 用途筛选按钮（非浏览器书签 + 无文件夹筛选时显示）- 次要操作 */}
            {!isBrowserPlatform && !currentFolder && homeContext && (
              <Button
                variant="outline"
                className="shrink-0 h-8 px-3 text-sm text-purple-600 border-purple-200 hover:bg-purple-50 hover:border-purple-300 dark:text-purple-400 dark:border-purple-800 dark:hover:bg-purple-950/30 transition-colors duration-200"
                onClick={handleOpenFilterPanel}
              >
                <Filter className="size-3.5 mr-1" />
                {t.nav.usageFilter}
              </Button>
            )}

            {/* AI 助理按钮 - 次要操作 */}
            {homeContext && (
              <Button
                variant="outline"
                className="shrink-0 h-8 px-3 text-sm text-cyan-600 border-cyan-200 hover:bg-cyan-50 hover:border-cyan-300 dark:text-cyan-400 dark:border-cyan-800 dark:hover:bg-cyan-950/30 transition-colors duration-200"
                onClick={() => homeContext.aiPanel.toggleAIPanel()}
              >
                <Sparkles className="size-3.5 mr-1" />
                {t.mobileMenu.aiAssistant}
              </Button>
            )}
          </div>
        </div>
      )}
    </header>
  );
});
