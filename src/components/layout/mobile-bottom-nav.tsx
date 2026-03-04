/**
 * 移动端底部导航栏 - 4 Tab + "更多" Sheet
 *
 * 导航结构：
 * - 收藏 (BookOpen) → /home
 * - 搜索 (Search) → /search
 * - 整理 (Sparkles) → /organize
 * - 更多 (MoreHorizontal) → 展开完整菜单 Sheet
 *
 * "更多" Sheet 与汉堡菜单共用 nav-config（getMobileMoreGroups），
 * 确保移动端双入口内容一致，与 Web 侧边栏同源。
 */

"use client";

import { memo, useCallback, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  BookOpen,
  Search,
  Sparkles,
  MoreHorizontal,
  Moon,
  Sun,
  Plus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useSafeNavigation,
  type PageId,
  PAGE_ROUTES,
} from "@/contexts/navigation-context";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useUnreadCount } from "@/hooks/data";
import { MessageBadge } from "@/components/messages";
import { useUiText, getNestedValue } from "@/lib/i18n";
import { getMobileMoreGroups } from "@/lib/navigation/nav-config";

// ==================== 导航配置（从统一数据源获取） ====================
// "更多" Sheet 的导航分组来自 src/lib/navigation/nav-config.ts
const moreNavigationGroups = getMobileMoreGroups();

// ==================== 组件 ====================

