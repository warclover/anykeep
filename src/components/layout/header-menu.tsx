/**
 * V4.2.17: 顶部导航栏更多菜单
 *
 * Phase 3.1 - 迁移到 HomePageContext
 *
 * 包含视图模式、布局模式、排序、导入导出等功能
 * 优先使用 Context，Fallback 到 Window Event（兼容非首页场景）
 */

"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  MoreHorizontal,
  LayoutGrid,
  List,
  AlignJustify,
  Sparkles,
  Rows3,
  Columns3,
  ArrowUpDown,
  Plus,
  Upload,
  Download,
  Globe,
  CheckSquare,
  Settings,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useHomePageSafe } from "@/contexts/home-page-context";
import { uiEventBus, UIEvents } from "@/lib/shared/event-bus";
import type { ViewMode, LayoutMode, DialogType } from "@/components/home/types";

// 本地存储 key（Fallback 使用）
const VIEW_MODE_STORAGE_KEY = "anykeep-view-mode";
const LAYOUT_MODE_STORAGE_KEY = "anykeep-layout-mode";

// 排序选项
const sortOptions = [
  { value: "created_desc", label: "最新收藏" },
  { value: "created_asc", label: "最早收藏" },
  { value: "title_asc", label: "标题 A-Z" },
  { value: "title_desc", label: "标题 Z-A" },
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

// Fallback: 从 localStorage 读取布局模式
function getStoredLayoutMode(): LayoutMode {
  if (typeof window === "undefined") return "auto";
  const saved = localStorage.getItem(LAYOUT_MODE_STORAGE_KEY);
  if (saved && ["auto", "row", "column"].includes(saved)) {
    return saved as LayoutMode;
  }
  return "auto";
}

export function HeaderMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentPlatform = searchParams?.get("platform") || "";
  const currentSort = searchParams?.get("sort") || "created_desc";

  // Phase 3.1: 尝试获取 HomePageContext（安全版本，不抛错）
  const homeContext = useHomePageSafe();

  // 检测是否为浏览器书签平台
  const isBrowserPlatform = currentPlatform === "browser";

  // 仅在首页显示完整菜单
  const isHomePage = pathname === "/home";

  // 菜单开关状态
  const [isOpen, setIsOpen] = useState(false);

  // Fallback 本地状态（仅在无 Context 时使用）
  const [localViewMode, setLocalViewMode] =
    useState<ViewMode>(getStoredViewMode);
  const [localLayoutMode, setLocalLayoutMode] =
    useState<LayoutMode>(getStoredLayoutMode);

  // 视图模式：优先从 Context 读取，Fallback 到本地状态
  const viewMode = homeContext?.view.viewMode ?? localViewMode;
  const layoutMode = homeContext?.view.layoutMode ?? localLayoutMode;

  // ========== Handler 函数 ==========

  /**
   * 切换视图模式
   * 优先使用 Context，Fallback 到 UIEventBus
   */
  const handleViewModeChange = (mode: ViewMode) => {
    if (homeContext) {
      // Phase 3.1: 使用 Context
      homeContext.view.setViewMode(mode);
    } else {
      // Fallback: UIEventBus（内置 Legacy Bridge 保持兼容）
      setLocalViewMode(mode);
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
      uiEventBus.emit(UIEvents.VIEW_MODE_CHANGE, { mode });
    }
  };

  /**
   * 切换布局模式
   * 优先使用 Context，Fallback 到 UIEventBus
   */
  const handleLayoutModeChange = (mode: LayoutMode) => {
    if (homeContext) {
      // Phase 3.1: 使用 Context
      homeContext.view.setLayoutMode(mode);
    } else {
      // Fallback: UIEventBus（内置 Legacy Bridge 保持兼容）
      setLocalLayoutMode(mode);
      localStorage.setItem(LAYOUT_MODE_STORAGE_KEY, mode);
      uiEventBus.emit(UIEvents.LAYOUT_MODE_CHANGE, { mode });
    }
  };

  /**
   * 切换排序（仍使用 URL 参数，与 Context 无关）
   */
  const handleSortChange = (sortValue: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("sort", sortValue);
    router.push(`/home?${params.toString()}`);
    setIsOpen(false);
  };

  /**
   * 触发对话框
   * 优先使用 Context，Fallback 到 UIEventBus
   */
  const triggerDialog = (dialogType: DialogType) => {
    if (homeContext) {
      // Phase 3.1: 使用 Context
      homeContext.dialog.openDialogAction(dialogType);
    } else {
      // Fallback: UIEventBus（内置 Legacy Bridge 保持兼容）
      uiEventBus.emit(UIEvents.DIALOG_OPEN, { type: dialogType });
    }
    setIsOpen(false);
  };

  /**
   * 切换批量选择模式
   * 优先使用 Context，Fallback 到 UIEventBus
   */
  const triggerSelectionMode = () => {
    if (homeContext) {
      // Phase 3.1: 使用 Context
      homeContext.selection.toggleSelectionMode();
    } else {
      // Fallback: UIEventBus（内置 Legacy Bridge 保持兼容）
      uiEventBus.emit(UIEvents.SELECTION_TOGGLE, { enabled: true });
    }
    setIsOpen(false);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="hidden sm:flex"
          aria-label="更多操作"
        >
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {/* 视图模式（仅首页且非浏览器平台显示） */}
        {isHomePage && !isBrowserPlatform && (
          <>
            <DropdownMenuLabel className="text-xs">视图模式</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => handleViewModeChange("card")}>
              <LayoutGrid className="size-4 mr-2" />
              <span className="flex-1">瀑布流</span>
              {viewMode === "card" && <Check className="size-4" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleViewModeChange("list")}>
              <List className="size-4 mr-2" />
              <span className="flex-1">列表</span>
              {viewMode === "list" && <Check className="size-4" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleViewModeChange("compact")}>
              <AlignJustify className="size-4 mr-2" />
              <span className="flex-1">紧凑</span>
              {viewMode === "compact" && <Check className="size-4" />}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {/* 布局模式（仅首页且卡片视图显示） */}
        {isHomePage && viewMode === "card" && !isBrowserPlatform && (
          <>
            <DropdownMenuLabel className="text-xs">布局模式</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => handleLayoutModeChange("auto")}>
              <Sparkles className="size-4 mr-2" />
              <span className="flex-1">自动</span>
              {layoutMode === "auto" && <Check className="size-4" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleLayoutModeChange("row")}>
              <Rows3 className="size-4 mr-2" />
              <span className="flex-1">行优先</span>
              {layoutMode === "row" && <Check className="size-4" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleLayoutModeChange("column")}>
              <Columns3 className="size-4 mr-2" />
              <span className="flex-1">列优先</span>
              {layoutMode === "column" && <Check className="size-4" />}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {/* 排序（仅首页显示） */}
        {isHomePage && (
          <>
            <DropdownMenuLabel className="text-xs">排序</DropdownMenuLabel>
            {sortOptions.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => handleSortChange(option.value)}
              >
                <ArrowUpDown className="size-4 mr-2" />
                <span className="flex-1">{option.label}</span>
                {currentSort === option.value && <Check className="size-4" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}

        {/* 操作菜单 */}
        {isHomePage && (
          <>
            <DropdownMenuItem onClick={() => triggerDialog("create")}>
              <Plus className="size-4 mr-2" />
              新建收藏
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => triggerDialog("batchImport")}>
              <Upload className="size-4 mr-2" />
              批量导入
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => triggerDialog("browserImport")}>
              <Globe className="size-4 mr-2" />
              导入浏览器书签
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => triggerDialog("export")}>
              <Download className="size-4 mr-2" />
              导出
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={triggerSelectionMode}>
              <CheckSquare className="size-4 mr-2" />
              批量选择
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {/* 设置（始终显示） */}
        <DropdownMenuItem onClick={() => router.push("/settings")}>
          <Settings className="size-4 mr-2" />
          设置
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
