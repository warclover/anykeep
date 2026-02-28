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
import { FeatureErrorBoundary } from "@/components/error-boundary/feature-error-boundary";
import { CreateFolderDialog } from "@/components/folders/create-folder-dialog";
import { CreateCategoryDialog } from "@/components/folders/create-category-dialog";
import { FolderNavPanel } from "@/components/folders/folder-nav-panel";
import { FolderBookmarkArea } from "@/components/folders/folder-bookmark-area";
import { FolderDropProvider } from "@/components/folders/folder-drop-context";
import { AIAssistantPanel } from "@/components/ai/ai-assistant-panel";
import { setFoldersCache, clearFoldersCache } from "@/lib/folder/cache";
import { useFolderBookmarks } from "@/hooks/data/use-folder-bookmarks";
import { useBookmarkActions } from "@/hooks/domain/bookmark/use-bookmark-actions";
import type {
  FolderWithStats,
  FolderCategory,
  BookmarkWithFolder,
  LockStatusMap,
  FolderSelection,
} from "@/components/folders/types";
import type { Folder as FolderType } from "@/types/supabase";
import { useUser } from "@/contexts/user-context";

// ==================== 组件 Props ====================

interface FoldersPageClientProps {
  folders: FolderWithStats[];
  categories?: FolderCategory[];
  /** @deprecated 暂未使用，保留接口兼容性 */
  recentBookmarks?: BookmarkWithFolder[];
  error?: string;
}

// ==================== 工具函数 ====================

/**
 * 获取默认选择状态（第一个有文件夹的栏目，或系统文件夹）
 */
function getDefaultSelection(
  folders: FolderWithStats[],
  categories: FolderCategory[],
): FolderSelection | null {
  // 优先选中第一个有文件夹的栏目
  for (const cat of categories) {
    const hasFolder = folders.some(
      (f) => !f.is_archived && !f.is_system && f.category_id === cat.id,
    );
    if (hasFolder) {
      return { type: "category", categoryId: cat.id };
    }
  }

  // 如果有未分类文件夹，选第一个
  const uncategorized = folders.find(
    (f) => !f.is_archived && !f.is_system && !f.category_id,
  );
  if (uncategorized) {
    return { type: "folder", folderId: uncategorized.id };
  }

  // 尝试系统文件夹
  const sys = folders.find((f) => f.is_system);
  if (sys) {
    return { type: "system", folderId: sys.id };
  }

  return null;
}

/**
 * 从 URL 参数解析选择状态
 */
