"use client";

import { useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ErrorMessage } from "@/components/ui/error-message";
import { FeatureErrorBoundary } from "@/components/error-boundary/feature-error-boundary";
import { CreateFolderDialog } from "@/components/folders/create-folder-dialog";
import { CreateCategoryDialog } from "@/components/folders/create-category-dialog";
import { FolderNavPanel } from "@/components/folders/folder-nav-panel";
import { FolderBookmarkArea } from "@/components/folders/folder-bookmark-area";
import { FolderDropProvider } from "@/components/folders/folder-drop-context";
import { AIAssistantPanel } from "@/components/ai/ai-assistant-panel";
import { useIsMobile } from "@/hooks/use-media-query";
import { useFolderBookmarks } from "@/hooks/data/use-folder-bookmarks";
import { FoldersEmptyState } from "./folders-empty-state";
import { FoldersMobileHeader } from "./folders-mobile-header";
import { useFolderSelection } from "./hooks/use-folder-selection";
import { useFolderOptimisticUpdates } from "./hooks/use-folder-optimistic-updates";
import { useFolderToolbar } from "./hooks/use-folder-toolbar";
import { useFolderBookmarkActions } from "./hooks/use-folder-bookmark-actions";
import { useFeatureOnboarding } from "@/hooks/onboarding";
import { OnboardingOverlay } from "@/components/ui/onboarding-overlay";
import {
  DRAG_DROP_STEPS,
  DRAG_DROP_STORAGE_KEY,
} from "@/hooks/onboarding/steps/drag-drop-steps";
import type {
  FolderWithStats,
  FolderCategory,
  BookmarkWithFolder,
} from "@/components/folders/types";
import { useRouter } from "next/navigation";

const EMPTY_CATEGORIES: FolderCategory[] = [];

interface FoldersPageClientProps {
  folders: FolderWithStats[];
  categories?: FolderCategory[];
  /** @deprecated 暂未使用，保留接口兼容性 */
  recentBookmarks?: BookmarkWithFolder[];
  error?: string;
}

