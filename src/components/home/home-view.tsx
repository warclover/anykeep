/**
 * Phase 3: 首页视图层组件
 *
 * 职责：
 * - 组合 HomeToolbar、HomeContent、HomeDialogs
 * - 使用现有的 Hooks（useHomeMutations、useHomeBatch 等）
 * - 响应 Context 状态变化
 * - 传递回调给子组件
 *
 * @version 3.0.0
 * @since 2026-02-05
 */

"use client";

import {
  useState,
  useCallback,
  useEffect,
  lazy,
  Suspense,
  useMemo,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useHomePageContext } from "@/contexts/home-page-context";
import { useHomeData } from "./providers/home-data-provider";
import { useHomeViewMode } from "./hooks/use-home-view-mode";
import { useHomeMutations } from "./hooks/use-home-mutations";
import { useHomeBatch } from "./hooks/use-home-batch";
import { useDialogs, useSelectionMode } from "@/hooks/core";
import { useClassificationPolling } from "@/hooks/ui";
import { useSynthesisRecommend } from "@/hooks/synthesis/use-synthesis-recommend";
import { uiEventBus, UIEvents } from "@/lib/shared/event-bus";
import { clientLogger } from "@/lib/client-logger";
import { HomeToolbar } from "./home-toolbar";
import { HomeContent } from "./home-content";
import { useSnapshotFeature } from "@/components/snapshot";

// ============================================================================
// 懒加载组件（非首屏关键）
// ============================================================================

const SynthesisConfirmDialog = lazy(() =>
  import("./synthesis-confirm-dialog").then((mod) => ({
    default: mod.SynthesisConfirmDialog,
  })),
);

// V4.2.30: 懒加载 HomeDialogs（包含多个对话框，减少首屏 bundle）
const HomeDialogs = lazy(() =>
  import("./home-dialogs").then((mod) => ({
    default: mod.HomeDialogs,
  })),
);

// V4.2.30: 懒加载 BatchTagDialog（仅批量操作时需要）
const BatchTagDialog = lazy(() =>
  import("@/components/batch/batch-tag-dialog").then((mod) => ({
    default: mod.BatchTagDialog,
  })),
);

// V4.2.30: 懒加��� SynthesisRecommendBubble（AI 功能，可延迟）
const SynthesisRecommendBubble = lazy(() =>
  import("@/components/synthesis/synthesis-recommend-bubble").then((mod) => ({
    default: mod.SynthesisRecommendBubble,
  })),
);

// ============================================================================
// Props 类型定义
// ============================================================================

export interface HomeViewProps {
  /** 初始错误信息 */
  initialError?: string;
  /** 用户设置 */
  userSettings?: { notifications?: { showWelcomeMessage?: boolean } };
}

// ============================================================================
// 主组件实现
// ============================================================================

