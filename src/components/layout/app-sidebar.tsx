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
 *
 * V5.3 性能优化 (2026-02-01):
 * - P2-3.4: 使用 React.memo 避免不必要的重渲染
 *
 * P3 性能优化 (2026-02-05):
 * - 提取 NavItem 为独立 memo 组件，减少父组件重渲染影响
 */

"use client";

import { useCallback, useState, useEffect, memo } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { PanelLeftClose, PanelLeft, Trash2 } from "lucide-react";
import { useUnreadCount } from "@/hooks/data";
import { MessageBadge } from "@/components/messages";
import { cn } from "@/lib/utils";
import { APP_VERSION } from "@/lib/constants/app";
import { useSafeNavigation, type PageId } from "@/contexts/navigation-context";
import { useSafeSidebar, SIDEBAR_WIDTH } from "@/contexts/sidebar-context";
// 国际化
import { useUiText, getNestedValue } from "@/lib/i18n";
import { useDeveloperMode } from "@/hooks/core/use-developer-mode";
import {
  NAV_GROUPS,
  getDesktopItems,
  type NavItemConfig,
} from "@/lib/navigation/nav-config";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ==================== 类型定义 ====================

// 使用统一导航配置的 NavItemConfig 类型
type NavItem = NavItemConfig;

// ==================== 组件 ====================

/**
 * NavItem 导航项组件
 * 使用 memo 优化，仅在 props 变化时重渲染
 */
interface NavItemProps {
  item: NavItem;
  groupColor: GroupColorScheme;
  isNested: boolean;
  isActive: boolean;
  isVisuallyExpanded: boolean;
  displayName: string;
  showUnreadBadge: boolean;
  unreadCount: number;
  importantCount: number;
  onClick: (e: React.MouseEvent) => void;
}

const NavItem = memo(
  function NavItem({
    item,
    groupColor,
    isNested,
    isActive,
    isVisuallyExpanded,
    displayName,
    showUnreadBadge,
    unreadCount,
    importantCount,
    onClick,
  }: NavItemProps) {
    const Icon = item.icon;
    const colors = groupColor;

    const content = (
      <Link
        href={item.href}
        onClick={onClick}
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
            <span className="flex-1 truncate">{displayName}</span>
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
        <Tooltip delayDuration={100}>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            <p>
              {displayName}
              {item.isPro ? " (Pro)" : ""}
            </p>
          </TooltipContent>
        </Tooltip>
      );
    }

    return <div>{content}</div>;
  },
  (prevProps, nextProps) => {
    // 自定义比较函数：只有关键 props 变化时才重渲染
    return (
      prevProps.isActive === nextProps.isActive &&
      prevProps.isVisuallyExpanded === nextProps.isVisuallyExpanded &&
      prevProps.showUnreadBadge === nextProps.showUnreadBadge &&
      prevProps.unreadCount === nextProps.unreadCount &&
      prevProps.importantCount === nextProps.importantCount &&
      prevProps.item === nextProps.item &&
      prevProps.groupColor === nextProps.groupColor
    );
  },
);

// ==================== 导航配置 ====================

// ==================== 导航配置（从统一数据源获取） ====================
// 导航项数据来自 src/lib/navigation/nav-config.ts
// 侧边栏通过 getDesktopItems() 过滤仅桌面端可见的项

// ==================== 糖果色配色 ====================

type GroupColorKey = "content" | "system";

interface GroupColorScheme {
  active: string;
  icon: string;
  hover: string;
}

/**
 * 双色配色方案（糖果粉 + 中性灰）
 * - content: 所有功能分组统一使用糖果粉红色
 * - system: 系统/开发者工具使用中性灰
 */
