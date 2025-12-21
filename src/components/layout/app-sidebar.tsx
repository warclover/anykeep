/**
 * 应用侧边栏 - 可折叠版本
 * 支持折叠/展开、悬停自动展开、锁定功能
 */

"use client";

import { useCallback, useState, useEffect } from "react";
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
  Inbox,
  Sparkles,
  Bell,
  BrainCircuit,
  FlaskConical,
  FileText,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  CheckSquare,
  Download,
} from "lucide-react";
import { useUnreadCount } from "@/hooks/use-unread-count";
import { MessageBadge } from "@/components/messages";
import { SmartListDropdown } from "@/components/smart-list";
import { cn } from "@/lib/utils";
import {
  useSafeNavigation,
  type PageId,
  PAGE_ROUTES,
} from "@/contexts/navigation-context";
import { useSafeSidebar, SIDEBAR_WIDTH } from "@/contexts/sidebar-context";
import { NAV_ICON_COLORS, NAV_ACTIVE_STYLES } from "@/lib/constants/app";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// 主导航配置
const navigation: {
  name: string;
  pageId: PageId;
  icon: typeof Home;
  colorKey: keyof typeof NAV_ICON_COLORS;
  showBadge?: boolean;
}[] = [
  { name: "首页", pageId: "home", icon: Home, colorKey: "home" },
  { name: "搜索", pageId: "search", icon: Search, colorKey: "search" },
  { name: "收藏夹", pageId: "folders", icon: Folder, colorKey: "folders" },
  {
    name: "消息",
    pageId: "messages",
    icon: Bell,
    colorKey: "messages",
    showBadge: true,
  },
  { name: "数据", pageId: "analytics", icon: BarChart3, colorKey: "analytics" },
  { name: "批量", pageId: "batch", icon: CheckSquare, colorKey: "batch" },
  { name: "导出", pageId: "export", icon: Download, colorKey: "export" },
  { name: "设置", pageId: "settings", icon: Settings, colorKey: "settings" },
];