export function HomeView({ initialError, userSettings }: HomeViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ========== Context 状态 ==========
  const homeContext = useHomePageContext();
  const { bookmarks, refetch, updateCacheItem, removeCacheItem } =
    useHomeData();

  // ========== URL 参数同步 ==========
  const urlPlatform = searchParams?.get("platform") ?? "";
  const urlFolder = searchParams?.get("folder") ?? "";
  const urlSort = searchParams?.get("sort") ?? "created_desc";

  // 同步 URL 参数到 Context（仅首次挂载时）
  useEffect(() => {
    if (urlPlatform && urlPlatform !== homeContext.filter.platform) {
      homeContext.filter.setPlatform(urlPlatform);
    }
    if (urlFolder && urlFolder !== homeContext.filter.folder) {
      homeContext.filter.setFolder(urlFolder);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅首次挂载
  }, []);

  // ========== 视图模式管理 ==========
  const {
    viewMode,
    setViewMode,
    layoutMode,
    setLayoutMode,
    enableFlipCard,
    setEnableFlipCard,
  } = useHomeViewMode({
    isBrowserPlatform: homeContext.filter.isBrowserPlatform,
  });

  // 翻转卡片切换
  const handleFlipCardToggle = useCallback(() => {
    const newValue = !enableFlipCard;
    setEnableFlipCard(newValue);
    uiEventBus.emit(UIEvents.FLIP_CARD_CHANGE, { enabled: newValue });
  }, [enableFlipCard, setEnableFlipCard]);

  // ========== 对话框状态管理 ==========
  const {
    showCreateDialog,
    showImportDialog,
    showBrowserImportDialog,
    showExportDialog,
    showMoveDialog,
    openCreateDialog,
    setShowCreateDialog,
    openImportDialog,
    setShowImportDialog,
    openBrowserImportDialog,
    setShowBrowserImportDialog,
    openExportDialog,
    setShowExportDialog,
    openMoveDialog,
    setShowMoveDialog,
    isMobileMoreMenuOpen,
    setIsMobileMoreMenuOpen,
  } = useDialogs();

  // 批量标签对话框状态
  const [showBatchTagDialog, setShowBatchTagDialog] = useState(false);
  // 综述确认对话框状态
  const [showSynthesisDialog, setShowSynthesisDialog] = useState(false);
  const [isCreatingSynthesis, setIsCreatingSynthesis] = useState(false);

  // 延迟 AI 功能加载
  const [deferredAIReady, setDeferredAIReady] = useState(false);

  // ========== 选择模式管理 ==========
  const {
    isSelectionMode,
    selectedIds,
    isBatchDeleting,
    toggleSelectionMode,
    toggleSelect,
    selectAll,
    deselectAll,
    exitSelectionMode,
  } = useSelectionMode();

  // ========== CRUD 操作 ==========
  const {
    handleDelete,
    handleRestore,
    handlePermanentDelete,
    handleToggleRead,
    handleEdit,
  } = useHomeMutations({
    getBookmarks: () => bookmarks,
    setBookmarks: (_updater) => {
      // 由 SWR 管理，不需要手动设置
      // 乐观更新通过 updateCacheItem 实现
    },
    updateCacheItem,
    removeCacheItem,
  });

  // ========== 批量操作 ==========
  const {
    isBatchCreatingSnapshot,
    handleBatchDelete,
    handleBatchRestore,
    handleBatchCreateSnapshot,
  } = useHomeBatch({
    getBookmarks: () => bookmarks,
    setBookmarks: (_updater) => {
      // 由 SWR 管理
    },
    removeCacheItem,
    selectedIds,
    exitSelectionMode,
  });

  // ========== 综述功能 ==========
  const {
    currentRecommend,
    shouldShowBubble,
    acceptRecommend,
    dismissRecommend,
    closeBubble,
    refresh: refreshSynthesisRecommend,
  } = useSynthesisRecommend({
    autoFetch: false,
    autoShowBubble: true,
  });

  // 延迟触发 AI 功能
  useEffect(() => {
    let idleCallbackId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (typeof window !== "undefined") {
      if ("requestIdleCallback" in window) {
        idleCallbackId = (
          window as Window & {
            requestIdleCallback: (
              cb: () => void,
              opts?: { timeout: number },
            ) => number;
          }
        ).requestIdleCallback(
          () => {
            setDeferredAIReady(true);
            refreshSynthesisRecommend();
          },
          { timeout: 3000 },
        );
      } else {
        timeoutId = setTimeout(() => {
          setDeferredAIReady(true);
          refreshSynthesisRecommend();
        }, 1500);
      }
    }

    return () => {
      if (idleCallbackId !== undefined && "cancelIdleCallback" in window) {
        (
          window as Window & { cancelIdleCallback: (id: number) => void }
        ).cancelIdleCallback(idleCallbackId);
      }
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    };
  }, [refreshSynthesisRecommend]);

  // ========== 分类轮询 ==========
  const { trackBookmark } = useClassificationPolling();

  // ========== Context 事件响应 ==========

  // 响应对话框请求
  useEffect(() => {
    const dialogType = homeContext.dialog.openDialog;
    if (!dialogType) return;

    switch (dialogType) {
      case "create":
        openCreateDialog();
        break;
      case "batchImport":
        openImportDialog();
        break;
      case "browserImport":
        openBrowserImportDialog();
        break;
      case "export":
        openExportDialog();
        break;
      case "batchMove":
        openMoveDialog();
        break;
    }

    homeContext.dialog.closeDialog();
  }, [
    homeContext.dialog,
    openCreateDialog,
    openImportDialog,
    openBrowserImportDialog,
    openExportDialog,
    openMoveDialog,
  ]);

  // 响应选择模式切换
  useEffect(() => {
    const contextSelectionMode = homeContext.selection.isSelectionMode;
    if (contextSelectionMode !== isSelectionMode) {
      toggleSelectionMode();
    }
  }, [
    homeContext.selection.isSelectionMode,
    isSelectionMode,
    toggleSelectionMode,
  ]);

  // ========== 回调函数 ==========

  // 平台切换
  const handlePlatformChange = useCallback(
    (platformValue: string) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      if (platformValue) {
        params.set("platform", platformValue);
      } else {
        params.delete("platform");
      }
      router.replace(`/home?${params.toString()}`);
    },
    [searchParams, router],
  );

  // 排序切换
  const handleSortChange = useCallback(
    (sortValue: string) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("sort", sortValue);
      router.replace(`/home?${params.toString()}`);
    },
    [searchParams, router],
  );

  // 批量移动成功回调
  const handleMoveSuccess = useCallback(() => {
    exitSelectionMode();
    refetch().catch((error) => {
      clientLogger.error({ error }, "Failed to refetch after batch move");
    });
  }, [exitSelectionMode, refetch]);

  // 创建收藏成功回调
  const handleBookmarkCreated = useCallback(
    (bookmark: {
      id: number;
      title: string;
      folder_id?: number | null;
      ai_summary?: string | null;
      ai_tags?: string[] | null;
    }) => {
      if (!bookmark.folder_id) {
        trackBookmark(bookmark.id);
      }
    },
    [trackBookmark],
  );

  // 创建综述
  const handleCreateSynthesis = useCallback(async () => {
    if (selectedIds.size < 3) return;

    setIsCreatingSynthesis(true);
    try {
      const response = await fetch("/api/synthesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: "selection",
          bookmarkIds: Array.from(selectedIds),
          depthMode: "standard",
        }),
      });

      if (!response.ok) {
        throw new Error("创建失败");
      }

      const { data } = await response.json();
      router.push(`/synthesis/${data.id}?generate=true`);
    } catch (error) {
      clientLogger.error({ error }, "Create synthesis error:");
      toast.error("创建综述失败");
    } finally {
      setIsCreatingSynthesis(false);
      setShowSynthesisDialog(false);
    }
  }, [selectedIds, router]);

  // 清空垃圾箱
  const handleEmptyTrash = useCallback(async () => {
    try {
      const res = await fetch("/api/trash/empty", { method: "POST" });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "清空垃圾箱失败");
      }

      refetch();
      toast.success("垃圾箱已清空");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "清空垃圾箱失败");
    }
  }, [refetch]);

  // 重试
  const handleRetry = useCallback(() => {
    router.refresh();
  }, [router]);

  // 全选
  const handleSelectAll = useCallback(() => {
    selectAll(bookmarks.map((b) => b.id));
  }, [bookmarks, selectAll]);

  // ========== 派生值 ==========
  const isSnapshotEnabled = useSnapshotFeature();

  const toolbarProps = useMemo(
    () => ({
      viewMode,
      layoutMode,
      enableFlipCard,
      onViewModeChange: setViewMode,
      onLayoutModeChange: setLayoutMode,
      onFlipCardToggle: handleFlipCardToggle,
      currentPlatform: homeContext.filter.platform,
      currentSort: urlSort,
      onPlatformChange: handlePlatformChange,
      onSortChange: handleSortChange,
      isSelectionMode,
      selectedIds,
      totalCount: bookmarks.length,
      isBatchDeleting,
      isBatchCreatingSnapshot,
      onToggleSelectionMode: toggleSelectionMode,
      onSelectAll: handleSelectAll,
      onDeselectAll: deselectAll,
      onBatchDelete: handleBatchDelete,
      onOpenMoveDialog: openMoveDialog,
      onBatchCreateSnapshot: handleBatchCreateSnapshot,
      onBatchRestore: handleBatchRestore,
      onEmptyTrash: handleEmptyTrash,
      onOpenImportDialog: openImportDialog,
      onOpenBrowserImportDialog: openBrowserImportDialog,
      onOpenExportDialog: openExportDialog,
      onOpenTagDialog: () => setShowBatchTagDialog(true),
      onOpenSynthesisDialog: () => setShowSynthesisDialog(true),
      isBrowserPlatform: homeContext.filter.isBrowserPlatform,
      isTrashFolder: homeContext.filter.isTrashFolder,
      isSnapshotEnabled,
      isMobileMoreMenuOpen,
      onMobileMoreMenuOpenChange: setIsMobileMoreMenuOpen,
    }),
    [
      viewMode,
      layoutMode,
      enableFlipCard,
      setViewMode,
      setLayoutMode,
      handleFlipCardToggle,
      homeContext.filter,
      urlSort,
      handlePlatformChange,
      handleSortChange,
      isSelectionMode,
      selectedIds,
      bookmarks.length,
      isBatchDeleting,
      isBatchCreatingSnapshot,
      toggleSelectionMode,
      handleSelectAll,
      deselectAll,
      handleBatchDelete,
      handleBatchCreateSnapshot,
      handleBatchRestore,
      handleEmptyTrash,
      openImportDialog,
      openBrowserImportDialog,
      openExportDialog,
      openMoveDialog,
      isSnapshotEnabled,
      isMobileMoreMenuOpen,
      setIsMobileMoreMenuOpen,
    ],
  );

  const contentProps = useMemo(
    () => ({
      viewMode,
      layoutMode,
      enableFlipCard,
      onEdit: handleEdit,
      onDelete: handleDelete,
      onRestore: handleRestore,
      onPermanentDelete: handlePermanentDelete,
      onToggleRead: handleToggleRead,
      isSelectionMode,
      selectedIds,
      onToggleSelect: toggleSelect,
      onOpenImportDialog: openBrowserImportDialog,
      userSettings,
      deferredAIReady,
      initialError,
      onRetry: handleRetry,
    }),
    [
      viewMode,
      layoutMode,
      enableFlipCard,
      handleEdit,
      handleDelete,
      handleRestore,
      handlePermanentDelete,
      handleToggleRead,
      isSelectionMode,
      selectedIds,
      toggleSelect,
      openBrowserImportDialog,
      userSettings,
      deferredAIReady,
      initialError,
      handleRetry,
    ],
  );

  const dialogsProps = useMemo(
    () => ({
      showImportDialog,
      showBrowserImportDialog,
      showExportDialog,
      showMoveDialog,
      showCreateDialog,
      setShowImportDialog,
      setShowBrowserImportDialog,
      setShowExportDialog,
      setShowMoveDialog,
      setShowCreateDialog,
      bookmarks,
      selectedIds,
      onBookmarkCreated: handleBookmarkCreated,
      onMoveSuccess: handleMoveSuccess,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setter 函数引用稳定，无需添加依赖
    [
      showImportDialog,
      showBrowserImportDialog,
      showExportDialog,
      showMoveDialog,
      showCreateDialog,
      bookmarks,
      selectedIds,
      handleBookmarkCreated,
      handleMoveSuccess,
    ],
  );

  // ========== 渲染 ==========
  return (
    <div className="flex flex-col h-full min-h-0">
      {/* 工具栏 */}
      <HomeToolbar {...toolbarProps} />

      {/* 内容区 */}
      <HomeContent {...contentProps} />

      {/* 对话框层（V4.2.30: 懒加载） */}
      <Suspense fallback={null}>
        <HomeDialogs {...dialogsProps} />
      </Suspense>

      {/* 批量标签对话框（V4.2.30: 懒加载） */}
      {showBatchTagDialog && (
        <Suspense fallback={null}>
          <BatchTagDialog
            open={showBatchTagDialog}
            onOpenChange={setShowBatchTagDialog}
            selectedIds={Array.from(selectedIds)}
            selectedBookmarks={bookmarks.filter((b) => selectedIds.has(b.id))}
            onSuccess={(result) => {
              result.affectedIds.forEach((id) => {
                updateCacheItem(id, (bookmark) => {
                  if (result.action === "add") {
                    const newTags = [
                      ...new Set([
                        ...(bookmark.user_tags || []),
                        ...result.tags,
                      ]),
                    ];
                    return { ...bookmark, user_tags: newTags };
                  } else {
                    const newTags = (bookmark.user_tags || []).filter(
                      (t) => !result.tags.includes(t),
                    );
                    return { ...bookmark, user_tags: newTags };
                  }
                });
              });
            }}
          />
        </Suspense>
      )}

      {/* 综述确认对话框（懒加载） */}
      {showSynthesisDialog && (
        <Suspense fallback={null}>
          <SynthesisConfirmDialog
            open={showSynthesisDialog}
            onOpenChange={setShowSynthesisDialog}
            selectedCount={selectedIds.size}
            isCreating={isCreatingSynthesis}
            onConfirm={handleCreateSynthesis}
          />
        </Suspense>
      )}

      {/* 综述智能推荐气泡（V4.2.30: 懒加载） */}
      <Suspense fallback={null}>
        <SynthesisRecommendBubble
          recommend={currentRecommend}
          visible={shouldShowBubble}
          onAccept={acceptRecommend}
          onDismiss={dismissRecommend}
          onClose={closeBubble}
        />
      </Suspense>
    </div>
  );
}
