/**
 * 详情页对话框集合
 * V5.7: 从 bookmark-detail-client.tsx 提取，减少主组件模块数
 *
 * 包含：EditBookmarkDialog、MoveToFolderDialog、CreateMonitorDialog、AIAssistantPanel
 * 所有对话框均通过 lazy() 懒加载，仅在用户点击时才加载对应模块
 *
 * @version 1.0.0
 * @since 2026-02-09
 */

"use client";

import { lazy, Suspense } from "react";
import type { Bookmark } from "@/types/supabase";
import type { SourceInfo } from "./source-badge";

// 对话框懒加载
const EditBookmarkDialog = lazy(() =>
  import("@/components/bookmark/edit-bookmark-dialog").then((m) => ({
    default: m.EditBookmarkDialog,
  })),
);
const MoveToFolderDialog = lazy(() =>
  import("@/components/bookmark/move-to-folder-dialog").then((m) => ({
    default: m.MoveToFolderDialog,
  })),
);
const CreateMonitorDialog = lazy(() =>
  import("@/components/monitor").then((m) => ({
    default: m.CreateMonitorDialog,
  })),
);
const AIAssistantPanel = lazy(() =>
  import("@/components/ai").then((m) => ({
    default: m.AIAssistantPanel,
  })),
);

export interface DetailDialogsProps {
  bookmark: Bookmark & {
    folders?: { id: number; name: string } | null;
    source_id?: string | null;
  };
  userId?: string;
  localUserTags: string[] | null;
  sourceInfo: SourceInfo | null;
  // 对话框状态
  showEditDialog: boolean;
  setShowEditDialog: (open: boolean) => void;
  showMoveDialog: boolean;
  setShowMoveDialog: (open: boolean) => void;
  showAIPanel: boolean;
  setShowAIPanel: (open: boolean) => void;
  showMonitorDialog: boolean;
  setShowMonitorDialog: (open: boolean) => void;
}

export function DetailDialogs({
  bookmark,
  userId,
  localUserTags,
  sourceInfo,
  showEditDialog,
  setShowEditDialog,
  showMoveDialog,
  setShowMoveDialog,
  showAIPanel,
  setShowAIPanel,
  showMonitorDialog,
  setShowMonitorDialog,
}: DetailDialogsProps) {
  return (
    <>
      {/* 编辑收藏对话框 */}
      <Suspense fallback={null}>
        <EditBookmarkDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          bookmark={bookmark}
        />
      </Suspense>

      {/* 移动到文件夹对话框 */}
      <Suspense fallback={null}>
        <MoveToFolderDialog
          open={showMoveDialog}
          onOpenChange={setShowMoveDialog}
          bookmark={{
            ...bookmark,
            title: bookmark.title ?? "",
            tags: localUserTags || bookmark.ai_tags || undefined,
            source_id: bookmark.source_id || sourceInfo?.sourceId || undefined,
            source_name:
              bookmark.source_name || sourceInfo?.sourceName || undefined,
          }}
          enableLearning={true}
        />
      </Suspense>

      {/* 创建监控对话框 */}
      {userId && (
        <Suspense fallback={null}>
          <CreateMonitorDialog
            open={showMonitorDialog}
            onOpenChange={setShowMonitorDialog}
            bookmark={{
              id: bookmark.id,
              title: bookmark.title ?? "",
              url: bookmark.url,
            }}
          />
        </Suspense>
      )}

      {/* AI 助手面板 */}
      {userId && (
        <Suspense fallback={null}>
          <AIAssistantPanel
            open={showAIPanel}
            onOpenChange={setShowAIPanel}
            userId={userId}
            bookmarkIds={[bookmark.id]}
            title="AI 知识助手"
            description={`关于「${(bookmark.title ?? "").slice(0, 20)}${bookmark.title && bookmark.title.length > 20 ? "..." : ""}」`}
          />
        </Suspense>
      )}
    </>
  );
}
