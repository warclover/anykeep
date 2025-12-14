/**
 * 顶部导航栏更多菜单
 * 包含视图模式、布局模式、排序、导入导出等功能
 */

"use client";

import { useState, useEffect } from "react";
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

// 本地存储 key
const VIEW_MODE_STORAGE_KEY = "anykeep-view-mode";
const LAYOUT_MODE_STORAGE_KEY = "anykeep-layout-mode";

// 视图模式类型
type ViewMode = "card" | "list" | "compact";

// 布局模式类型
type LayoutMode = "auto" | "row" | "column";

// 排序选项
const sortOptions = [
  { value: "created_desc", label: "最新收藏" },
  { value: "created_asc", label: "最早收藏" },
  { value: "title_asc", label: "标题 A-Z" },
  { value: "title_desc", label: "标题 Z-A" },
];

export function HeaderMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentPlatform = searchParams?.get("platform") || "";
  const currentSort = searchParams?.get("sort") || "created_desc";

  // 检测是否为浏览器书签平台
  const isBrowserPlatform = currentPlatform === "browser";

  // 仅在首页显示完整菜单
  const isHomePage = pathname === "/home";

  // 视图模式和布局模式（使用惰性初始化）
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "card";
    const saved = localStorage.getItem(
      VIEW_MODE_STORAGE_KEY,
    ) as ViewMode | null;
    return saved && ["card", "list", "compact"].includes(saved)
      ? saved
      : "card";
  });
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(() => {
    if (typeof window === "undefined") return "auto";
    const saved = localStorage.getItem(
      LAYOUT_MODE_STORAGE_KEY,
    ) as LayoutMode | null;
    return saved && ["auto", "row", "column"].includes(saved) ? saved : "auto";
  });
  const [isOpen, setIsOpen] = useState(false);

  // 监听外部视图模式变化事件
  useEffect(() => {
    const handleViewModeChange = (event: CustomEvent<ViewMode>) => {
      setViewMode(event.detail);
    };

    window.addEventListener(
      "viewModeChange",
      handleViewModeChange as EventListener,
    );

    return () => {
      window.removeEventListener(
        "viewModeChange",
        handleViewModeChange as EventListener,
      );
    };
  }, []);

  // 切换视图模式
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
    window.dispatchEvent(new CustomEvent("viewModeChange", { detail: mode }));
  };

  // 切换布局模式
  const handleLayoutModeChange = (mode: LayoutMode) => {
    setLayoutMode(mode);
    localStorage.setItem(LAYOUT_MODE_STORAGE_KEY, mode);
    window.dispatchEvent(new CustomEvent("layoutModeChange", { detail: mode }));
  };

  // 切换排序
  const handleSortChange = (sortValue: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("sort", sortValue);
    router.push(`/home?${params.toString()}`);
    setIsOpen(false);
  };

  // 触发对话框事件
  const triggerDialog = (dialogType: string) => {
    window.dispatchEvent(new CustomEvent("openDialog", { detail: dialogType }));
    setIsOpen(false);
  };

  // 切换批量选择模式
  const triggerSelectionMode = () => {
    window.dispatchEvent(new CustomEvent("toggleSelectionMode"));
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
            <DropdownMenuItem onClick={() => triggerDialog("import")}>
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