// 系统文件夹（虚拟）
const systemFolders = [
  { name: "高价值", param: "high-value", icon: Star },
  { name: "已失效", param: "invalid", icon: AlertCircle },
  { name: "垃圾箱", param: "trash", icon: Trash2 },
];

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
  // 注意：默认值必须与 SidebarProvider 的初始状态一致，避免 hydration 不匹配
  const sidebarContext = useSafeSidebar();

  // 客户端挂载状态 - 防止 hydration 不匹配
  // 首次渲染使用默认值（与服务端一致），挂载后使用实际值
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 必须用于 hydration 同步
    setIsMounted(true);
  }, []);

  // 在客户端挂载前使用默认值，确保与服务端渲染一致
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

  // hydration 安全：首次渲染使用默认值
  const isVisuallyExpanded = isMounted ? contextVisuallyExpanded : false;
  const displayWidth = isMounted
    ? contextDisplayWidth
    : SIDEBAR_WIDTH.collapsed;

  // 折叠状态（子菜单）
  const [isSystemFoldersExpanded, setIsSystemFoldersExpanded] = useState(false);
  const [isDevToolsExpanded, setIsDevToolsExpanded] = useState(false);

  /**
   * 处理主导航点击
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
   * 处理系统文件夹点击
   */
  const handleSystemFolderClick = useCallback(
    (folderParam: string, e: React.MouseEvent) => {
      if (isClientNavEnabled && navigateTo) {
        e.preventDefault();
        navigateTo("home", { folder: folderParam });
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
      // 当前折叠或未锁定 -> 锁定展开
      lockExpanded?.();
    } else {
      // 当前展开且已锁定 -> 解锁并折叠
      unlockAndCollapse?.();
    }
  }, [sidebarContext, isCollapsed, isLocked, lockExpanded, unlockAndCollapse]);

  // 导航项渲染函数
  const renderNavItem = (
    item: (typeof navigation)[0],
    isActive: boolean,
    onClick: (e: React.MouseEvent) => void,
  ) => {
    const Icon = item.icon;
    // 防御性检查：确保 href 永不为 undefined
    const href = PAGE_ROUTES[item.pageId] ?? "/home";
    const iconColor = NAV_ICON_COLORS[item.colorKey] ?? NAV_ICON_COLORS.home;
    const activeStyles = NAV_ACTIVE_STYLES.default;

    const content = (
      <Link
        href={href}
        onClick={onClick}
        className={cn(
          "group flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150",
          isActive
            ? cn(activeStyles.light, activeStyles.dark)
            : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/50",
          !isVisuallyExpanded && "justify-center px-2",
        )}
      >
        <Icon
          className={cn(
            "size-5 shrink-0 transition-transform duration-150 group-hover:scale-110",
            // 激活时图标保持对应颜色，非激活时显示彩色
            isActive ? "" : cn(iconColor.light, iconColor.dark),
          )}
        />
        {isVisuallyExpanded && (
          <>
            <span className="flex-1 truncate">{item.name}</span>
            {item.showBadge && (
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
            <p>{item.name}</p>
          </TooltipContent>
        </Tooltip>
      );
    }

    return <div key={item.name}>{content}</div>;
  };

  return (
    <TooltipProvider>
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          width: displayWidth,
          willChange: "width", // GPU 优化提示
          transform: "translateZ(0)", // 触发 GPU 层
        }}
        className={cn(
          "fixed left-0 top-14 z-40 hidden lg:block h-[calc(100vh-3.5rem)] border-r bg-white dark:bg-gray-950 dark:border-gray-800",
          "transition-[width] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]",
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
                      aria-label={isLocked ? "折叠侧边栏" : "锁定展开"}
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

          {/* 主导航 */}
          <nav className="flex-1 space-y-4 overflow-y-auto scrollbar-hide px-2">
            <div className="space-y-1">
              {navigation.map((item) => {
                // 防御性检查：确保 href 永不为 undefined
                const href = PAGE_ROUTES[item.pageId] ?? "/home";
                const isActive = isClientNavEnabled
                  ? activePage === item.pageId
                  : pathname === href ||
                    (pathname?.startsWith(href + "/") ?? false);

                return renderNavItem(item, isActive, (e) =>
                  handleNavClick(item.pageId, e),
                );
              })}
            </div>

            {/* 内容收藏 (Pro) */}
            {isVisuallyExpanded ? (
              <div>
                <div className="px-3 mb-2">
                  <p className="text-xs font-semibold text-emerald-500 dark:text-emerald-400 uppercase">
                    内容收藏
                  </p>
                </div>
                <div className="space-y-1">
                  <Link
                    href="/md-collections"
                    prefetch={true}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                      pathname === "/md-collections" ||
                        pathname?.startsWith("/md-collections/")
                        ? "bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 dark:from-emerald-900/30 dark:to-teal-900/30 dark:text-emerald-400"
                        : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/50",
                    )}
                  >
                    <FileText className="size-5" />
                    <span className="flex-1 whitespace-nowrap">MD 收藏</span>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                      Pro
                    </span>
                  </Link>
                </div>
              </div>
            ) : (
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <Link
                    href="/md-collections"
                    prefetch={true}
                    className={cn(
                      "flex items-center justify-center px-2 py-2 text-sm font-medium rounded-lg transition-colors",
                      pathname === "/md-collections" ||
                        pathname?.startsWith("/md-collections/")
                        ? "bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 dark:from-emerald-900/30 dark:to-teal-900/30 dark:text-emerald-400"
                        : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/50",
                    )}
                  >
                    <FileText className="size-5" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  <p>MD 收藏 (Pro)</p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* 智能列表下拉选择器 - 仅展开时显示 */}
            {isVisuallyExpanded && <SmartListDropdown />}

            {/* 系统文件夹（可折叠）- 仅展开时显示 */}
            {isVisuallyExpanded && (
              <div>
                <button
                  onClick={() =>
                    setIsSystemFoldersExpanded(!isSystemFoldersExpanded)
                  }
                  className="flex items-center justify-between w-full px-3 mb-2 group"
                >
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase">
                    系统文件夹
                  </p>
                  <ChevronRight
                    className={cn(
                      "size-3.5 text-gray-400 transition-transform duration-200",
                      isSystemFoldersExpanded && "rotate-90",
                    )}
                  />
                </button>
                {isSystemFoldersExpanded && (
                  <div className="space-y-1">
                    <Link
                      href="/inbox"
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                        pathname === "/inbox"
                          ? "bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 dark:from-amber-900/30 dark:to-orange-900/30 dark:text-amber-400"
                          : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/50",
                      )}
                    >
                      <Inbox className="size-5" />
                      待整理
                    </Link>
                    {systemFolders.map((item) => {
                      const Icon = item.icon;
                      const href = `/home?folder=${item.param}`;
                      const isActive = currentFolder === item.param;

                      return (
                        <Link
                          key={item.name}
                          href={href}
                          onClick={(e) =>
                            handleSystemFolderClick(item.param, e)
                          }
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
                )}
              </div>
            )}

            {/* 开发者工具（可折叠）- 仅展开时显示 */}
            {isVisuallyExpanded && (
              <div>
                <button
                  onClick={() => setIsDevToolsExpanded(!isDevToolsExpanded)}
                  className="flex items-center justify-between w-full px-3 mb-2 group"
                >
                  <p className="text-xs font-semibold text-purple-400 dark:text-purple-500 uppercase">
                    开发者工具
                  </p>
                  <ChevronRight
                    className={cn(
                      "size-3.5 text-purple-400 transition-transform duration-200",
                      isDevToolsExpanded && "rotate-90",
                    )}
                  />
                </button>
                {isDevToolsExpanded && (
                  <div className="space-y-1">
                    <Link
                      href="/classification-debugger"
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                        pathname === "/classification-debugger"
                          ? "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                          : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/50",
                      )}
                    >
                      <BrainCircuit className="size-5" />
                      智能分类
                    </Link>
                    <Link
                      href="/dev/classification-debugger"
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                        pathname === "/dev/classification-debugger"
                          ? "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                          : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/50",
                      )}
                    >
                      <FlaskConical className="size-5" />
                      分类对比
                    </Link>
                    {process.env.NODE_ENV === "development" && (
                      <Link
                        href="/debug/ai-summary"
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                          pathname === "/debug/ai-summary"
                            ? "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                            : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/50",
                        )}
                      >
                        <Sparkles className="size-5" />
                        摘要调试
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* 底部信息 */}
          <div
            className={cn(
              "pt-4 border-t dark:border-gray-800",
              isVisuallyExpanded ? "px-4 pb-4" : "px-2 pb-4",
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
      </aside>
    </TooltipProvider>
  );
}