const groupCandyColors: Record<GroupColorKey, GroupColorScheme> = {
  // 糖果粉红 - 统一用于所有功能导航项
  content: {
    active: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
    icon: "text-pink-500 dark:text-pink-400",
    hover: "hover:bg-gray-100 dark:hover:bg-gray-800",
  },
  // 中性灰 - 系统与工具类
  system: {
    active: "bg-gray-200 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300",
    icon: "text-gray-500 dark:text-gray-400",
    hover: "hover:bg-gray-100 dark:hover:bg-gray-800",
  },
};

// ==================== 组件 ====================

export const AppSidebar = memo(function AppSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentFolder = searchParams?.get("folder") ?? null;

  // 国际化
  const t = useUiText();

  // 开发者模式
  const { isDeveloperMode } = useDeveloperMode();

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
   * 获取翻译文本（支持嵌套键如 "nav.myBookmarks"）
   * 复用 i18n 共享工具函数，消除重复实现
   */
  const getDisplayName = useCallback(
    (key: string): string =>
      getNestedValue<string>(t as unknown as Record<string, unknown>, key) ??
      key,
    [t],
  );

  /**
   * 渲染单个导航项
   * P3 优化: 使用独立的 NavItem memo 组件减少重渲染
   */
  const renderNavItem = (
    item: NavItem,
    groupColor?: GroupColorScheme,
    isNested = false,
  ) => {
    const isActive = isLinkActive(item.href, item.pageId);
    const showUnreadBadge = item.badge === "unread" && unreadCount > 0;
    const displayName = getDisplayName(item.name);
    const colors = groupColor || groupCandyColors.content;

    return (
      <NavItem
        key={item.name}
        item={item}
        groupColor={colors}
        isNested={isNested}
        isActive={isActive}
        isVisuallyExpanded={isVisuallyExpanded}
        displayName={displayName}
        showUnreadBadge={showUnreadBadge}
        unreadCount={unreadCount}
        importantCount={importantCount}
        onClick={(e) => handleNavClick(item.pageId, e)}
      />
    );
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
                    {getDisplayName("mobileMenu.version")}
                  </p>
                </div>
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleToggleClick}
                      className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      aria-label={getDisplayName("mobileMenu.collapseSidebar")}
                    >
                      <PanelLeftClose className="size-4 text-gray-500" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    <p>{getDisplayName("mobileMenu.collapseSidebar")}</p>
                  </TooltipContent>
                </Tooltip>
              </>
            ) : (
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleToggleClick}
                    className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    aria-label={getDisplayName("mobileMenu.expandSidebar")}
                  >
                    <PanelLeft className="size-5 text-gray-500" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  <p>{getDisplayName("mobileMenu.expandSidebar")}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* 主导航区域 - 数据驱动渲染（从统一导航配置） */}
          <nav className="flex-1 space-y-6 overflow-y-auto scrollbar-hide px-2 pb-4">
            {NAV_GROUPS.filter(
              (group) => !group.requireDevMode || isDeveloperMode,
            ).map((group) => {
              const items = getDesktopItems(group);
              if (items.length === 0) return null;

              const colorKey = group.id as GroupColorKey;
              const colors =
                groupCandyColors[colorKey] || groupCandyColors.content;
              const titleColor =
                colorKey === "system"
                  ? "text-gray-400 dark:text-gray-500"
                  : "text-purple-500 dark:text-purple-400";

              return (
                <div key={group.title}>
                  {renderGroupTitle(getDisplayName(group.title), titleColor)}
                  <div className="space-y-1">
                    {items.map((item) => renderNavItem(item, colors))}
                  </div>
                </div>
              );
            })}
          </nav>

          {/* 底部固定区域 */}
          <div className="border-t dark:border-gray-800">
            {/* 垃圾箱 */}
            <div className={cn("px-2 py-2", !isVisuallyExpanded && "px-2")}>
              {renderNavItem(
                {
                  name: "nav.trash",
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
                <p className="px-1 text-xs text-gray-400">
                  AnyKeep v{APP_VERSION}
                </p>
              ) : (
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <p className="text-xs text-gray-400 text-center">v1</p>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    <p>AnyKeep v{APP_VERSION}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
});
