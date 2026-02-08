/**
 * 移动端底部导航栏 - 4 Tab + "更多" Sheet
 *
 * 导航结构：
 * - 收藏 (BookOpen) → /home
 * - 搜索 (Search) → /search
 * - 收件箱 (Inbox) → /inbox
 * - 更多 (MoreHorizontal) → 展开完整菜单 Sheet
 *
 * "更多" Sheet 复用 mobile-menu.tsx 的分组结构，
 * 确保移动端可访问桌面端 100% 的功能。
 */

"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  BookOpen,
  Search,
  Inbox,
  MoreHorizontal,
  // "更多" Sheet 内分组图标
  FolderOpen,
  Tags,
  FileText,
  CheckSquare,
  Download,
  Share2,
  LinkIcon,
  FlaskConical,
  Sparkles,
  BarChart3,
  Activity,
  Bell,
  Settings,
  Trash2,
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
import { useUiText } from "@/lib/i18n";

// ==================== 类型定义 ====================

interface MoreNavItem {
  name: string;
  href: string;
  icon: typeof BookOpen;
  description?: string;
  isPro?: boolean;
  badge?: "unread";
}

interface MoreNavGroup {
  title: string;
  items: MoreNavItem[];
}

// ==================== "更多" Sheet 导航分组 ====================

const moreNavigationGroups: MoreNavGroup[] = [
  {
    title: "navGroup.contentCenter",
    items: [
      {
        name: "nav.myFolders",
        href: "/folders",
        icon: FolderOpen,
        description: "mobileMenu.manageFolders",
      },
      {
        name: "nav.myTags",
        href: "/tags",
        icon: Tags,
        description: "mobileMenu.tagManagement",
      },
      {
        name: "nav.myNotes",
        href: "/md-collections",
        icon: FileText,
        description: "mobileMenu.markdownNotes",
        isPro: true,
      },
    ],
  },
  {
    title: "navGroup.organizeTools",
    items: [
      {
        name: "nav.inbox",
        href: "/inbox",
        icon: Inbox,
        description: "mobileMenu.waitingClassification",
      },
      {
        name: "nav.batch",
        href: "/batch",
        icon: CheckSquare,
        description: "mobileMenu.batchManagement",
      },
      {
        name: "nav.export",
        href: "/export",
        icon: Download,
        description: "mobileMenu.exportData",
      },
      {
        name: "mobileMenu.distributionCenter",
        href: "/distribution",
        icon: Share2,
        description: "mobileMenu.distributionCenter",
      },
      {
        name: "mobileMenu.linkHealthCheck",
        href: "/link-health",
        icon: LinkIcon,
        description: "mobileMenu.linkHealthCheck",
      },
    ],
  },
  {
    title: "navGroup.learningCenter",
    items: [
      {
        name: "nav.synthesis",
        href: "/synthesis",
        icon: FlaskConical,
        description: "mobileMenu.themeExtraction",
      },
      {
        name: "nav.draftStudio",
        href: "/knowledge-studio",
        icon: Sparkles,
        description: "mobileMenu.aiReportGeneration",
        isPro: true,
      },
    ],
  },
  {
    title: "navGroup.insightCenter",
    items: [
      {
        name: "nav.analytics",
        href: "/analytics",
        icon: BarChart3,
        description: "mobileMenu.viewDataAnalysis",
      },
      {
        name: "nav.activityLog",
        href: "/activity",
        icon: Activity,
        description: "mobileMenu.operationHistory",
      },
      {
        name: "nav.notifications",
        href: "/messages",
        icon: Bell,
        description: "mobileMenu.systemMessages",
        badge: "unread",
      },
    ],
  },
  {
    title: "mobileMenu.system",
    items: [
      {
        name: "nav.settings",
        href: "/settings",
        icon: Settings,
        description: "mobileMenu.appSettings",
      },
      {
        name: "nav.trash",
        href: "/home?folder=trash",
        icon: Trash2,
        description: "mobileMenu.deletedContent",
      },
    ],
  },
];

// ==================== 组件 ====================

export function MobileBottomNav() {
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

  // 获取翻译文本的辅助函数
  const getText = (key: string): string => {
    const parts = key.split(".");
    let value: unknown = t;
    for (const part of parts) {
      value = (value as Record<string, unknown>)?.[part];
    }
    return (value as string) || key;
  };

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

  // 收件箱的 href（暂时使用 /inbox 路由）
  const inboxHref = "/inbox";
  const isInboxActive = isClientNavEnabled
    ? false // inbox 暂未在 Keep-Alive 中
    : pathname === inboxHref ||
      (pathname?.startsWith(inboxHref + "/") ?? false);

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

          {/* 收件箱 Tab */}
          <Link
            href={inboxHref}
            className={cn(
              "flex flex-col items-center justify-center gap-1 min-w-[60px] h-14 rounded-lg transition-colors",
              isInboxActive
                ? "text-purple-600 dark:text-purple-400"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200",
            )}
          >
            <Inbox
              className={cn(
                "size-5 transition-transform",
                isInboxActive && "scale-110",
              )}
            />
            <span
              className={cn(
                "text-xs font-medium",
                isInboxActive && "font-semibold",
              )}
            >
              {getText("nav.inbox")}
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
                <Button variant="ghost" size="icon" className="h-8 w-8">
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
}
