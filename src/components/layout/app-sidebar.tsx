/**
 * 应用侧边栏 - 分组导航版本
 * 支持折叠/展开、悬停自动展开、锁定功能
 *
 * 导航结构：
 * - 内容中心：我的收藏、我的搜索、我的分类、我的标签、我的笔记
 * - 整理工具：等待分类、智能列表、批量操作、内容导出、整理大师、链接检测
 * - 学习中心：自习工坊、知识萃取
 * - 洞察中心：数据分析、活动日志、消息通知
 * - 系统：设置、开发者工具
 */

"use client";

import { useCallback, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  BookOpen,
  Search,
  FolderOpen,
  Tags,
  FileText,
  Inbox,
  ListFilter,
  CheckSquare,
  Download,
  Wand2,
  LinkIcon,
  GraduationCap,
  FlaskConical,
  BarChart3,
  Activity,
  Bell,
  Settings,
  Wrench,
  Trash2,
  Star,
  AlertCircle,
  Clock,
  BookMarked,
  ChevronRight,
  ChevronDown,
  PanelLeftClose,
  PanelLeft,
  BrainCircuit,
  HeartPulse,
  Sparkles,
} from "lucide-react";
import { useUnreadCount } from "@/hooks/data";
import { MessageBadge } from "@/components/messages";
import { SidebarReminder } from "@/components/brain-sync";
import { cn } from "@/lib/utils";
import { useSafeNavigation, type PageId } from "@/contexts/navigation-context";
import { useSafeSidebar, SIDEBAR_WIDTH } from "@/contexts/sidebar-context";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ==================== 类型定义 ====================

interface NavItem {
  name: string;
  href: string;
  icon: typeof BookOpen;
  pageId?: PageId;
  badge?: number | "unread";
  isPro?: boolean;
}

// 保留接口定义供未来使用
interface _NavGroup {
  title: string;
  titleColor: string;
  items: NavItem[];
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

// ==================== 导航配置 ====================

/**
 * 内容中心导航项
 */
const contentCenterItems: NavItem[] = [
  { name: "我的收藏", href: "/home", icon: BookOpen, pageId: "home" },
  { name: "我的搜索", href: "/search", icon: Search, pageId: "search" },
  { name: "我的分类", href: "/folders", icon: FolderOpen, pageId: "folders" },
  { name: "我的标签", href: "/tags", icon: Tags },
  { name: "我的笔记", href: "/md-collections", icon: FileText, isPro: true },
];

/**
 * 整理工具导航项
 */
const organizeToolsItems: NavItem[] = [
  { name: "等待分类", href: "/inbox", icon: Inbox },
  { name: "批量操作", href: "/batch", icon: CheckSquare, pageId: "batch" },
  { name: "内容导出", href: "/export", icon: Download, pageId: "export" },
  { name: "整理大师", href: "/librarian", icon: Wand2 },
  { name: "链接检测", href: "/link-health", icon: LinkIcon },
];

/**
 * 智能列表配置
 */
const smartListItems: NavItem[] = [
  { name: "全部书签", href: "/home", icon: BookOpen },
  { name: "高价值", href: "/home?folder=high-value", icon: Star },
  { name: "已失效", href: "/home?folder=invalid", icon: AlertCircle },
  { name: "最近添加", href: "/home?folder=recent", icon: Clock },
  { name: "未读内容", href: "/home?folder=unread", icon: BookMarked },
];

/**
 * 学习中心导航项
 */
const learningCenterItems: NavItem[] = [
  { name: "自习工坊", href: "/brain-sync", icon: GraduationCap },
  { name: "知识萃取", href: "/synthesis", icon: FlaskConical },
];

/**
 * 洞察中心导航项
 */
const insightCenterItems: NavItem[] = [
  {
    name: "数据分析",
    href: "/analytics",
    icon: BarChart3,
    pageId: "analytics",
  },
  { name: "活动日志", href: "/activity", icon: Activity },
  {
    name: "消息通知",
    href: "/messages",
    icon: Bell,
    pageId: "messages",
    badge: "unread",
  },
];

/**
 * 开发者工具导航项
 */
const devToolsItems: NavItem[] = [
  { name: "智能分类", href: "/classification-debugger", icon: BrainCircuit },
  {
    name: "分类对比",
    href: "/dev/classification-debugger",
    icon: FlaskConical,
  },
  { name: "文件夹健康", href: "/folder-health", icon: HeartPulse },
  { name: "摘要调试", href: "/debug/ai-summary", icon: Sparkles },
];

// ==================== 组件 ====================

export function AppSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentFolder = searchParams?.get("folder") ?? null;

  // 获取未读消息数量
  const { total: unreadCount, important: importantCount } = useUnreadCount();

  // 安全获取导航上下文
  const navigationContext = useSafeNavigation();
  const { activePage, navigateTo, isClientNavEnabled } = navigationContext || {
    activePage: null,
    navigateTo: null,
    isClientNavEnabled: false,
  };

