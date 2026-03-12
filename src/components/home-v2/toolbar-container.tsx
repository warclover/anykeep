/**
 * Home V2 工具栏容器
 *
 * 设计原则：
 * - 唯一的 useSearchParams 调用点（解决 A20）
 * - searchParams 一次解析（解决 A25）
 * - 从 Zustand 读取选择状态（解决 A8：props < 10）
 * - URL 更新回调不依赖数据数组（解决 A1）
 *
 * @since home-v2
 */

"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useHomeV2Store } from "@/stores/home-v2-store";
import { useHomeV2Data } from "./providers/home-v2-data-provider";
import { useHomeV2BatchOps } from "./hooks/use-batch-ops";
import { useSnapshotFeature } from "@/components/snapshot";
import { HomeToolbar } from "@/components/home/home-toolbar";
import { useAbortableFetch } from "@/hooks/core";
import { toast } from "sonner";
import type { ViewMode, LayoutMode } from "@/components/home/types";

// ============================================================================
// Props
// ============================================================================

export interface HomeV2ToolbarContainerProps {
  /** 视图模式 */
  viewMode: ViewMode;
  layoutMode: LayoutMode;
  enableFlipCard: boolean;
  onViewModeChange: (mode: ViewMode) => void;
  onLayoutModeChange: (mode: LayoutMode) => void;
  onFlipCardToggle: () => void;
  /** 是否浏览器平台 */
  isBrowserPlatform: boolean;
  /** 是否垃圾箱 */
  isTrashFolder: boolean;
}

// ============================================================================
// 组件实现
// ============================================================================

export function HomeV2ToolbarContainer({
  viewMode,
  layoutMode,
  enableFlipCard,
  onViewModeChange,
  onLayoutModeChange,
  onFlipCardToggle,
  isBrowserPlatform,
  isTrashFolder,
}: HomeV2ToolbarContainerProps) {
  const router = useRouter();
  const searchParams = useSearchParams(); // A20: 唯一调用点
  const { fetchWithAbort } = useAbortableFetch();

  // A25: 一次性解析所有参数
  const params = useMemo(
    () => ({
      platform: searchParams?.get("platform") ?? "",
      sort: searchParams?.get("sort") ?? "created_desc",
    }),
    [searchParams],
  );

  // Zustand 状态（字段级订阅）
  const isSelectionMode = useHomeV2Store((s) => s.isSelectionMode);
  const selectedIds = useHomeV2Store((s) => s.selectedIds);
  const isBatchDeleting = useHomeV2Store((s) => s.isBatchDeleting);
  const isBatchCreatingSnapshot = useHomeV2Store(
    (s) => s.isBatchCreatingSnapshot,
  );
  const enterSelectionMode = useHomeV2Store((s) => s.enterSelectionMode);
  const exitSelectionMode = useHomeV2Store((s) => s.exitSelectionMode);
  const selectAll = useHomeV2Store((s) => s.selectAll);
  const deselectAll = useHomeV2Store((s) => s.deselectAll);
  const openDialog = useHomeV2Store((s) => s.openDialog);

  // 数据
  const { bookmarks, refetch } = useHomeV2Data();

  // 批量操作
  const { handleBatchDelete, handleBatchRestore, handleBatchCreateSnapshot } =
    useHomeV2BatchOps();

  // 快照功能
  const isSnapshotEnabled = useSnapshotFeature();

  // 移动端菜单
  const [isMobileMoreMenuOpen, setIsMobileMoreMenuOpen] = useState(false);

  // URL 更新回调（稳定引用，不依赖数据数组）
  const handlePlatformChange = useCallback(
    (platform: string) => {
      const p = new URLSearchParams(window.location.search);
      if (platform) {
        p.set("platform", platform);
      } else {
        p.delete("platform");
      }
      router.replace(`/home-v2?${p.toString()}`);
    },
    [router],
  );

  const handleSortChange = useCallback(
    (sort: string) => {
      const p = new URLSearchParams(window.location.search);
      p.set("sort", sort);
      router.replace(`/home-v2?${p.toString()}`);
    },
    [router],
  );

  // 选择模式
  const handleToggleSelectionMode = useCallback(() => {
    if (isSelectionMode) {
      exitSelectionMode();
    } else {
      enterSelectionMode();
    }
  }, [isSelectionMode, exitSelectionMode, enterSelectionMode]);

  const handleSelectAll = useCallback(() => {
    selectAll(bookmarks.map((b) => b.id));
  }, [bookmarks, selectAll]);

  // 清空垃圾箱
  const handleEmptyTrash = useCallback(async () => {
    try {
      const res = await fetchWithAbort("/api/trash/empty", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "清空垃圾箱失败");
      }
      refetch();
      toast.success("垃圾箱已清空");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast.error(error instanceof Error ? error.message : "清空垃圾箱失败");
    }
  }, [fetchWithAbort, refetch]);

  return (
    <HomeToolbar
      viewMode={viewMode}
      layoutMode={layoutMode}
      enableFlipCard={enableFlipCard}
      onViewModeChange={onViewModeChange}
      onLayoutModeChange={onLayoutModeChange}
      onFlipCardToggle={onFlipCardToggle}
      currentPlatform={params.platform}
      currentSort={params.sort}
      onPlatformChange={handlePlatformChange}
      onSortChange={handleSortChange}
      isSelectionMode={isSelectionMode}
      selectedIds={selectedIds}
      totalCount={bookmarks.length}
      isBatchDeleting={isBatchDeleting}
      isBatchCreatingSnapshot={isBatchCreatingSnapshot}
      onToggleSelectionMode={handleToggleSelectionMode}
      onSelectAll={handleSelectAll}
      onDeselectAll={deselectAll}
      onBatchDelete={handleBatchDelete}
      onOpenMoveDialog={() => openDialog("move")}
      onBatchCreateSnapshot={handleBatchCreateSnapshot}
      onBatchRestore={handleBatchRestore}
      onEmptyTrash={handleEmptyTrash}
      onOpenImportDialog={() => openDialog("import")}
      onOpenBrowserImportDialog={() => openDialog("browserImport")}
      onOpenExportDialog={() => openDialog("export")}
      onOpenTagDialog={() => openDialog("batchTag")}
      isBrowserPlatform={isBrowserPlatform}
      isTrashFolder={isTrashFolder}
      isSnapshotEnabled={isSnapshotEnabled}
      isMobileMoreMenuOpen={isMobileMoreMenuOpen}
      onMobileMoreMenuOpenChange={setIsMobileMoreMenuOpen}
    />
  );
}
