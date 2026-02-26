/**
 * V4.2.17: 首页工具栏组件
 *
 * Phase 2.5.1 - 从 home-page-client.tsx 提取
 *
 * 职责：移动端顶部工具栏
 * - 平台筛选
 * - 视图/布局/排序菜单
 * - 导入/导出入口
 * - 批量选择入口
 * - 垃圾箱工具栏
 */

"use client";

import { memo } from "react";
import {
  LayoutGrid,
  List,
  ArrowUpDown,
  CheckSquare,
  Upload,
  Download,
  AlignJustify,
  MoreHorizontal,
  Rows3,
  Columns3,
  Sparkles,
  Globe,
  RotateCcw,
  Search,
  Check,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { TrashToolbar } from "@/components/trash/trash-toolbar";
import { HOME_PLATFORMS, SORT_OPTIONS } from "./constants";
import { HomeBatchToolbar } from "./home-batch-toolbar";
import type { ViewMode, LayoutMode } from "./types";

// ============================================================================
// Props 类型定义
// ============================================================================

export interface HomeToolbarProps {
  // 视图模式
  viewMode: ViewMode;
  layoutMode: LayoutMode;
  enableFlipCard: boolean;
  onViewModeChange: (mode: ViewMode) => void;
  onLayoutModeChange: (mode: LayoutMode) => void;
  onFlipCardToggle: () => void;

  // 筛选
  currentPlatform: string;
  currentSort: string;
  onPlatformChange: (platform: string) => void;
  onSortChange: (sort: string) => void;

  // 选择模式
  isSelectionMode: boolean;
  selectedIds: Set<number>;
  totalCount: number;
  isBatchDeleting: boolean;
  isBatchCreatingSnapshot: boolean;
  onToggleSelectionMode: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBatchDelete: () => void;
  onOpenMoveDialog: () => void;
  onBatchCreateSnapshot?: () => void;
  onBatchRestore: () => Promise<void>;
  onEmptyTrash: () => Promise<void>;

  // 对话框
  onOpenImportDialog: () => void;
  onOpenBrowserImportDialog: () => void;
  onOpenExportDialog: () => void;
  onOpenTagDialog?: () => void;

  // 其他
  isBrowserPlatform: boolean;
  isTrashFolder: boolean;
  isSnapshotEnabled: boolean;

  // 菜单状态
  isMobileMoreMenuOpen: boolean;
  onMobileMoreMenuOpenChange: (open: boolean) => void;
}

// ============================================================================
// 组件实现
// ============================================================================

export const HomeToolbar = memo(function HomeToolbar({
  viewMode,
  layoutMode,
  enableFlipCard,
  onViewModeChange,
  onLayoutModeChange,
  onFlipCardToggle,
  currentPlatform,
  currentSort,
  onPlatformChange,
  onSortChange,
  isSelectionMode,
  selectedIds,
  totalCount,
  isBatchDeleting,
  isBatchCreatingSnapshot,
  onToggleSelectionMode,
  onSelectAll,
  onDeselectAll,
  onBatchDelete,
  onOpenMoveDialog,
  onBatchCreateSnapshot,
  onBatchRestore,
  onEmptyTrash,
  onOpenImportDialog,
  onOpenBrowserImportDialog,
  onOpenExportDialog,
  onOpenTagDialog,
  isBrowserPlatform,
  isTrashFolder,
  isSnapshotEnabled,
  isMobileMoreMenuOpen,
  onMobileMoreMenuOpenChange,
}: HomeToolbarProps) {
  const router = useRouter();
  const selectedCount = selectedIds.size;

  return (
    <header className="sm:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 overflow-hidden">
      <div className="flex items-center gap-2 max-w-full">
        {/* 移动端平台筛选 */}
        <div className="flex-1 min-w-0 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-1.5">
            {HOME_PLATFORMS.map((platform) => {
              const isActive = currentPlatform === platform.value;
              return (
                <button
                  key={platform.id}
                  onClick={() => onPlatformChange(platform.value)}
                  className={cn(
                    "px-3 py-1 text-[10px] font-medium rounded-full transition-colors whitespace-nowrap flex-shrink-0",
                    isActive
                      ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700",
                  )}
                >
                  {platform.name}
                </button>
              );
            })}

            {/* 翻转卡片按钮（移动端） */}
            {!isBrowserPlatform && viewMode === "card" && (
              <Button
                variant={enableFlipCard ? "default" : "outline"}
                size="sm"
                onClick={onFlipCardToggle}
                title="翻转卡片"
                className={cn(
                  "px-2.5 py-1 h-auto text-[10px] font-medium rounded-full whitespace-nowrap flex-shrink-0",
                  enableFlipCard
                    ? "bg-purple-500 hover:bg-purple-600 text-white dark:bg-purple-600 dark:hover:bg-purple-700"
                    : "border-gray-200 dark:border-gray-700",
                )}
              >
                <RotateCcw className="size-3 mr-1" />
                翻转
              </Button>
            )}
          </div>
        </div>

        {/* 右侧操作按钮 */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* 搜索按钮 */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => router.push("/search")}
          >
            <Search className="size-4" />
          </Button>

          {/* 统一菜单 */}
          <DropdownMenu
            open={isMobileMoreMenuOpen}
            onOpenChange={onMobileMoreMenuOpenChange}
          >
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {/* 视图模式 */}
              {!isBrowserPlatform && (
                <>
                  <DropdownMenuLabel className="text-xs">
                    视图模式
                  </DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => onViewModeChange("card")}>
                    <LayoutGrid className="size-4 mr-2" />
                    <span className="flex-1">瀑布流</span>
                    {viewMode === "card" && <Check className="size-4" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onViewModeChange("list")}>
                    <List className="size-4 mr-2" />
                    <span className="flex-1">列表</span>
                    {viewMode === "list" && <Check className="size-4" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onViewModeChange("compact")}>
                    <AlignJustify className="size-4 mr-2" />
                    <span className="flex-1">紧凑</span>
                    {viewMode === "compact" && <Check className="size-4" />}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}

              {/* 布局模式（仅卡片视图） */}
              {viewMode === "card" && (
                <>
                  <DropdownMenuLabel className="text-xs">
                    布局模式
                  </DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => onLayoutModeChange("auto")}>
                    <Sparkles className="size-4 mr-2" />
                    <span className="flex-1">自动</span>
                    {layoutMode === "auto" && <Check className="size-4" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onLayoutModeChange("row")}>
                    <Rows3 className="size-4 mr-2" />
                    <span className="flex-1">行优先</span>
                    {layoutMode === "row" && <Check className="size-4" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onLayoutModeChange("column")}
                  >
                    <Columns3 className="size-4 mr-2" />
                    <span className="flex-1">列优先</span>
                    {layoutMode === "column" && <Check className="size-4" />}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}

              {/* 排序 */}
              <DropdownMenuLabel className="text-xs">排序</DropdownMenuLabel>
              {SORT_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => onSortChange(option.value)}
                >
                  <ArrowUpDown className="size-4 mr-2" />
                  <span className="flex-1">{option.label}</span>
                  {currentSort === option.value && <Check className="size-4" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />

              {/* 导入/导出 */}
              <DropdownMenuItem
                onClick={() => {
                  onOpenImportDialog();
                  onMobileMoreMenuOpenChange(false);
                }}
              >
                <Upload className="size-4 mr-2" />
                批量导入
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  onOpenBrowserImportDialog();
                  onMobileMoreMenuOpenChange(false);
                }}
              >
                <Globe className="size-4 mr-2" />
                导入浏览器书签
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  onOpenExportDialog();
                  onMobileMoreMenuOpenChange(false);
                }}
              >
                <Download className="size-4 mr-2" />
                导出
              </DropdownMenuItem>
              <DropdownMenuSeparator />

              {/* 批量选择 */}
              <DropdownMenuItem
                onClick={() => {
                  onToggleSelectionMode();
                  onMobileMoreMenuOpenChange(false);
                }}
              >
                <CheckSquare className="size-4 mr-2" />
                {isSelectionMode ? "取消批量选择" : "批量选择"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 垃圾箱工具栏 */}
      {isTrashFolder && (
        <div className="mt-4">
          <TrashToolbar
            selectedCount={selectedCount}
            onBatchRestore={onBatchRestore}
            onEmptyTrash={onEmptyTrash}
            totalCount={totalCount}
          />
        </div>
      )}

      {/* 批量操作工具栏 */}
      {isSelectionMode && !isTrashFolder && (
        <HomeBatchToolbar
          selectedCount={selectedCount}
          totalCount={totalCount}
          isBatchDeleting={isBatchDeleting}
          isBatchCreatingSnapshot={isBatchCreatingSnapshot}
          isSnapshotEnabled={isSnapshotEnabled}
          onSelectAll={onSelectAll}
          onDeselectAll={onDeselectAll}
          onBatchDelete={onBatchDelete}
          onOpenMoveDialog={onOpenMoveDialog}
          onOpenTagDialog={onOpenTagDialog}
          onOpenExportDialog={onOpenExportDialog}
          onBatchCreateSnapshot={onBatchCreateSnapshot}
        />
      )}
    </header>
  );
});