  // 安全获取侧边栏上下文
  const sidebarContext = useSafeSidebar();

  // 客户端挂载状态 - 用于避免 SSR/CSR hydration 不匹配
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 必要的 SSR 挂载检测模式
    setIsMounted(true);
  }, []);

  // 侧边栏状态
  const {
    isCollapsed = true,
    isLocked = false,
    isVisuallyExpanded: contextVisuallyExpanded = false,
    displayWidth: contextDisplayWidth = SIDEBAR_WIDTH.collapsed,
    lockExpanded,
    unlockAndCollapse,
    handleMouseEnter,
    handleMouseLeave,
  } = sidebarContext || {};

  const isVisuallyExpanded = isMounted ? contextVisuallyExpanded : false;
  const displayWidth = isMounted
    ? contextDisplayWidth
    : SIDEBAR_WIDTH.collapsed;

  // 折叠状态管理
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {
      smartList: false,
      devTools: false,
    },
  );

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  /**
   * 处理导航点击
   */
  const handleNavClick = useCallback(
    (pageId: PageId | undefined, e: React.MouseEvent) => {
      if (pageId && isClientNavEnabled && navigateTo) {
        e.preventDefault();
        navigateTo(pageId);
      }
    },
    [isClientNavEnabled, navigateTo],
  );

  /**
   * 处理折叠/展开按钮点击
   */
  const handleToggleClick = useCallback(() => {
    if (!sidebarContext) return;
    if (isCollapsed || !isLocked) {
      lockExpanded?.();
    } else {
      unlockAndCollapse?.();
    }
  }, [sidebarContext, isCollapsed, isLocked, lockExpanded, unlockAndCollapse]);

  /**
   * 检查链接是否激活
   */
  const isLinkActive = (href: string, pageId?: PageId): boolean => {
    // 如果有 pageId，优先使用客户端导航状态
    if (pageId && isClientNavEnabled && activePage) {
      return activePage === pageId;
    }

    // 处理带参数的 URL
    if (href.includes("?")) {
      const [path, query] = href.split("?");
      if (pathname !== path) return false;
      const params = new URLSearchParams(query);
      const folderParam = params.get("folder");
      return folderParam === currentFolder;
    }

    // 普通路径匹配
    return pathname === href || (pathname?.startsWith(href + "/") ?? false);
  };

  /**
   * 渲染单个导航项
   */
  const renderNavItem = (item: NavItem, isNested = false) => {
    const Icon = item.icon;
    const isActive = isLinkActive(item.href, item.pageId);
    const showBadge = item.badge === "unread" && unreadCount > 0;

    const content = (
      <Link
        href={item.href}
        onClick={(e) => handleNavClick(item.pageId, e)}
        className={cn(
          "group flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150",
          isActive
            ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
            : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/50",
          !isVisuallyExpanded && "justify-center px-2",
          isNested && isVisuallyExpanded && "pl-8",
        )}
      >
        <Icon
          className={cn(
            "size-5 shrink-0 transition-transform duration-150 group-hover:scale-110",
            isActive
              ? "text-blue-600 dark:text-blue-400"
              : "text-gray-400 dark:text-gray-500",
          )}
        />
        {isVisuallyExpanded && (
          <>
            <span className="flex-1 truncate">{item.name}</span>
            {item.isPro && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                Pro
              </span>
            )}
            {showBadge && (
              <MessageBadge
                count={unreadCount}
                hasImportant={importantCount > 0}
              />
            )}
          </>
        )}
      </Link>
    );

    // 折叠时显示 tooltip
    if (!isVisuallyExpanded) {
      return (
        <Tooltip key={item.name} delayDuration={100}>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            <p>
              {item.name}
              {item.isPro ? " (Pro)" : ""}
            </p>
          </TooltipContent>
        </Tooltip>
      );
    }

    return <div key={item.name}>{content}</div>;
  };

  /**
   * 渲染分组标题
   */
  const renderGroupTitle = (title: string, color: string) => {
    if (!isVisuallyExpanded) return null;
    return (
      <div className="px-3 mb-2">
        <p className={cn("text-xs font-semibold uppercase", color)}>{title}</p>
      </div>
    );
  };

  /**
   * 渲染可折叠子菜单
   */
  const renderCollapsibleMenu = (
    id: string,
    title: string,
    icon: typeof BookOpen,
    items: NavItem[],
  ) => {
    const isExpanded = expandedGroups[id];
    const Icon = icon;

    if (!isVisuallyExpanded) {
      return (
        <Tooltip key={id} delayDuration={100}>
          <TooltipTrigger asChild>
            <button
              onClick={() => toggleGroup(id)}
              className="flex items-center justify-center px-2 py-2 w-full text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/50"
            >
              <Icon className="size-5 text-gray-400" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            <p>{title}</p>
          </TooltipContent>
        </Tooltip>
      );
    }

    return (
      <div key={id}>
        <button
          onClick={() => toggleGroup(id)}
          className="flex items-center gap-3 px-3 py-2 w-full text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/50 transition-colors"
        >
          <Icon className="size-5 text-gray-400" />
          <span className="flex-1 text-left">{title}</span>
          {isExpanded ? (
            <ChevronDown className="size-4 text-gray-400" />
          ) : (
            <ChevronRight className="size-4 text-gray-400" />
          )}
        </button>
        {isExpanded && (
          <div className="mt-1 space-y-1">
            {items.map((item) => renderNavItem(item, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <TooltipProvider>
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          width: displayWidth,
          willChange: "width",
          transform: "translateZ(0)",
        }}
        className={cn(
          "fixed left-0 top-[6.25rem] z-40 hidden lg:block h-[calc(100vh-6.25rem)] border-r bg-white dark:bg-gray-950 dark:border-gray-800",
          "transition-[width] duration-200 ease-smooth",
        )}
      >
        <div className="flex flex-col h-full">
          {/* 品牌区域 + 折叠按钮 */}
          <div
            className={cn(
              "flex items-center justify-between p-4",
              !isVisuallyExpanded && "justify-center px-2",
            )}
          >
            {isVisuallyExpanded ? (
              <>
                <div className="px-1">
                  <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                    AnyKeep
                  </h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    智能收藏管理
                  </p>
                </div>
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleToggleClick}
                      className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      aria-label="折叠侧边栏"
                    >
                      <PanelLeftClose className="size-4 text-gray-500" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    <p>折叠侧边栏</p>
                  </TooltipContent>
                </Tooltip>
              </>
            ) : (
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleToggleClick}
                    className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    aria-label="展开侧边栏"
                  >
                    <PanelLeft className="size-5 text-gray-500" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  <p>展开侧边栏</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* 主导航区域 */}
          <nav className="flex-1 space-y-6 overflow-y-auto scrollbar-hide px-2 pb-4">
            {/* 内容中心 */}
            <div>
              {renderGroupTitle("内容中心", "text-blue-500 dark:text-blue-400")}
              <div className="space-y-1">
                {contentCenterItems.map((item) => renderNavItem(item))}
              </div>
            </div>

            {/* 整理工具 */}
            <div>
              {renderGroupTitle(
                "整理工具",
                "text-amber-500 dark:text-amber-400",
              )}
              <div className="space-y-1">
                {/* 待分类 */}
                {renderNavItem(organizeToolsItems[0])}

                {/* 智能列表（可折叠） */}
                {renderCollapsibleMenu(
                  "smartList",
                  "智能列表",
                  ListFilter,
                  smartListItems,
                )}

                {/* 其他整理工具 */}
                {organizeToolsItems.slice(1).map((item) => renderNavItem(item))}
              </div>
            </div>

            {/* 学习中心 */}
            <div>
              {renderGroupTitle(
                "学习中心",
                "text-purple-500 dark:text-purple-400",
              )}
              <div className="space-y-1">
                {learningCenterItems.map((item) => renderNavItem(item))}
                {/* Brain-Sync 复习提醒 */}
                {isVisuallyExpanded ? (
                  <SidebarReminder collapsed={false} className="mx-2" />
                ) : (
                  <SidebarReminder collapsed={true} />
                )}
              </div>
            </div>

            {/* 洞察中心 */}
            <div>
              {renderGroupTitle("洞察中心", "text-rose-500 dark:text-rose-400")}
              <div className="space-y-1">
                {insightCenterItems.map((item) => renderNavItem(item))}
              </div>
            </div>

            {/* 系统 */}
            <div>
              {renderGroupTitle("系统", "text-gray-400 dark:text-gray-500")}
              <div className="space-y-1">
                {renderNavItem({
                  name: "设置",
                  href: "/settings",
                  icon: Settings,
                  pageId: "settings",
                })}

                {/* 开发者工具（可折叠） */}
                {renderCollapsibleMenu(
                  "devTools",
                  "开发者工具",
                  Wrench,
                  devToolsItems,
                )}
              </div>
            </div>
          </nav>

          {/* 底部固定区域 */}
          <div className="border-t dark:border-gray-800">
            {/* 垃圾箱 */}
            <div className={cn("px-2 py-2", !isVisuallyExpanded && "px-2")}>
              {renderNavItem({
                name: "垃圾箱",
                href: "/home?folder=trash",
                icon: Trash2,
              })}
            </div>

            {/* 版本信息 */}
            <div
              className={cn(
                "pt-2 pb-4 border-t dark:border-gray-800",
                isVisuallyExpanded ? "px-4" : "px-2",
              )}
            >
              {isVisuallyExpanded ? (
                <p className="px-1 text-xs text-gray-400">AnyKeep v1.0.0</p>
              ) : (
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <p className="text-xs text-gray-400 text-center">v1</p>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    <p>AnyKeep v1.0.0</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
