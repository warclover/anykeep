/**
 * 应用顶部导航栏
 *
 * 用户数据通过 UserContext 客户端获取
 * 避免每次页面切换都执行服务端数据库查询
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Moon, Sun, Search } from "lucide-react";
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
import { useUser } from "@/contexts/user-context";

export function AppHeader() {
  const { user, profile, isLoading } = useUser();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        toast.error("退出失败", {
          description: error.message,
        });
        return;
      }

      toast.success("已退出登录");
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("退出失败", {
        description: "请稍后重试",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white dark:bg-gray-950 dark:border-gray-800">
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
            aria-label="切换主题"
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>

          {/* 搜索按钮 - 使用 Link + Button asChild 启用预取并保持样式一致 */}
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="hidden sm:flex"
          >
            <Link href="/search" aria-label="搜索" prefetch={true}>
              <Search className="h-5 w-5" />
            </Link>
          </Button>

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
                    {profile?.nickname || user.email?.split("@")[0] || "用户"}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {profile?.nickname || "用户"}
                    </p>
                    <p className="text-xs leading-none text-gray-500">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <span className="text-sm">
                    已用 {profile?.storage_used || 0} /{" "}
                    {profile?.storage_quota || 500} 条
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  disabled={loading}
                  className="text-red-600 focus:text-red-600"
                >
                  {loading ? "退出中..." : "退出登录"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
    </header>
  );
}
