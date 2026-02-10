/**
 * 移动端汉堡菜单
 * 提供侧边抽屉导航，与 Web 端侧边栏保持一致的分组结构
 *
 * 导航结构：
 * - 内容中心：我的收藏、我的搜索、我的分类、我的标签、我的笔记
 * - 整理工具：等待分类、批量操作、内容导出、分发中心、链接检测
 * - 学习中心：知识回顾、知识萃取、知识工坊
 * - 洞察中心：数据分析、活动日志、消息通知
 * - 系统：设置、垃圾箱
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Menu,
  X,
  Moon,
  Sun,
  // 内容中心
  BookOpen,
  Search,
  FolderOpen,
  Tags,
  FileText,
  // 整理工具
  Inbox,
  CheckSquare,
  Download,
  // 学习中心
  FlaskConical,
  Sparkles,
  // 洞察中心
  BarChart3,
  Activity,
  Bell,
  // 系统
  Settings,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useUnreadCount } from "@/hooks/data";
import { MessageBadge } from "@/components/messages";
import { APP_VERSION } from "@/lib/constants/app";
// 国际化
import { useUiText } from "@/lib/i18n";

// ==================== 类型定义 ====================

interface NavItem {
  name: string;
  href: string;
  icon: typeof BookOpen;
  description?: string;
  isPro?: boolean;
  badge?: "unread";
}

interface NavGroup {
  title: string;
  titleColor: string;
  activeColor: string;
  items: NavItem[];
}

// ==================== 导航配置 ====================

const navigationGroups: NavGroup[] = [
  {
    title: "navGroup.myContent",
    titleColor: "text-purple-500 dark:text-purple-400",
    activeColor:
      "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400",
    items: [
      {
        name: "nav.myBookmarks",
        href: "/home",
        icon: BookOpen,
        description: "mobileMenu.viewAllBookmarks",
      },
      {
        name: "nav.mySearch",
        href: "/search",
        icon: Search,
        description: "mobileMenu.aiSmartSearch",
      },
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
    title: "navGroup.smartTools",
    titleColor: "text-purple-500 dark:text-purple-400",
    activeColor:
      "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400",
    items: [
      {
        name: "nav.inbox",
        href: "/inbox",
        icon: Inbox,
        description: "mobileMenu.waitingClassification",
      },
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
    ],
  },
  {
    title: "navGroup.insightCenter",
    titleColor: "text-purple-500 dark:text-purple-400",
    activeColor:
      "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400",
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
    titleColor: "text-gray-400 dark:text-gray-500",
    activeColor:
      "bg-gray-100 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300",
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

export function MobileMenu() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  // 国际化
  const t = useUiText();

  // -------------------------------------------------------------------------
  // Hydration 安全：延迟挂载 Radix Sheet
  // -------------------------------------------------------------------------
  // Radix Dialog 的 SheetTrigger (asChild + Slot) 在 SSR/CSR 产生多种属性不一致：
  //   1. aria-controls: useId() 生成不同的随机 ID（React 18 已知问题）
  //   2. data-slot: SSR="button" vs CSR="sheet-trigger"（Slot 合并差异）
  //   3. className: size-11 md:size-9 vs size-9（tailwind-merge 合并差异）
  // 任一不匹配都会触发 hydration 失败 → NotFoundErrorBoundary → webpack 级联崩溃。
  //
  // 方案：SSR 和 CSR 首次渲染��输出相同的纯 <Button>（不含 Radix），
  // hydration 完成后通过 useEffect 切换到完整的 Sheet 组件。
  // MobileMenu 本身是 lg:hidden 的移动端组件，延迟挂载不影响首屏体验。
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // 使用 rAF 避免 react-hooks/set-state-in-effect 规则（同步 setState 触发级联渲染）
    requestAnimationFrame(() => setMounted(true));
  }, []);

  // 获取翻译文本的辅助函数
  const getText = (key: string): string => {
    const parts = key.split(".");
    let value: unknown = t;
    for (const part of parts) {
      value = (value as Record<string, unknown>)?.[part];
    }
    return (value as string) || key;
  };

  // 获取未读消息数量
  const { total: unreadCount, important: importantCount } = useUnreadCount();

  /**
   * 检查链接是否激活
   */
  const isLinkActive = (href: string): boolean => {
    // 处理带参数的 URL
    if (href.includes("?")) {
      return pathname === href.split("?")[0];
    }
    return pathname === href || (pathname?.startsWith(href + "/") ?? false);
  };

  // SSR/CSR 首次渲染：输出相同的纯 Button（不含 Radix），确保 hydration 一致
  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        aria-label={getText("mobileMenu.openMenu")}
        onClick={() => setMounted(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label={getText("mobileMenu.openMenu")}
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px] sm:w-[340px] p-0">
        <SheetHeader className="px-4 py-3 border-b dark:border-gray-800">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-xl font-bold text-purple-600 dark:text-purple-400">
              AnyKeep
            </SheetTitle>
            <SheetClose asChild>
              <Button variant="ghost" size="icon">
                <X className="h-4 w-4" />
              </Button>
            </SheetClose>
          </div>
        </SheetHeader>

        {/* 导航菜单 - 可滚动区域 */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6 max-h-[calc(100vh-180px)]">
          {navigationGroups.map((group) => (
            <div key={group.title}>
              {/* 分组标题 */}
              <p
                className={cn(
                  "text-xs font-semibold uppercase tracking-wider px-3 mb-2",
                  group.titleColor,
                )}
              >
                {getText(group.title)}
              </p>

              {/* 分组项目 */}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = isLinkActive(item.href);
                  const showUnreadBadge =
                    item.badge === "unread" && unreadCount > 0;

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                        isActive
                          ? group.activeColor
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
                              "font-medium",
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
                        {item.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                            {getText(item.description)}
                          </p>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* 底部信息和主题切换 */}
        <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 p-4 space-y-3">
          {/* 主题切换 */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-full justify-start gap-2"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
            <span className="ml-2">
              {theme === "dark"
                ? getText("mobileMenu.switchToLightMode")
                : getText("mobileMenu.switchToDarkMode")}
            </span>
          </Button>

          {/* 版本信息 */}
          <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
            <span>AnyKeep v{APP_VERSION}</span>
            <span>{getText("mobileMenu.version")}</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
