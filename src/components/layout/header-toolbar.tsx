/**
 * 首页顶部工具栏
 *
 * 外露高频操作：视图切换 + 排序
 * 响应式：lg+ 显示完整工具栏，md 仅显示排序，sm 隐藏（使用三点菜单）
 */

"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  LayoutGrid,
  List,
  AlignJustify,
  ArrowUpDown,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useHomePageSafe } from "@/contexts/home-page-context";
import { uiEventBus, UIEvents } from "@/lib/shared/event-bus";
import type { ViewMode } from "@/components/home/types";

// 本地存储 key（Fallback 使用）
const VIEW_MODE_STORAGE_KEY = "anykeep-view-mode";

// 排序选项
const sortOptions = [
  { value: "created_desc", label: "最新收藏" },
  { value: "created_asc", label: "最早收藏" },
  { value: "title_asc", label: "标题 A-Z" },
  { value: "title_desc", label: "标题 Z-A" },
];

// 视图选项配置
const viewOptions: {
  value: ViewMode;
  icon: typeof LayoutGrid;
  label: string;
}[] = [
  { value: "card", icon: LayoutGrid, label: "瀑布流" },
  { value: "list", icon: List, label: "列表" },
  { value: "compact", icon: AlignJustify, label: "紧凑" },
];

// Fallback: 从 localStorage 读取视图模式
function getStoredViewMode(): ViewMode {
  if (typeof window === "undefined") return "card";
  const saved = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
  if (saved && ["card", "list", "compact"].includes(saved)) {
    return saved as ViewMode;
  }
  return "card";
}

export function HeaderToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentPlatform = searchParams?.get("platform") || "";
  const currentSort = searchParams?.get("sort") || "created_desc";

  // 获取 HomePageContext（安全版本，不抛错）
  const homeContext = useHomePageSafe();

  // 检测是否为浏览器书签平台
  const isBrowserPlatform = currentPlatform === "browser";

  // 仅在首页显示
  const isHomePage = pathname === "/home";

  // 如果不在首页，不渲染工具栏
  if (!isHomePage) {
    return null;
  }

  // 视图模式：优先从 Context 读取，Fallback 到本地状态
  const viewMode = homeContext?.view.viewMode ?? getStoredViewMode();

  /**
   * 切换视图模式
   * 优先使用 Context，Fallback 到 UIEventBus
   */
  const handleViewModeChange = (mode: string) => {
    if (!mode) return; // ToggleGroup 可能传空字符串
    const typedMode = mode as ViewMode;
    if (homeContext) {
      homeContext.view.setViewMode(typedMode);
    } else {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, typedMode);
      uiEventBus.emit(UIEvents.VIEW_MODE_CHANGE, { mode: typedMode });
    }
  };

  /**
   * 切换排序（使用 URL 参数）
   */
  const handleSortChange = (sortValue: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("sort", sortValue);
    router.push(`/home?${params.toString()}`);
  };

  // 获取当前排序的显示文本
  const currentSortLabel =
    sortOptions.find((opt) => opt.value === currentSort)?.label || "排序";

  return (
    <div className="hidden md:flex items-center gap-1">
      {/* 视图切换 ToggleGroup - 仅 lg+ 且非浏览器平台显示 */}
      {!isBrowserPlatform && (
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={handleViewModeChange}
          className="hidden lg:flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-md p-0.5"
        >
          {viewOptions.map((option) => {
            const Icon = option.icon;
            const isActive = viewMode === option.value;
            return (
              <ToggleGroupItem
                key={option.value}
                value={option.value}
                aria-label={option.label}
                className={`size-7 rounded-sm p-0 data-[state=on]:bg-white dark:data-[state=on]:bg-gray-700 data-[state=on]:shadow-sm transition-colors ${
                  isActive
                    ? "text-pink-600 dark:text-pink-400"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                <Icon className="size-4" />
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      )}

      {/* 排序 Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="排序"
          >
            <ArrowUpDown className="size-3.5" />
            <span className="hidden lg:inline">{currentSortLabel}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          {sortOptions.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handleSortChange(option.value)}
              className="justify-between"
            >
              <span>{option.label}</span>
              {currentSort === option.value && (
                <Check className="size-4 text-pink-500" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
