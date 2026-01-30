/**
 * 应用侧边栏 - 分组导航版本
 * 支持折叠/展开、悬停自动展开、锁定功能
 *
 * 导航结构：
 * - 内容中心：我的收藏、我的搜索、我的分类、我的标签、我的笔记
 * - 整理工具：等待分类、智能列表、批量操作、内容导出、整理大师、链接检测
 * - 学习中心：知识回顾、知识萃取、知识工坊
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
  Upload,
  Wand2,
  LinkIcon,
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
  Share2,
  Gauge,
  Zap,
  Volume2,
  Workflow,
} from "lucide-react";
import { useUnreadCount } from "@/hooks/data";
import { MessageBadge } from "@/components/messages";
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
  { name: "我的语音", href: "/audio-library", icon: Volume2 },
];

/**
 * 整理工具导航项
 */
const organizeToolsItems: NavItem[] = [
  { name: "整理中心", href: "/organize", icon: Sparkles },
  { name: "等待分类", href: "/inbox", icon: Inbox },
  { name: "数据导入", href: "/import", icon: Upload },
  { name: "分类管理", href: "/classification-manager", icon: BrainCircuit },
  { name: "批量操作", href: "/batch", icon: CheckSquare, pageId: "batch" },
  { name: "内容导出", href: "/export", icon: Download, pageId: "export" },
  { name: "工作流", href: "/workflows", icon: Workflow },
  { name: "分发中心", href: "/distribution", icon: Share2 },
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
  { name: "学习助手", href: "/learning-hub", icon: BookMarked },
  { name: "知识萃取", href: "/synthesis", icon: FlaskConical },
  {
    name: "知识工坊",
    href: "/knowledge-studio/v2",
    icon: Sparkles,
    isPro: true,
  },
];

/**
 * 洞察中心导航项
 */
const insightCenterItems: NavItem[] = [
  { name: "AI 能力中心", href: "/ai-hub", icon: Zap },
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
  { name: "RAG 监控", href: "/settings/rag-dashboard", icon: Gauge },
  { name: "文件夹健康", href: "/folder-health", icon: HeartPulse },
  { name: "AI 助手调试", href: "/dev/ai-debug", icon: Zap },
];

// ==================== 糖果色配色 ====================

type GroupColorKey = "content" | "organize" | "learning" | "insight" | "system";

interface GroupColorScheme {
  active: string;
  icon: string;
  hover: string;
}

/**
 * 分组糖果色配色方案
 * 每个分组使用独特的颜色，提供视觉区分和愉悦感
 */