export const MobileBottomNav = memo(function MobileBottomNav() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [moreOpen, setMoreOpen] = useState(false);
  const t = useUiText();
  const { total: unreadCount, important: importantCount } = useUnreadCount();

  // 安全获取导航上下文（不抛出错误）
  const navigationContext = useSafeNavigation();

  const { activePage, navigateTo, isClientNavEnabled } = navigationContext || {
    activePage: null,
    navigateTo: null,
    isClientNavEnabled: false,
  };

  // 获取翻译文本（复用 i18n 共享工具函数）
  const getText = (key: string): string =>
    getNestedValue<string>(t as unknown as Record<string, unknown>, key) ?? key;

  /**
   * 处理底部 Tab 导航点击
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

  /**
   * 检查链接是否激活
   */
  const isLinkActive = (href: string): boolean => {
    if (href.includes("?")) {
      return pathname === href.split("?")[0];
    }
    return pathname === href || (pathname?.startsWith(href + "/") ?? false);
  };

  /**
   * 判断"更多"菜单中是否有激活项（用于高亮"更多" Tab）
   */
  const isMoreActive = moreNavigationGroups.some((group) =>
    group.items.some((item) => isLinkActive(item.href)),
  );

  /**
   * 判断是否有未读消息（用于"更多" Tab 上显示红点）
   */
  const hasUnread = unreadCount > 0;

  // 整理 Tab 的 href
  const organizeHref = "/organize";
  const isOrganizeActive = isClientNavEnabled
    ? false // organize 暂未在 Keep-Alive 中
    : pathname === organizeHref ||
      (pathname?.startsWith(organizeHref + "/") ?? false);

  return (
    <>
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around h-16 px-2">
          {/* 收藏 Tab */}
          {(() => {
            const isActive = isClientNavEnabled
              ? activePage === "home"
              : pathname === "/home" ||
                (pathname?.startsWith("/home/") ?? false);
            return (
              <Link
                href={PAGE_ROUTES.home}
                onClick={(e) => handleNavClick("home", e)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 min-w-[60px] h-14 rounded-lg transition-colors",
                  isActive
                    ? "text-purple-600 dark:text-purple-400"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200",
                )}
              >
                <BookOpen
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
                  {getText("nav.myBookmarks")}
                </span>
              </Link>
            );
          })()}

          {/* 搜索 Tab */}
          {(() => {
            const isActive = isClientNavEnabled
              ? activePage === "search"
              : pathname === "/search" ||
                (pathname?.startsWith("/search/") ?? false);
            return (
              <Link
                href={PAGE_ROUTES.search}
                onClick={(e) => handleNavClick("search", e)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 min-w-[60px] h-14 rounded-lg transition-colors",
                  isActive
                    ? "text-purple-600 dark:text-purple-400"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200",
                )}
              >
                <Search
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
                  {getText("nav.mySearch")}
                </span>
              </Link>
            );
          })()}

          {/* 整理 Tab */}
          <Link
            href={organizeHref}
            className={cn(
              "flex flex-col items-center justify-center gap-1 min-w-[60px] h-14 rounded-lg transition-colors",
              isOrganizeActive
                ? "text-purple-600 dark:text-purple-400"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200",
            )}
          >
            <Sparkles
              className={cn(
                "size-5 transition-transform",
                isOrganizeActive && "scale-110",
              )}
            />
            <span
              className={cn(
                "text-xs font-medium",
                isOrganizeActive && "font-semibold",
              )}
            >
              {getText("nav.organize")}
            </span>
          </Link>

          {/* 更多 Tab */}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "relative flex flex-col items-center justify-center gap-1 min-w-[60px] h-14 rounded-lg transition-colors",
              isMoreActive || moreOpen
                ? "text-purple-600 dark:text-purple-400"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200",
            )}
          >
            <MoreHorizontal
              className={cn(
                "size-5 transition-transform",
                (isMoreActive || moreOpen) && "scale-110",
              )}
            />
            <span
              className={cn(
                "text-xs font-medium",
                (isMoreActive || moreOpen) && "font-semibold",
              )}
            >
              {getText("mobileMenu.more") || "更多"}
            </span>
            {/* 未读消息红点 */}
            {hasUnread && (
              <span className="absolute top-1.5 right-2.5 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </button>
        </div>
      </nav>

      {/* "更多" Sheet */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] rounded-t-2xl p-0">
          <SheetHeader className="px-4 py-3 border-b dark:border-gray-800">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-lg font-bold text-purple-600 dark:text-purple-400">
                AnyKeep
              </SheetTitle>
              <SheetClose asChild>
                <Button variant="ghost" size="icon">
                  <X className="h-4 w-4" />
                </Button>
              </SheetClose>
            </div>
          </SheetHeader>

          {/* 快捷操作区 */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => setMoreOpen(false)}
              >
                <Plus className="size-3.5" />
                {getText("mobileMenu.manualCreate") || "手动创建"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => setMoreOpen(false)}
              >
                <Sparkles className="size-3.5" />
                {getText("mobileMenu.aiAssistant") || "AI 助理"}
              </Button>
            </div>
          </div>

          {/* 导航菜单 - 可滚动区域 */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5 max-h-[calc(85vh-200px)]">
            {moreNavigationGroups.map((group) => (
              <div key={group.title}>
                {/* 分组标题 */}
                <p className="text-xs font-semibold uppercase tracking-wider px-3 mb-2 text-gray-400 dark:text-gray-500">
                  {getText(group.title)}
                </p>

                {/* 分组项目 */}
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = isLinkActive(item.href);
                    const showUnreadBadge =
                      item.badge === "unread" && unreadCount > 0;

                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setMoreOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                          isActive
                            ? "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400"
                            : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800",
                        )}
                      >
                        <Icon
                          className={cn(
                            "size-5 flex-shrink-0",
                            isActive ? "" : "text-gray-400 dark:text-gray-500",
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "font-medium text-sm",
                                isActive && "font-semibold",
                              )}
                            >
                              {getText(item.name)}
                            </span>
                            {item.isPro && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                                Pro
                              </span>
                            )}
                            {showUnreadBadge && (
                              <MessageBadge
                                count={unreadCount}
                                hasImportant={importantCount > 0}
                              />
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* 底部：主题切换 */}
          <div className="border-t border-gray-200 dark:border-gray-800 p-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="w-full justify-center gap-2"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
              <span>
                {theme === "dark"
                  ? getText("mobileMenu.switchToLightMode")
                  : getText("mobileMenu.switchToDarkMode")}
              </span>
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
});
