/**
 * 移动端汉堡菜单
 * 提供侧边抽屉导航，与 Web 端侧边栏保持一致的分组结构
 *
 * 导航结构：
 * - 内容中心：我的收藏、我的搜索、我的分类、我的标签、我的笔记
 * - 整理工具：等待分类、批量操作、内容导出、分发中心、链接检测
 * - 学习中心：自习工坊、知识萃取
 * - 洞察中心：数据分析、活动日志、消息通知
 * - 系统：设置、垃圾箱
 */

"use client";

import { useState } from "react";
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
  Share2,
  LinkIcon,
  // 学习中心
  GraduationCap,
  FlaskConical,
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
import { useBrainSyncStats } from "@/hooks/domain/brain-sync";
import { MessageBadge } from "@/components/messages";

// ==================== 类型定义 ====================

interface NavItem {
  name: string;
  href: string;
  icon: typeof BookOpen;
  description?: string;
  isPro?: boolean;
  badge?: "unread" | "brain-sync";
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
    title: "内容中心",
    titleColor: "text-pink-500 dark:text-pink-400",
    activeColor:
      "bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400",
    items: [
      {
        name: "我的收藏",
        href: "/home",
        icon: BookOpen,
        description: "查看所有收藏",
      },
      {
        name: "我的搜索",
        href: "/search",
        icon: Search,
        description: "AI 智能搜索",
      },
      {
        name: "我的分类",
        href: "/folders",
        icon: FolderOpen,
        description: "管理文件夹",
      },
      {
        name: "我的标签",
        href: "/tags",
        icon: Tags,
        description: "标签管理",
      },
      {
        name: "我的笔记",
        href: "/md-collections",
        icon: FileText,
        description: "Markdown 笔记",
        isPro: true,
      },
    ],
  },
  {
    title: "整理工具",
    titleColor: "text-cyan-500 dark:text-cyan-400",
    activeColor:
      "bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400",
    items: [
      {
        name: "等待分类",
        href: "/inbox",
        icon: Inbox,
        description: "未分类内容",
      },
      {
        name: "批量操作",
        href: "/batch",
        icon: CheckSquare,
        description: "批量管理书签",
      },
      {
        name: "内容导出",
        href: "/export",
        icon: Download,
        description: "导出数据",
      },
      {
        name: "分发中心",
        href: "/distribution",
        icon: Share2,
        description: "内容分发",
      },
      {
        name: "链接检测",
        href: "/link-health",
        icon: LinkIcon,
        description: "检测失效链接",
      },
    ],
  },
  {
    title: "学习中心",
    titleColor: "text-purple-500 dark:text-purple-400",
    activeColor:
      "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400",
    items: [
      {
        name: "知识回顾",
        href: "/brain-sync",
        icon: GraduationCap,
        description: "知识复习",
        badge: "brain-sync",
      },
      {
        name: "知识萃取",
        href: "/synthesis",
        icon: FlaskConical,
        description: "主题合成",
      },
    ],
  },
  {
    title: "洞察中心",
    titleColor: "text-rose-500 dark:text-rose-400",
    activeColor:
      "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400",
    items: [
      {
        name: "数据分析",
        href: "/analytics",
        icon: BarChart3,
        description: "查看数据分析",
      },
      {
        name: "活动日志",
        href: "/activity",
        icon: Activity,
        description: "操作历史",
      },
      {
        name: "消息通知",
        href: "/messages",
        icon: Bell,
        description: "系统消息",
        badge: "unread",
      },
    ],
  },
  {
    title: "系统",
    titleColor: "text-slate-400 dark:text-slate-500",
    activeColor:
      "bg-slate-100 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300",
    items: [
      {
        name: "设置",
        href: "/settings",
        icon: Settings,
        description: "应用设置",
      },
      {
        name: "垃圾箱",
        href: "/home?folder=trash",
        icon: Trash2,
        description: "已删除内容",
      },
    ],
  },
];

// ==================== 组件 ====================

export function MobileMenu() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  // 获取未读消息数量
  const { total: unreadCount, important: importantCount } = useUnreadCount();

  // 获取 Brain-Sync 待复习数量
  const { stats: brainSyncStats } = useBrainSyncStats();

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

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="打开菜单"
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
              <Button variant="ghost" size="icon" className="h-8 w-8">
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
                {group.title}
              </p>

              {/* 分组项目 */}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = isLinkActive(item.href);
                  const showUnreadBadge =
                    item.badge === "unread" && unreadCount > 0;
                  const showBrainSyncBadge =
                    item.badge === "brain-sync" &&
                    brainSyncStats &&
                    brainSyncStats.total > 0;
                  const brainSyncCount = brainSyncStats?.total ?? 0;
                  const hasOverdue = (brainSyncStats?.overdue ?? 0) > 0;

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
                            {item.name}
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
                          {showBrainSyncBadge && (
                            <span
                              className={cn(
                                "text-xs font-medium px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
                                hasOverdue
                                  ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
                                  : "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300",
                              )}
                            >
                              {brainSyncCount > 99 ? "99+" : brainSyncCount}
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                            {item.description}
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
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute left-10 h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="ml-6">
              {theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
            </span>
          </Button>

          {/* 版本信息 */}
          <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
            <span>AnyKeep v1.0.0</span>
            <span>智能收藏管理</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
