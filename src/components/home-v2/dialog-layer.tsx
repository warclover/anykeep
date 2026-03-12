/**
 * Home V2 对话框层
 *
 * 设计原则：
 * - 从 Zustand 订阅 activeDialog（解决 A11：不用 Context + hook 混合模式）
 * - 所有对话框 lazy 加载（从首屏 JS 移除）
 * - 整个组件作为 lazy 入口（Phase 3 优化）
 *
 * @since home-v2
 */

"use client";

import { lazy, Suspense, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useHomeV2Store } from "@/stores/home-v2-store";
import { useHomeV2Data } from "./providers/home-v2-data-provider";
import { useHomeV2CacheOps } from "./providers/home-v2-data-provider";
import { useAbortableFetch } from "@/hooks/core";
import { useClassificationPolling } from "@/hooks/ui";
import { useSynthesisRecommend } from "@/hooks/synthesis/use-synthesis-recommend";
import { API_SYNTHESIS } from "@/lib/constants/api-paths";
import { clientLogger } from "@/lib/client-logger";

// 懒加载对话框组件
const HomeDialogs = lazy(() =>
  import("@/components/home/home-dialogs").then((mod) => ({
    default: mod.HomeDialogs,
  })),
);

const BatchTagDialog = lazy(() =>
  import("@/components/batch/batch-tag-dialog").then((mod) => ({
    default: mod.BatchTagDialog,
  })),
);

const SynthesisConfirmDialog = lazy(() =>
  import("@/components/home/synthesis-confirm-dialog").then((mod) => ({
    default: mod.SynthesisConfirmDialog,
  })),
);

const SynthesisRecommendBubble = lazy(() =>
  import("@/components/synthesis/synthesis-recommend-bubble").then((mod) => ({
    default: mod.SynthesisRecommendBubble,
  })),
);

// ============================================================================
// 组件实现
// ============================================================================

export function HomeV2DialogLayer() {
  const router = useRouter();
  const { fetchWithAbort } = useAbortableFetch();
  const { trackBookmark } = useClassificationPolling();

  // Zustand 状态
  const activeDialog = useHomeV2Store((s) => s.activeDialog);
  const closeDialog = useHomeV2Store((s) => s.closeDialog);
  const selectedIds = useHomeV2Store((s) => s.selectedIds);
  const exitSelectionMode = useHomeV2Store((s) => s.exitSelectionMode);

  // 数据层
  const { bookmarks, refetch } = useHomeV2Data();
  const { updateCacheItem } = useHomeV2CacheOps();

  // 综述创建状态
  const [isCreatingSynthesis, setIsCreatingSynthesis] = useState(false);

  // 综述推荐气泡
  const {
    currentRecommend,
    shouldShowBubble,
    acceptRecommend,
    dismissRecommend,
    closeBubble,
  } = useSynthesisRecommend({
    autoFetch: false,
    autoShowBubble: true,
  });

  // ========== 对话框开关（适配旧组件 setter props） ==========
  const setShowImportDialog = useCallback(
    (open: boolean) => {
      if (open) useHomeV2Store.getState().openDialog("import");
      else closeDialog();
    },
    [closeDialog],
  );

  const setShowBrowserImportDialog = useCallback(
    (open: boolean) => {
      if (open) useHomeV2Store.getState().openDialog("browserImport");
      else closeDialog();
    },
    [closeDialog],
  );

  const setShowExportDialog = useCallback(
    (open: boolean) => {
      if (open) useHomeV2Store.getState().openDialog("export");
      else closeDialog();
    },
    [closeDialog],
  );

  const setShowMoveDialog = useCallback(
    (open: boolean) => {
      if (open) useHomeV2Store.getState().openDialog("move");
      else closeDialog();
    },
    [closeDialog],
  );

  const setShowCreateDialog = useCallback(
    (open: boolean) => {
      if (open) useHomeV2Store.getState().openDialog("create");
      else closeDialog();
    },
    [closeDialog],
  );

  // ========== 回调函数 ==========

  const handleBookmarkCreated = useCallback(
    (bookmark: { id: number; title: string; folder_id?: number | null }) => {
      if (!bookmark.folder_id) {
        trackBookmark(bookmark.id);
      }
    },
    [trackBookmark],
  );

  const handleMoveSuccess = useCallback(() => {
    exitSelectionMode();
    refetch();
  }, [exitSelectionMode, refetch]);

  // 创建综述
  const handleCreateSynthesis = useCallback(async () => {
    if (selectedIds.size < 3) return;

    setIsCreatingSynthesis(true);
    try {
      const response = await fetchWithAbort(API_SYNTHESIS.list, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: "selection",
          bookmarkIds: Array.from(selectedIds),
          depthMode: "standard",
        }),
      });

      if (!response.ok) throw new Error("创建失败");

      const { data } = await response.json();
      setIsCreatingSynthesis(false);
      closeDialog();
      router.push(`/synthesis/${data.id}?generate=true`);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      clientLogger.error({ error }, "Create synthesis error");
      toast.error("创建综述失败");
      setIsCreatingSynthesis(false);
      closeDialog();
    }
  }, [selectedIds, router, fetchWithAbort, closeDialog]);

  // ========== 渲染 ==========

  return (
    <>
      {/* HomeDialogs（旧组件复用 — 创建/导入/导出/移动） */}
      <Suspense fallback={null}>
        <HomeDialogs
          showImportDialog={activeDialog === "import"}
          showBrowserImportDialog={activeDialog === "browserImport"}
          showExportDialog={activeDialog === "export"}
          showMoveDialog={activeDialog === "move"}
          showCreateDialog={activeDialog === "create"}
          setShowImportDialog={setShowImportDialog}
          setShowBrowserImportDialog={setShowBrowserImportDialog}
          setShowExportDialog={setShowExportDialog}
          setShowMoveDialog={setShowMoveDialog}
          setShowCreateDialog={setShowCreateDialog}
          bookmarks={bookmarks}
          selectedIds={selectedIds}
          onBookmarkCreated={handleBookmarkCreated}
          onMoveSuccess={handleMoveSuccess}
        />
      </Suspense>

      {/* 批量标签对话框 */}
      {activeDialog === "batchTag" && (
        <Suspense fallback={null}>
          <BatchTagDialog
            open
            onOpenChange={(open) => {
              if (!open) closeDialog();
            }}
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

      {/* 综述确认对话框 */}
      {activeDialog === "synthesis" && (
        <Suspense fallback={null}>
          <SynthesisConfirmDialog
            open
            onOpenChange={(open) => {
              if (!open) closeDialog();
            }}
            selectedCount={selectedIds.size}
            isCreating={isCreatingSynthesis}
            onConfirm={handleCreateSynthesis}
          />
        </Suspense>
      )}

      {/* 综述推荐气泡（右下角浮动） */}
      <Suspense fallback={null}>
        <SynthesisRecommendBubble
          recommend={currentRecommend}
          visible={shouldShowBubble}
          onAccept={acceptRecommend}
          onDismiss={dismissRecommend}
          onClose={closeBubble}
        />
      </Suspense>
    </>
  );
}
