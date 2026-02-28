/**
 * Folders 页面工具栏
 *
 * 显示在 AppHeader 下方的整页第二行（全宽）
 * 包含：图标 + 标题 + 统计 + 提示 + 搜索 + 排序 + 视图 + AI助手
 */

"use client";

import {
  Search,
  SortAsc,
  LayoutGrid,
  List,
  ListCollapse,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ==================== 类型定义 ====================

interface SelectionInfo {
  title: string;
  titleEmoji: string | null;
  icon: typeof LayoutGrid;
  colors: { gradient: { from: string; to: string } };
  categoryColor: string | null;
}

export type SortOption = "created" | "title" | "updated";
export type ViewMode = "card" | "list" | "compact";

interface FolderPageToolbarProps {
  selectionInfo: SelectionInfo;
  filteredBookmarkCount: number;
  isLoading: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  sortBy: SortOption;
  setSortBy: (s: SortOption) => void;
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  onOpenAIAssistant?: () => void;
  className?: string;
}

// ==================== 配置 ====================

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "created", label: "添加时间" },
  { value: "title", label: "标题" },
  { value: "updated", label: "更新时间" },
];

const VIEW_OPTIONS: {
  value: ViewMode;
  label: string;
  icon: typeof LayoutGrid;
}[] = [
  { value: "card", label: "卡片", icon: LayoutGrid },
  { value: "list", label: "列表", icon: List },
  { value: "compact", label: "紧凑", icon: ListCollapse },
];

// ==================== 主组件 ====================

export function FolderPageToolbar({
  selectionInfo,
  filteredBookmarkCount,
  isLoading,
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  viewMode,
  setViewMode,
  onOpenAIAssistant,
  className,
}: FolderPageToolbarProps) {
  const SelectionIcon = selectionInfo.icon;

  return (
    <div className={cn("px-4 lg:px-6 h-full flex items-center", className)}>
      <div className="flex items-center gap-3 w-full">
        {/* 左侧：图标+标题 | 统计；第二行提示与统计左对齐，整体上下居中 */}
        <div className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 items-center content-center self-center">
          <div className="flex items-center gap-3 self-center">
            {selectionInfo.titleEmoji ? (
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: selectionInfo.categoryColor
                    ? `${selectionInfo.categoryColor}20`
                    : undefined,
                }}
              >
                <span className="text-sm">{selectionInfo.titleEmoji}</span>
              </div>
            ) : (
              <div
                className={cn(
                  "w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0",
                  `bg-gradient-to-br ${selectionInfo.colors.gradient.from} ${selectionInfo.colors.gradient.to}`,
                )}
              >
                <SelectionIcon className="size-3 text-white" />
              </div>
            )}
            <h2
              className="text-base font-semibold whitespace-nowrap"
              style={{ color: selectionInfo.categoryColor || undefined }}
            >
              {selectionInfo.title}
            </h2>
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {isLoading ? (
              <span className="flex items-center gap-1">
                <Loader2 className="size-3 animate-spin" />
                加载中...
              </span>
            ) : (
              `${filteredBookmarkCount} 条收藏`
            )}
          </span>
          {/* 提示文本（桌面端）：第二行与「X 条收藏」左对齐 */}
          <div className="hidden lg:block" />
          <span className="hidden lg:inline text-xs text-muted-foreground">
            拖拽收藏到左侧文件夹可快速分类
          </span>
        </div>

        {/* 右侧：搜索框 + 工具栏 */}
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          {/* 搜索框 */}
          <div className="relative w-32 lg:w-40">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
            <Input
              placeholder="搜索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 h-7 text-xs"
            />
          </div>

          {/* 排序 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 px-2">
                <SortAsc className="size-3 mr-1" />
                <span className="hidden sm:inline text-xs">
                  {SORT_OPTIONS.find((o) => o.value === sortBy)?.label}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {SORT_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => setSortBy(option.value)}
                  className={sortBy === option.value ? "bg-accent" : ""}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 视图切换 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 px-2">
                {(() => {
                  const Icon =
                    VIEW_OPTIONS.find((o) => o.value === viewMode)?.icon ||
                    LayoutGrid;
                  return <Icon className="size-3 mr-1" />;
                })()}
                <span className="hidden sm:inline text-xs">视图</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {VIEW_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => setViewMode(option.value)}
                  className={viewMode === option.value ? "bg-accent" : ""}
                >
                  <option.icon className="size-3 mr-2" />
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* AI 助手 */}
          {onOpenAIAssistant && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenAIAssistant}
              className="hidden lg:flex h-7 px-2 text-xs"
            >
              AI 助手
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
