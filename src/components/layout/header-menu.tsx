/**
 * V4.2.18: 顶部导航栏更多菜单（精简版）
 *
 * 收缩后的菜单内容：
 * - 布局模式（仅首页 + 卡片视图 + 非浏览器书签）
 * - 数据导入、导出、批量选择（仅首页）
 * - 设置（始终显示）
 *
 * 高频操作（视图切换、排序）已移至 HeaderToolbar
 */

"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  MoreHorizontal,
  Sparkles,
  Rows3,
  Columns3,
  Upload,
  Download,
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
import type { LayoutMode, DialogType } from "@/components/home/types";

// 本地存储 key（Fallback 使用）
const LAYOUT_MODE_STORAGE_KEY = "anykeep-layout-mode";

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

  // Phase 3.1: 尝试获取 HomePageContext（安全版本，不抛错）
  const homeContext = useHomePageSafe();

  // 检测是否为浏览器书签平台
  const isBrowserPlatform = currentPlatform === "browser";

  // 仅在首页显示完整菜单
  const isHomePage = pathname === "/home";

  // 菜单开关状态
  const [isOpen, setIsOpen] = useState(false);

  // Fallback 本地状态（仅在无 Context 时使用）
  const [localLayoutMode, setLocalLayoutMode] =
    useState<LayoutMode>(getStoredLayoutMode);

  // 视图模式：优先从 Context 读取，Fallback 到本地状态
  const viewMode = homeContext?.view.viewMode ?? "card";
  const layoutMode = homeContext?.view.layoutMode ?? localLayoutMode;

  // ========== Handler 函数 ==========

  /**
   * 切换布局模式
   * 优先使用 Context，Fallback 到 UIEventBus
   */
  const handleLayoutModeChange = (mode: LayoutMode) => {
    if (homeContext) {
      homeContext.view.setLayoutMode(mode);
    } else {
      setLocalLayoutMode(mode);
      localStorage.setItem(LAYOUT_MODE_STORAGE_KEY, mode);
      uiEventBus.emit(UIEvents.LAYOUT_MODE_CHANGE, { mode });
    }
  };

  /**
   * 触发对话框
   * 优先使用 Context，Fallback 到 UIEventBus
   */
  const triggerDialog = (dialogType: DialogType) => {
    if (homeContext) {
      homeContext.dialog.openDialogAction(dialogType);
    } else {
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
      homeContext.selection.toggleSelectionMode();
    } else {
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
      <DropdownMenuContent align="end" className="w-48">
        {/* 布局模式（仅首页且卡片视图且非浏览器平台显示） */}
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

        {/* 操作菜单（仅首页显示） */}
        {isHomePage && (
          <>
            <DropdownMenuItem onClick={() => router.push("/import")}>
              <Upload className="size-4 mr-2" />
              数据导入
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
