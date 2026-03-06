/**
 * V4.2.17: 首页对话框组件
 *
 * Phase 2.5.2 - 从 home-page-client.tsx 提取
 *
 * 职责：懒加载所有对话框/抽屉组件
 * - 批量导入对话框
 * - 浏览器书签导入对话框
 * - 导出对话框
 * - 批量移动对话框
 * - 创建收藏抽屉
 */

"use client";

import { lazy, Suspense, useTransition, memo, useRef } from "react";
import { useRouter } from "next/navigation";
import { LazyErrorBoundary } from "@/components/ui/lazy-error-boundary";
import type { BookmarkWithFolder } from "./types";

// 懒加载 Dialog/Drawer 组件（按需显示，非首屏必需）
const CreateBookmarkDrawer = lazy(() =>
  import("@/components/bookmark/create-bookmark-drawer").then((mod) => ({
    default: mod.CreateBookmarkDrawer,
  })),
);
const BatchImportDialog = lazy(() =>
  import("@/components/bookmark/batch-import-dialog").then((mod) => ({
    default: mod.BatchImportDialog,
  })),
);
const BatchMoveDialog = lazy(() =>
  import("@/components/bookmark/batch-move-dialog").then((mod) => ({
    default: mod.BatchMoveDialog,
  })),
);
const ExportDialog = lazy(() =>
  import("@/components/bookmark/export-dialog").then((mod) => ({
    default: mod.ExportDialog,
  })),
);
const BrowserBookmarkImportDialog = lazy(() =>
  import("@/components/browser-bookmark").then((mod) => ({
    default: mod.BrowserBookmarkImportDialog,
  })),
);

// ============================================================================
// Props 类型定义
// ============================================================================

export interface HomeDialogsProps {
  // 对话框状态
  showImportDialog: boolean;
  showBrowserImportDialog: boolean;
  showExportDialog: boolean;
  showMoveDialog: boolean;
  showCreateDialog: boolean;

  // 对话框控制
  setShowImportDialog: (open: boolean) => void;
  setShowBrowserImportDialog: (open: boolean) => void;
  setShowExportDialog: (open: boolean) => void;
  setShowMoveDialog: (open: boolean) => void;
  setShowCreateDialog: (open: boolean) => void;

  // 数据
  bookmarks: BookmarkWithFolder[];
  selectedIds: Set<number>;

  // 回调
  onBookmarkCreated: (bookmark: {
    id: number;
    title: string;
    folder_id?: number | null;
    ai_summary?: string | null;
    ai_tags?: string[] | null;
  }) => void;
  onMoveSuccess: () => void;
}

// ============================================================================
// 组件实现
// ============================================================================

export const HomeDialogs = memo(function HomeDialogs({
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
  onBookmarkCreated,
  onMoveSuccess,
}: HomeDialogsProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // 使用 ref 跟踪对话框是否曾经打开过（避免 useEffect 中 setState 问题）
  // 这是一个有效的用例：我们需要在渲染期间检查和更新 ref，以保持组件挂载状态
  // 从而让 AnimatePresence 能够播放退出动画
  const hasShownCreateRef = useRef(false);

  // 首次打开后标记为已显示，保持组件挂载以支持退出动画
  // eslint-disable-next-line react-hooks/refs
  if (showCreateDialog && !hasShownCreateRef.current) {
    hasShownCreateRef.current = true;
  }

  return (
    <LazyErrorBoundary errorMessage="对话框加载失败" showRetry>
      <Suspense fallback={null}>
        {/* 批量导入对话框（URL导入） */}
        {showImportDialog && (
          <BatchImportDialog
            open={showImportDialog}
            onOpenChange={setShowImportDialog}
          />
        )}

        {/* 浏览器书签导入对话框 */}
        {showBrowserImportDialog && (
          <BrowserBookmarkImportDialog
            open={showBrowserImportDialog}
            onOpenChange={setShowBrowserImportDialog}
            onSuccess={() => {
              startTransition(() => {
                router.refresh();
              });
            }}
          />
        )}

        {/* 导出对话框 */}
        {showExportDialog && (
          <ExportDialog
            open={showExportDialog}
            onOpenChange={setShowExportDialog}
            bookmarks={bookmarks}
            selectedIds={selectedIds}
          />
        )}

        {/* 批量移动对话框 */}
        {showMoveDialog && (
          <BatchMoveDialog
            open={showMoveDialog}
            onOpenChange={setShowMoveDialog}
            selectedIds={selectedIds}
            onSuccess={onMoveSuccess}
          />
        )}

        {/* 创建收藏抽屉 - 使用 ref 保持组件挂载以支持退出动画 */}
        {/* eslint-disable-next-line react-hooks/refs */}
        {hasShownCreateRef.current && (
          <CreateBookmarkDrawer
            open={showCreateDialog}
            onOpenChange={setShowCreateDialog}
            onSuccess={onBookmarkCreated}
          />
        )}
      </Suspense>
    </LazyErrorBoundary>
  );
});
