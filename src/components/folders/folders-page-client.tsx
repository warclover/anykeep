/**
 * 收藏夹页面客户端组件 (v2.0 重构)
 *
 * 布局结构：
 * - 左侧：文件夹导航面板（树形结构 + 分组/文件夹选择）
 * - 右侧：书签内容列表（显示选中分组/文件夹的书签）
 *
 * 核心变更 (v2.0)：
 * - 右侧从文件夹卡片改为书签列表
 * - 支持分组级别选择（显示分组内所有书签）
 * - 支持单文件夹选择（显示文件夹内书签）
 * - 移除「全部收藏」入口
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Folder, Plus, Menu, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/error-message";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { CreateFolderDialog } from "@/components/folders/create-folder-dialog";
import { FolderNavPanel } from "@/components/folders/folder-nav-panel";
import { FolderBookmarkArea } from "@/components/folders/folder-bookmark-area";
import { FolderDropProvider } from "@/components/folders/folder-drop-context";
import { AIAssistantPanel } from "@/components/ai/ai-assistant-panel";
import {
  UI_GROUP_KEYS,
  groupFolders,
  type UIFolderGroup,
} from "@/components/folders/constants";
import { setFoldersCache, clearFoldersCache } from "@/lib/folder/cache";
import { useFolderBookmarks } from "@/hooks/data/use-folder-bookmarks";
import type {
  FolderWithStats,
  BookmarkWithFolder,
  LockStatusMap,
  FolderSelection,
} from "@/components/folders/types";

// ==================== 组件 Props ====================

interface FoldersPageClientProps {
  folders: FolderWithStats[];
  /** @deprecated 暂未使用，保留接口兼容性 */
  _recentBookmarks?: BookmarkWithFolder[];
  error?: string;
}

// ==================== 工具函数 ====================

/**
 * 获取默认选择状态（第一个非空分组）
 */
function getDefaultSelection(
  folders: FolderWithStats[],
): FolderSelection | null {
  const grouped = groupFolders(folders);

  // 优先选中第一个非空分组
  for (const groupKey of UI_GROUP_KEYS) {
    if (grouped.groups[groupKey].length > 0) {
      return { type: "group", groupId: groupKey };
    }
  }

  // 如果没有分组有文件夹，尝试系统文件夹
  if (grouped.system.length > 0) {
    return { type: "system", folderId: grouped.system[0].id };
  }

  return null;
}

/**
 * 从 URL 参数解析选择状态
 */
function parseSelectionFromUrl(
  searchParams: URLSearchParams,
  folders: FolderWithStats[],
): FolderSelection | null {
  const groupParam = searchParams.get("group");
  const folderIdParam = searchParams.get("id");

  // 分组参数
  if (groupParam && UI_GROUP_KEYS.includes(groupParam as UIFolderGroup)) {
    return { type: "group", groupId: groupParam as UIFolderGroup };
  }

  // 文件夹 ID 参数
  if (folderIdParam) {
    const folderId = parseInt(folderIdParam, 10);
    const folder = folders.find((f) => f.id === folderId);
    if (folder) {
      return folder.is_system
        ? { type: "system", folderId }
        : { type: "folder", folderId };
    }
  }

  return null;
}

// ==================== 主组件 ====================