function parseSelectionFromUrl(
  searchParams: URLSearchParams,
  folders: FolderWithStats[],
  categories: FolderCategory[],
): FolderSelection | null {
  const catParam = searchParams.get("cat");
  const folderIdParam = searchParams.get("id");

  // 栏目参数
  if (catParam) {
    const catId = parseInt(catParam, 10);
    if (categories.some((c) => c.id === catId)) {
      return { type: "category", categoryId: catId };
    }
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

// ==================== 常量 ====================

const EMPTY_CATEGORIES: FolderCategory[] = [];

// ==================== 主组件 ====================

export function FoldersPageClient({
  folders,
  categories: initialCategories,
  recentBookmarks: _recentBookmarks,
  error,
}: FoldersPageClientProps) {
  const stableCategories = initialCategories ?? EMPTY_CATEGORIES;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();

  // ==================== 状态管理 ====================

  // 对话框状态
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCreateCategoryDialog, setShowCreateCategoryDialog] =
    useState(false);
  const [createFolderDefaultCategoryId, setCreateFolderDefaultCategoryId] =
    useState<number | undefined>();

  // 本地文件夹和栏目状态（乐观更新）
  const [localFolders, setLocalFolders] = useState(folders);
  const [localCategories, setLocalCategories] =
    useState<FolderCategory[]>(stableCategories);

  // 选择状态
  const [selection, setSelection] = useState<FolderSelection | null>(() => {
    if (searchParams) {
      const urlSelection = parseSelectionFromUrl(
        searchParams,
        folders,
        stableCategories,
      );
      if (urlSelection) return urlSelection;
    }

    return getDefaultSelection(folders, stableCategories);
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

  // 使用 Hook 获取书签数据（支持分页）
  const {
    bookmarks,
    isLoading: isLoadingBookmarks,
    isLoadingMore: _isLoadingMore,
    hasMore,
    loadMore,
    refresh: refreshBookmarks,
    mutate: mutateBookmarks,
  } = useFolderBookmarks({
    selection,
    folders: localFolders,
    enabled: !!selection,
  });

  // 书签操作 Hook
  const { deleteBookmark, toggleReadStatus, toggleStarredStatus } =
    useBookmarkActions();

  // ==================== 同步 folders 到 localFolders ====================
  // 这个 useEffect 用于同步 props 到本地状态，实现乐观更新

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 同步 props 到本地状态
    setLocalFolders(folders);
    setLocalCategories(stableCategories);

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

    if (folders.length > 0 && user?.id) {
      setFoldersCache(folders, user.id);
    }
  }, [folders, stableCategories, user?.id]);

  // 验证并修正选择状态（当数据变化时）
  useEffect(() => {
    if (!selection) {
      const next = getDefaultSelection(localFolders, localCategories);
      if (next) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- 验证选择有效性，无效时重置
        setSelection(next);
      }
      return;
    }

    let isValid = true;

    if (selection.type === "folder" || selection.type === "system") {
      isValid = localFolders.some((f) => f.id === selection.folderId);
    } else if (selection.type === "category") {
      isValid = localCategories.some((c) => c.id === selection.categoryId);
    }

    if (!isValid) {
      setSelection(getDefaultSelection(localFolders, localCategories));
    }
  }, [localFolders, localCategories, selection]);

  // ==================== 回调函数 ====================

  const updateUrlState = useCallback((newSelection: FolderSelection) => {
    const params = new URLSearchParams();

    if (newSelection.type === "category") {
      params.set("cat", newSelection.categoryId.toString());
    } else if (
      newSelection.type === "folder" ||
      newSelection.type === "system"
    ) {
      params.set("id", newSelection.folderId.toString());
    }

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, "", newUrl);
  }, []);

  const handleRetry = () => {
    router.refresh();
  };

  const handleCreateClick = (defaultCategoryId?: number) => {
    setCreateFolderDefaultCategoryId(defaultCategoryId);
    setShowCreateDialog(true);
  };

  const handleCreateCategoryClick = () => {
    setShowCreateCategoryDialog(true);
  };

  // 栏目选择
  const handleSelectCategory = useCallback(
    (categoryId: number) => {
      const newSelection: FolderSelection = { type: "category", categoryId };
      setSelection(newSelection);
      updateUrlState(newSelection);
      setIsMobileNavOpen(false);
    },
    [updateUrlState],
  );

  // 文件夹选择
  const handleSelectFolder = useCallback(
    (folderId: number) => {
      const folder = localFolders.find((f) => f.id === folderId);
      if (!folder) return;

      const newSelection: FolderSelection = folder.is_system
        ? { type: "system", folderId }
        : { type: "folder", folderId };

      setSelection(newSelection);
      updateUrlState(newSelection);
      setIsMobileNavOpen(false);
    },
    [localFolders, updateUrlState],
  );

  // 系统文件夹选择
  const handleSelectSystem = useCallback(
    (folderId: number) => {
      const newSelection: FolderSelection = { type: "system", folderId };
      setSelection(newSelection);
      updateUrlState(newSelection);
      setIsMobileNavOpen(false);
    },
    [updateUrlState],
  );

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
        setSelection(getDefaultSelection(remaining, localCategories));
      }

      router.refresh();
    },
    [router, selection, localFolders, localCategories],
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

  // 文件夹创建后的乐观更新
  const handleFolderCreated = useCallback((newFolder: FolderType) => {
    const folderWithStats: FolderWithStats = {
      ...newFolder,
      source: newFolder.source ?? null,
      system_type: newFolder.system_type ?? null,
      is_system: newFolder.is_system ?? false,
      is_archived: newFolder.is_archived ?? false,
      ai_generation_source: newFolder.ai_generation_source ?? null,
      crystal_birth_time: newFolder.crystal_birth_time ?? null,
      is_ai_generated: newFolder.is_ai_generated ?? null,
      is_naming_pending: newFolder.is_naming_pending ?? null,
      origin_bookmark_ids: newFolder.origin_bookmark_ids ?? null,
      category_id:
        ((newFolder as Record<string, unknown>).category_id as number | null) ??
        null,
      bookmark_count: 0,
      today_count: 0,
      is_locked: false,
    };

    setLocalFolders((prev) => {
      if (prev.some((f) => f.id === newFolder.id)) {
        return prev;
      }
      return [folderWithStats, ...prev];
    });

    clearFoldersCache();
  }, []);

  // 栏目创建后的乐观更新
  const handleCategoryCreated = useCallback((newCategory: FolderCategory) => {
    setLocalCategories((prev) => {
      if (prev.some((c) => c.id === newCategory.id)) return prev;
      return [...prev, newCategory];
    });
  }, []);

  // 栏目删除后的乐观更新
  const handleCategoryDeleted = useCallback(
    (categoryId: number) => {
      setLocalCategories((prev) => prev.filter((c) => c.id !== categoryId));
      // 如果正在查看被删除的栏目，切换到默认选择
      if (
        selection?.type === "category" &&
        selection.categoryId === categoryId
      ) {
        const remainingCats = localCategories.filter(
          (c) => c.id !== categoryId,
        );
        setSelection(getDefaultSelection(localFolders, remainingCats));
      }
    },
    [selection, localFolders, localCategories],
  );

  // 栏目重命名后的乐观更新
  const handleCategoryRenamed = useCallback(
    (categoryId: number, newName: string) => {
      setLocalCategories((prev) =>
        prev.map((c) => (c.id === categoryId ? { ...c, name: newName } : c)),
      );
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

  // 文件夹栏目变更后的乐观更新
  const handleFolderCategoryChanged = useCallback(
    (folderId: number, categoryId: number | null) => {
      setLocalFolders((prev) =>
        prev.map((f) =>
          f.id === folderId ? { ...f, category_id: categoryId } : f,
        ),
      );
      clearFoldersCache();
    },
    [],
  );

  // 书签操作回调
  const handleEditBookmark = useCallback(
    (id: number) => {
      // 跳转到书签编辑页面
      router.push(`/bookmark/${id}/edit`);
    },
    [router],
  );

  const handleDeleteBookmark = useCallback(
    async (id: number) => {
      // 保存快照用于回滚
      const snapshot = bookmarks;

      // 乐观更新 - 从列表移除
      mutateBookmarks(
        bookmarks.filter((b) => b.id !== id),
        false,
      );

      // 更新文件夹书签计数
      if (selection?.type === "folder" || selection?.type === "system") {
        setLocalFolders((prev) =>
          prev.map((f) =>
            f.id === selection.folderId
              ? {
                  ...f,
                  bookmark_count: Math.max(0, (f.bookmark_count || 0) - 1),
                }
              : f,
          ),
        );
      }

      // 调用 API
      const result = await deleteBookmark(id);

      // 失败时回滚
      if (!result.success) {
        mutateBookmarks(snapshot, false);
        // 回滚文件夹计数
        if (selection?.type === "folder" || selection?.type === "system") {
          setLocalFolders((prev) =>
            prev.map((f) =>
              f.id === selection.folderId
                ? { ...f, bookmark_count: (f.bookmark_count || 0) + 1 }
                : f,
            ),
          );
        }
      }
    },
    [bookmarks, mutateBookmarks, deleteBookmark, selection],
  );

  const handleToggleRead = useCallback(
    async (id: number, isRead: boolean) => {
      // 保存快照用于回滚
      const snapshot = bookmarks;

      // 乐观更新
      mutateBookmarks(
        bookmarks.map((b) => (b.id === id ? { ...b, is_read: isRead } : b)),
        false,
      );

      // 调用 API
      const result = await toggleReadStatus(id, isRead);

      // 失败时回滚
      if (!result.success) {
        mutateBookmarks(snapshot, false);
      }
    },
    [bookmarks, mutateBookmarks, toggleReadStatus],
  );

  const handleToggleStarred = useCallback(
    async (id: number, isStarred: boolean) => {
      // 保存快照用于回滚
      const snapshot = bookmarks;

      // 乐观更新
      mutateBookmarks(
        bookmarks.map((b) =>
          b.id === id ? { ...b, is_starred: isStarred } : b,
        ),
        false,
      );

      // 调用 API
      const result = await toggleStarredStatus(id, isStarred);

      // 失败时回滚
      if (!result.success) {
        mutateBookmarks(snapshot, false);
      }
    },
    [bookmarks, mutateBookmarks, toggleStarredStatus],
  );

  // 批量移动成功回调：乐观更新文件夹计数 + 刷新列表
  const handleBatchMoveSuccess = useCallback(
    (movedIds: number[]) => {
      const count = movedIds.length;

      if (selection?.type === "folder" || selection?.type === "system") {
        setLocalFolders((prev) =>
          prev.map((f) =>
            f.id === selection.folderId
              ? {
                  ...f,
                  bookmark_count: Math.max(0, (f.bookmark_count || 0) - count),
                }
              : f,
          ),
        );
      }

      // 从当前列表中移除已移动的书签
      mutateBookmarks(
        bookmarks.filter((b) => !movedIds.includes(b.id)),
        false,
      );

      clearFoldersCache();
      router.refresh();
    },
    [selection, bookmarks, mutateBookmarks, router],
  );

  // 批量删除成功回调：乐观更新文件夹计数 + 刷新列表
  const handleBatchDeleteSuccess = useCallback(
    (deletedIds: number[]) => {
      const count = deletedIds.length;

      if (selection?.type === "folder" || selection?.type === "system") {
        setLocalFolders((prev) =>
          prev.map((f) =>
            f.id === selection.folderId
              ? {
                  ...f,
                  bookmark_count: Math.max(0, (f.bookmark_count || 0) - count),
                }
              : f,
          ),
        );
      }

      // 从当前列表中移除已删除的书签
      mutateBookmarks(
        bookmarks.filter((b) => !deletedIds.includes(b.id)),
        false,
      );

      clearFoldersCache();
      router.refresh();
    },
    [selection, bookmarks, mutateBookmarks, router],
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
        <Button size="lg" onClick={() => handleCreateClick()}>
          <Plus className="size-5 mr-2" />
          创建第一个文件夹
        </Button>

        <CreateFolderDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          categories={localCategories}
          onSuccess={handleFolderCreated}
        />
      </div>
    );
  }

  // 导航面板组件（带错误边界）
  const navPanel = (
    <FeatureErrorBoundary feature="folder-nav" compact>
      <FolderNavPanel
        folders={localFolders}
        categories={localCategories}
        selection={selection}
        onSelectCategory={handleSelectCategory}
        onSelectFolder={handleSelectFolder}
        onSelectSystem={handleSelectSystem}
        onCreateFolder={handleCreateClick}
        onCreateCategory={handleCreateCategoryClick}
        onFolderDeleted={handleFolderDeleted}
        onFolderRenamed={handleFolderRenamed}
        onFolderMerged={handleFolderMerged}
        onFolderCategoryChanged={handleFolderCategoryChanged}
        onCategoryDeleted={handleCategoryDeleted}
        onCategoryRenamed={handleCategoryRenamed}
        lockStatusMap={lockStatusMap}
        className="h-full"
      />
    </FeatureErrorBoundary>
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
            <h1 className="text-lg font-semibold flex-1">我的分类</h1>
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
            <FeatureErrorBoundary feature="folder-bookmarks">
              <FolderBookmarkArea
                selection={selection}
                folders={localFolders}
                bookmarks={bookmarks}
                isLoading={isLoadingBookmarks}
                hasMore={hasMore}
                onLoadMore={loadMore}
                onOpenAIAssistant={() => setIsAIAssistantOpen(true)}
                onEditBookmark={handleEditBookmark}
                onDeleteBookmark={handleDeleteBookmark}
                onToggleRead={handleToggleRead}
                onToggleStarred={handleToggleStarred}
                onBatchMoveSuccess={handleBatchMoveSuccess}
                onBatchDeleteSuccess={handleBatchDeleteSuccess}
                className="flex-1"
              />
            </FeatureErrorBoundary>
          )}
        </main>

        {/* 创建文件夹对话框 */}
        <CreateFolderDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          categories={localCategories}
          defaultCategoryId={createFolderDefaultCategoryId}
          onSuccess={handleFolderCreated}
        />

        {/* 创建栏目对话框 */}
        <CreateCategoryDialog
          open={showCreateCategoryDialog}
          onOpenChange={setShowCreateCategoryDialog}
          onSuccess={handleCategoryCreated}
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