const groupCandyColors: Record<GroupColorKey, GroupColorScheme> = {
  // 内容中心 - 粉红色（与首页"手动创建"按钮一致）
  content: {
    active: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
    icon: "text-pink-500 dark:text-pink-400",
    hover: "hover:bg-pink-50 dark:hover:bg-pink-900/20",
  },
  // 整理工具 - 天蓝色（与首页"AI助理"按钮一致）
  organize: {
    active: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
    icon: "text-cyan-500 dark:text-cyan-400",
    hover: "hover:bg-cyan-50 dark:hover:bg-cyan-900/20",
  },
  // 学习中心 - 紫色（智慧与创造的象征）
  learning: {
    active:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    icon: "text-purple-600 dark:text-purple-400",
    hover: "hover:bg-purple-50 dark:hover:bg-purple-900/20",
  },
  // 洞察中心 - 玫瑰色（洞察与发现的象征）
  insight: {
    active: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
    icon: "text-rose-600 dark:text-rose-400",
    hover: "hover:bg-rose-50 dark:hover:bg-rose-900/20",
  },
  // 系统 - 石板灰（稳定与可靠的象征）
  system: {
    active:
      "bg-slate-200 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300",
    icon: "text-slate-600 dark:text-slate-400",
    hover: "hover:bg-slate-100 dark:hover:bg-slate-800/30",
  },
};

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
   * @param item 导航项配置
   * @param groupColor 分组糖果色（可选）
   * @param isNested 是否嵌套项
   */
  const renderNavItem = (
    item: NavItem,
    groupColor?: GroupColorScheme,
    isNested = false,
  ) => {
    const Icon = item.icon;
    const isActive = isLinkActive(item.href, item.pageId);
    const showUnreadBadge = item.badge === "unread" && unreadCount > 0;

    // 使用分组糖果色，如无则回退默认蓝色
    const colors = groupColor || groupCandyColors.content;

    const content = (
      <Link
        href={item.href}
        onClick={(e) => handleNavClick(item.pageId, e)}
        className={cn(
          "group flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150",
          isActive
            ? colors.active
            : cn("text-gray-700 dark:text-gray-300", colors.hover),
          !isVisuallyExpanded && "justify-center px-2",
          isNested && isVisuallyExpanded && "pl-8",
        )}
      >
        <Icon
          className={cn(
            "size-5 shrink-0 transition-transform duration-150 group-hover:scale-110",
            isActive ? colors.icon : "text-gray-400 dark:text-gray-500",
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
            {showUnreadBadge && (
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
        <p className={cn("text-base font-semibold uppercase", color)}>
          {title}
        </p>
      </div>
    );
  };

  /**
   * 渲染可折叠子菜单
   * @param id 菜单ID
   * @param title 菜单标题
   * @param icon 菜单图标
   * @param items 子项列表
   * @param groupColor 分组糖果色
   */
  const renderCollapsibleMenu = (
    id: string,
    title: string,
    icon: typeof BookOpen,
    items: NavItem[],
    groupColor?: GroupColorScheme,
  ) => {
    const isExpanded = expandedGroups[id];
    const Icon = icon;
    const colors = groupColor || groupCandyColors.content;

    if (!isVisuallyExpanded) {
      return (
        <Tooltip key={id} delayDuration={100}>
          <TooltipTrigger asChild>
            <button
              onClick={() => toggleGroup(id)}
              className={cn(
                "flex items-center justify-center px-2 py-2 w-full text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300",
                colors.hover,
              )}
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
          className={cn(
            "flex items-center gap-3 px-3 py-2 w-full text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 transition-colors",
            colors.hover,
          )}
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
            {items.map((item) => renderNavItem(item, groupColor, true))}
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
              {renderGroupTitle("内容中心", "text-pink-500 dark:text-pink-400")}
              <div className="space-y-1">
                {contentCenterItems.map((item) =>
                  renderNavItem(item, groupCandyColors.content),
                )}
              </div>
            </div>

            {/* 整理工具 */}
            <div>
              {renderGroupTitle("整理工具", "text-cyan-500 dark:text-cyan-400")}
              <div className="space-y-1">
                {/* 待分类 */}
                {renderNavItem(
                  organizeToolsItems[0],
                  groupCandyColors.organize,
                )}

                {/* 智能列表（可折叠） */}
                {renderCollapsibleMenu(
                  "smartList",
                  "智能列表",
                  ListFilter,
                  smartListItems,
                  groupCandyColors.organize,
                )}

                {/* 其他整理工具 */}
                {organizeToolsItems
                  .slice(1)
                  .map((item) =>
                    renderNavItem(item, groupCandyColors.organize),
                  )}
              </div>
            </div>

            {/* 学习中心 */}
            <div>
              {renderGroupTitle(
                "学习中心",
                "text-purple-500 dark:text-purple-400",
              )}
              <div className="space-y-1">
                {learningCenterItems.map((item) =>
                  renderNavItem(item, groupCandyColors.learning),
                )}
              </div>
            </div>

            {/* 洞察中心 */}
            <div>
              {renderGroupTitle("洞察中心", "text-rose-500 dark:text-rose-400")}
              <div className="space-y-1">
                {insightCenterItems.map((item) =>
                  renderNavItem(item, groupCandyColors.insight),
                )}
              </div>
            </div>

            {/* 系统 */}
            <div>
              {renderGroupTitle("系统", "text-slate-400 dark:text-slate-500")}
              <div className="space-y-1">
                {renderNavItem(
                  {
                    name: "设置",
                    href: "/settings",
                    icon: Settings,
                    pageId: "settings",
                  },
                  groupCandyColors.system,
                )}

                {/* 开发者工具（可折叠） */}
                {renderCollapsibleMenu(
                  "devTools",
                  "开发者工具",
                  Wrench,
                  devToolsItems,
                  groupCandyColors.system,
                )}
              </div>
            </div>
          </nav>

          {/* 底部固定区域 */}
          <div className="border-t dark:border-gray-800">
            {/* 垃圾箱 */}
            <div className={cn("px-2 py-2", !isVisuallyExpanded && "px-2")}>
              {renderNavItem(
                {
                  name: "垃圾箱",
                  href: "/home?folder=trash",
                  icon: Trash2,
                },
                groupCandyColors.system,
              )}
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