export function FoldersPageClient({
  folders,
  _recentBookmarks,
  error,
}: FoldersPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ==================== 状态管理 ====================

  // 创建对话框状态
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // 本地文件夹状态（用于乐观更新）
  const [localFolders, setLocalFolders] = useState(folders);

  // 选择状态（v2.0 核心变更）
  const [selection, setSelection] = useState<FolderSelection | null>(() => {
    // 尝试从 URL 解析（searchParams 可能为 null）
    if (searchParams) {
      const urlSelection = parseSelectionFromUrl(searchParams, folders);
      if (urlSelection) return urlSelection;
    }

    // 使用默认选择
    return getDefaultSelection(folders);
  });

  // 移动端导航抽屉状态
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // AI 助手面板状态
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);

  // 锁状态映射
  const [lockStatusMap, setLockStatusMap] = useState<LockStatusMap>(() => {
    const map: LockStatusMap = {};
    for (const folder of folders) {
      if (!folder.is_system) {
        map[folder.id] = {
          isLocked: folder.is_locked ?? false,
          isAiRenamable: !(folder.is_locked ?? false),
        };
      }
    }
    return map;
  });

  // 使用 Hook 获取书签数据
  const {
    bookmarks,
    isLoading: isLoadingBookmarks,
    refresh: refreshBookmarks,
  } = useFolderBookmarks({
    selection,
    folders: localFolders,
    enabled: !!selection,
  });

  // ==================== 同步 folders 到 localFolders ====================
  // 这个 useEffect 用于同步 props 到本地状态，实现乐观更新

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 同步 props 到本地状态
    setLocalFolders(folders);

    // 同步更新锁状态
    const map: LockStatusMap = {};
    for (const folder of folders) {
      if (!folder.is_system) {
        map[folder.id] = {
          isLocked: folder.is_locked ?? false,
          isAiRenamable: !(folder.is_locked ?? false),
        };
      }
    }

    setLockStatusMap(map);

    // 更新 localStorage 缓存
    if (folders.length > 0) {
      setFoldersCache(folders);
    }
  }, [folders]);

  // 当 folders 变化时，检查当前选择是否仍有效
  // 这里的 setState 是必要的 - 用于同步派生状态
  useEffect(() => {
    if (!selection) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 同步派生状态
      setSelection(getDefaultSelection(localFolders));
      return;
    }

    // 验证选择有效性
    if (selection.type === "folder" || selection.type === "system") {
      const exists = localFolders.some((f) => f.id === selection.folderId);
      if (!exists) {
        setSelection(getDefaultSelection(localFolders));
      }
    }
  }, [localFolders, selection]);

  // ==================== 回调函数 ====================

  const handleRetry = () => {
    router.refresh();
  };

  const handleCreateClick = () => {
    setShowCreateDialog(true);
  };

  // 分组选择
  const handleSelectGroup = useCallback((groupId: UIFolderGroup) => {
    setSelection({ type: "group", groupId });
    setIsMobileNavOpen(false);
  }, []);

  // 文件夹选择
  const handleSelectFolder = useCallback(
    (folderId: number) => {
      const folder = localFolders.find((f) => f.id === folderId);
      if (!folder) return;

      setSelection(
        folder.is_system
          ? { type: "system", folderId }
          : { type: "folder", folderId },
      );
      setIsMobileNavOpen(false);
    },
    [localFolders],
  );

  // 系统文件夹选择
  const handleSelectSystem = useCallback((folderId: number) => {
    setSelection({ type: "system", folderId });
    setIsMobileNavOpen(false);
  }, []);

  // 文件夹删除后的乐观更新
  const handleFolderDeleted = useCallback(
    (deletedFolderId: number) => {
      setLocalFolders((prev) => prev.filter((f) => f.id !== deletedFolderId));
      clearFoldersCache();

      // 如果删除的是当前选中的文件夹，切换到默认选择
      if (
        selection &&
        (selection.type === "folder" || selection.type === "system") &&
        selection.folderId === deletedFolderId
      ) {
        const remaining = localFolders.filter((f) => f.id !== deletedFolderId);
        setSelection(getDefaultSelection(remaining));
      }

      router.refresh();
    },
    [router, selection, localFolders],
  );

  // 文件夹重命名后的乐观更新
  const handleFolderRenamed = useCallback(
    (folderId: number, newName: string) => {
      setLocalFolders((prev) =>
        prev.map((f) => (f.id === folderId ? { ...f, name: newName } : f)),
      );
      clearFoldersCache();
    },
    [],
  );

  // 文件夹合并后的乐观更新
  const handleFolderMerged = useCallback(
    (sourceFolderId: number, targetFolderId: number, movedCount: number) => {
      setLocalFolders((prev) =>
        prev
          .filter((f) => f.id !== sourceFolderId)
          .map((f) =>
            f.id === targetFolderId
              ? { ...f, bookmark_count: (f.bookmark_count || 0) + movedCount }
              : f,
          ),
      );
      clearFoldersCache();
      refreshBookmarks();
    },
    [refreshBookmarks],
  );

  // 书签操作回调
  const handleEditBookmark = useCallback((_id: number) => {
    // TODO: 打开编辑对话框
  }, []);

  const handleDeleteBookmark = useCallback(async (_id: number) => {
    // TODO: 实现删除逻辑
  }, []);

  const handleToggleRead = useCallback((_id: number, _isRead: boolean) => {
    // TODO: 实现切换已读
  }, []);

  const handleToggleStarred = useCallback(
    (_id: number, _isStarred: boolean) => {
      // TODO: 实现切换星标
    },
    [],
  );

  // ==================== 渲染 ====================

  // 错误状态
  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <ErrorMessage message={error} retry={handleRetry} />
      </div>
    );
  }

  // 空状态 - 无文件夹
  if (localFolders.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <Folder className="size-10 text-primary" />
        </div>
        <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
          开始整理你的收藏
        </h3>
        <p className="text-muted-foreground text-center max-w-sm mb-6">
          创建文件夹来分类管理你的收藏内容，让知识更有条理
        </p>
        <Button size="lg" onClick={handleCreateClick}>
          <Plus className="size-5 mr-2" />
          创建第一个文件夹
        </Button>

        <CreateFolderDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          folders={localFolders}
        />
      </div>
    );
  }

  // 导航面板组件
  const navPanel = (
    <FolderNavPanel
      folders={localFolders}
      selection={selection}
      onSelectGroup={handleSelectGroup}
      onSelectFolder={handleSelectFolder}
      onSelectSystem={handleSelectSystem}
      onCreateFolder={handleCreateClick}
      onFolderDeleted={handleFolderDeleted}
      onFolderRenamed={handleFolderRenamed}
      onFolderMerged={handleFolderMerged}
      lockStatusMap={lockStatusMap}
      className="h-full"
    />
  );

  return (
    <FolderDropProvider onMoveSuccess={refreshBookmarks}>
      <div className="h-full flex overflow-hidden">
        {/* 桌面端：左侧导航面板 */}
        <aside className="hidden lg:block w-[280px] flex-shrink-0 border-r border-gray-200 dark:border-gray-800 overflow-hidden">
          {navPanel}
        </aside>

        {/* 移动端：导航抽屉 */}
        <Sheet open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
          <SheetContent side="left" className="p-0 w-[300px]">
            {navPanel}
          </SheetContent>
        </Sheet>

        {/* 右侧内容区域 */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* 移动端顶部栏 */}
          <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileNavOpen(true)}
            >
              <Menu className="size-5" />
            </Button>
            <h1 className="text-lg font-semibold flex-1">收藏夹</h1>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAIAssistantOpen(true)}
              className="gap-1.5 text-violet-600 border-violet-200 hover:bg-violet-50 hover:border-violet-300 dark:text-violet-400 dark:border-violet-800 dark:hover:bg-violet-950"
            >
              <Sparkles className="size-4" />
              <span className="hidden sm:inline">AI 助手</span>
            </Button>
          </div>

          {/* 书签内容区域 */}
          {selection && (
            <FolderBookmarkArea
              selection={selection}
              folders={localFolders}
              bookmarks={bookmarks}
              isLoading={isLoadingBookmarks}
              onOpenAIAssistant={() => setIsAIAssistantOpen(true)}
              onEditBookmark={handleEditBookmark}
              onDeleteBookmark={handleDeleteBookmark}
              onToggleRead={handleToggleRead}
              onToggleStarred={handleToggleStarred}
              className="flex-1"
            />
          )}
        </main>

        {/* 创建文件夹对话框 */}
        <CreateFolderDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          folders={localFolders}
        />

        {/* AI 助手面板 */}
        <AIAssistantPanel
          open={isAIAssistantOpen}
          onOpenChange={setIsAIAssistantOpen}
          title="AI 文件夹助手"
        />
      </div>
    </FolderDropProvider>
  );
}