export function FoldersPageClient({
  folders,
  categories: initialCategories,
  recentBookmarks: _recentBookmarks,
  error,
}: FoldersPageClientProps) {
  const stableCategories = initialCategories ?? EMPTY_CATEGORIES;
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCreateCategoryDialog, setShowCreateCategoryDialog] =
    useState(false);
  const [createFolderDefaultCategoryId, setCreateFolderDefaultCategoryId] =
    useState<number | undefined>();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);

  // 拖放引导（仅在有文件夹和书签时激活）
  const dragDropOnboarding = useFeatureOnboarding(
    DRAG_DROP_STEPS,
    DRAG_DROP_STORAGE_KEY,
  );

  const {
    selection,
    setSelection,
    handleSelectCategory: _selectCategory,
    handleSelectFolder: _selectFolder,
    handleSelectSystem: _selectSystem,
  } = useFolderSelection({
    initialFolders: folders,
    initialCategories: stableCategories,
    searchParams,
  });

  const {
    bookmarks,
    isLoading: isLoadingBookmarks,
    hasMore,
    loadMore,
    refresh: refreshBookmarks,
    mutate: mutateBookmarks,
  } = useFolderBookmarks({ selection, folders, enabled: !!selection });

  const optimistic = useFolderOptimisticUpdates({
    initialFolders: folders,
    initialCategories: stableCategories,
    selection,
    setSelection,
    refreshBookmarks,
  });

  // 回调必须用 useCallback 包裹，否则每次渲染生成新引用 →
  // toolbarElement useMemo 重算 → useEffect 调用 setPageToolbar → context 更新 →
  // FoldersPageClient 重渲染 → 新回调 → 无限循环
  const handleCreateCategory = useCallback(
    () => setShowCreateCategoryDialog(true),
    [],
  );
  const handleCreateFolder = useCallback((catId?: number) => {
    setCreateFolderDefaultCategoryId(catId);
    setShowCreateDialog(true);
  }, []);
  const handleOpenAIAssistant = useCallback(
    () => setIsAIAssistantOpen(true),
    [],
  );

  const toolbar = useFolderToolbar({
    selection,
    localFolders: optimistic.localFolders,
    localCategories: optimistic.localCategories,
    bookmarks,
    isLoadingBookmarks,
    onCreateCategory: handleCreateCategory,
    onCreateFolder: handleCreateFolder,
    onOpenAIAssistant: handleOpenAIAssistant,
  });

  const bmActions = useFolderBookmarkActions({
    bookmarks,
    mutateBookmarks,
    selection,
    setLocalFolders: optimistic.setLocalFolders,
  });

  const handleSelectCategory = useCallback(
    (id: number) => {
      _selectCategory(id);
      setIsMobileNavOpen(false);
    },
    [_selectCategory],
  );
  const handleSelectFolder = useCallback(
    (id: number) => {
      _selectFolder(id, optimistic.localFolders);
      setIsMobileNavOpen(false);
    },
    [_selectFolder, optimistic.localFolders],
  );
  const handleSelectSystem = useCallback(
    (id: number) => {
      _selectSystem(id);
      setIsMobileNavOpen(false);
    },
    [_selectSystem],
  );
  const handleCreateClick = (catId?: number) => {
    setCreateFolderDefaultCategoryId(catId);
    setShowCreateDialog(true);
  };

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <ErrorMessage message={error} retry={() => router.refresh()} />
      </div>
    );
  }

  if (optimistic.localFolders.length === 0) {
    return (
      <FoldersEmptyState
        showCreateDialog={showCreateDialog}
        onShowCreateDialogChange={setShowCreateDialog}
        categories={optimistic.localCategories}
        onFolderCreated={optimistic.handleFolderCreated}
      />
    );
  }

  const navPanel = (
    <FeatureErrorBoundary feature="folder-nav" compact>
      <FolderNavPanel
        folders={optimistic.localFolders}
        categories={optimistic.localCategories}
        selection={selection}
        onSelectCategory={handleSelectCategory}
        onSelectFolder={handleSelectFolder}
        onSelectSystem={handleSelectSystem}
        onCreateFolder={handleCreateClick}
        onCreateCategory={() => setShowCreateCategoryDialog(true)}
        onFolderDeleted={optimistic.handleFolderDeleted}
        onFolderRenamed={optimistic.handleFolderRenamed}
        onFolderMerged={optimistic.handleFolderMerged}
        onFolderCategoryChanged={optimistic.handleFolderCategoryChanged}
        onCategoryDeleted={optimistic.handleCategoryDeleted}
        onCategoryRenamed={optimistic.handleCategoryRenamed}
        onCategoryIconChanged={optimistic.handleCategoryIconChanged}
        onCategoryColorChanged={optimistic.handleCategoryColorChanged}
        onCategoryMoved={optimistic.handleCategoryMoved}
        lockStatusMap={optimistic.lockStatusMap}
        hideHeader={!isMobile}
        className="h-full"
      />
    </FeatureErrorBoundary>
  );

  return (
    <FolderDropProvider onMoveSuccess={refreshBookmarks}>
      <div className="h-full flex overflow-hidden">
        <aside className="hidden lg:block w-[280px] flex-shrink-0 border-r border-gray-200 dark:border-gray-800 overflow-hidden">
          {navPanel}
        </aside>

        <Sheet open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
          <SheetContent side="left" className="p-0 w-[300px]">
            {navPanel}
          </SheetContent>
        </Sheet>

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <FoldersMobileHeader
            onOpenNav={() => setIsMobileNavOpen(true)}
            onOpenAIAssistant={() => setIsAIAssistantOpen(true)}
          />
          {selection && (
            <FeatureErrorBoundary feature="folder-bookmarks">
              <FolderBookmarkArea
                selection={selection}
                folders={optimistic.localFolders}
                categories={optimistic.localCategories}
                bookmarks={bookmarks}
                isLoading={isLoadingBookmarks}
                hasMore={hasMore}
                onLoadMore={loadMore}
                onOpenAIAssistant={() => setIsAIAssistantOpen(true)}
                onEditBookmark={bmActions.handleEditBookmark}
                onDeleteBookmark={bmActions.handleDeleteBookmark}
                onToggleRead={bmActions.handleToggleRead}
                onToggleStarred={bmActions.handleToggleStarred}
                onBatchMoveSuccess={bmActions.handleBatchMoveSuccess}
                onBatchDeleteSuccess={bmActions.handleBatchDeleteSuccess}
                toolbarPosition="none"
                searchQuery={toolbar.searchQuery}
                setSearchQuery={toolbar.setSearchQuery}
                sortBy={toolbar.sortBy}
                setSortBy={toolbar.setSortBy}
                viewMode={toolbar.viewMode}
                setViewMode={toolbar.setViewMode}
                className="flex-1"
              />
            </FeatureErrorBoundary>
          )}
        </main>

        <CreateFolderDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          categories={optimistic.localCategories}
          defaultCategoryId={createFolderDefaultCategoryId}
          onSuccess={optimistic.handleFolderCreated}
        />
        <CreateCategoryDialog
          open={showCreateCategoryDialog}
          onOpenChange={setShowCreateCategoryDialog}
          onSuccess={optimistic.handleCategoryCreated}
        />
        <AIAssistantPanel
          open={isAIAssistantOpen}
          onOpenChange={setIsAIAssistantOpen}
          title="AI 文件夹助手"
        />
      </div>

      {/* 拖放引导 spotlight（有文件夹+有书签时显示） */}
      {dragDropOnboarding.isActive &&
        dragDropOnboarding.step &&
        optimistic.localFolders.length >= 2 &&
        bookmarks.length > 0 && (
          <OnboardingOverlay
            step={dragDropOnboarding.step}
            currentStep={dragDropOnboarding.currentStep}
            totalSteps={dragDropOnboarding.totalSteps}
            onNext={dragDropOnboarding.next}
            onPrev={dragDropOnboarding.prev}
            onSkip={dragDropOnboarding.skip}
          />
        )}
    </FolderDropProvider>
  );
}
