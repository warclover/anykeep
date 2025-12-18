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

import { lazy, Suspense, useTransition, memo } from "react";
import { useRouter } from "next/navigation";
import type { Bookmark } from "@/types/supabase";

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

// 扩展的书签类型（包含文件夹信息）
type BookmarkWithFolder = Bookmark & {
  folders?: { name: string } | null;
};

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

  return (
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

      {/* 创建收藏抽屉 */}
      {showCreateDialog && (
        <CreateBookmarkDrawer
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSuccess={onBookmarkCreated}
        />
      )}
    </Suspense>
  );
});
