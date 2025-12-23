/**
 * 收藏夹页面客户端组件（升级版 - 双栏布局）
 *
 * 布局结构：
 * - 左侧：文件夹导航面板（树形结构）
 * - 右侧：文件夹卡片网格 + 快捷操作 + 最近活动
 *
 * 功能保留：
 * - 创建/重命名/合并/删除文件夹
 * - 分组折叠展开
 * - 锁状态（从服务端数据直接获取）
 * - 乐观更新
 * - localStorage 缓存（V4.2.26）
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Folder, Plus, Menu, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/error-message";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { CreateFolderDialog } from "@/components/folders/create-folder-dialog";
import { FolderNavPanel } from "@/components/folders/folder-nav-panel";
import { FolderContentArea } from "@/components/folders/folder-content-area";
import { AIAssistantPanel } from "@/components/ai/ai-assistant-panel";
import { type UIFolderGroup } from "@/components/folders/constants";
import { setFoldersCache, clearFoldersCache } from "@/lib/folders/cache";
import type {
  FolderWithStats,
  BookmarkWithFolder,
  LockStatusMap,
} from "@/components/folders/types";

// ==================== 组件 Props ====================

interface FoldersPageClientProps {
  folders: FolderWithStats[];
  recentBookmarks: BookmarkWithFolder[];
  error?: string;
}

// ==================== 主组件 ====================

export function FoldersPageClient({
  folders,
  recentBookmarks,
  error,
}: FoldersPageClientProps) {
  const router = useRouter();

  // ==================== 状态管理 ====================

  // 创建对话框状态
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // 本地文件夹状态（用于乐观更新）
  const [localFolders, setLocalFolders] = useState(folders);

  // 选中的分组
  const [selectedGroup, setSelectedGroup] = useState<
    UIFolderGroup | "all" | "system"
  >("all");

  // 移动端导航抽屉状态
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // AI 助手面板状态
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);

  // V4.2.26: 从服务端数据直接提取锁状态（消除重复请求）
  // 服务端 page.tsx 已查询 folder_profiles，无需客户端再次请求
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

  // ==================== 同步 folders 到 localFolders + 更新缓存 ====================

  // 乐观更新模式：需要将 props 同步到 local state 以支持本地修改
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
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

    // V4.2.26: 更新 localStorage 缓存
    if (folders.length > 0) {
      setFoldersCache(folders);
    }
  }, [folders]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ==================== 回调函数 ====================

  const handleRetry = () => {
    router.refresh();
  };

  const handleCreateClick = () => {
    setShowCreateDialog(true);
  };

  // 文件夹删除后的乐观更新
  const handleFolderDeleted = useCallback(
    (deletedFolderId: number) => {
      setLocalFolders((prev) => prev.filter((f) => f.id !== deletedFolderId));
      clearFoldersCache(); // V4.2.26: 清除缓存保证一致性
      router.refresh();
    },
    [router],
  );

  // 文件夹重命名后的乐观更新
  const handleFolderRenamed = useCallback(
    (folderId: number, newName: string) => {
      setLocalFolders((prev) =>
        prev.map((f) => (f.id === folderId ? { ...f, name: newName } : f)),
      );
      clearFoldersCache(); // V4.2.26: 清除缓存保证一致性
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
      clearFoldersCache(); // V4.2.26: 清除缓存保证一致性
    },
    [],
  );

  // 选择分组时关闭移动端导航
  const handleSelectGroup = (group: UIFolderGroup | "all" | "system") => {
    setSelectedGroup(group);
    setIsMobileNavOpen(false);
  };

  // 点击文件夹导航项时跳转到该文件夹
  const handleSelectFolder = useCallback(
    (folderId: number) => {
      setIsMobileNavOpen(false);
      router.push(`/home?folder=${folderId}`);
    },
    [router],
  );

  // 导出文件夹内书签
  const handleExportFolder = useCallback(
    (folderId: number) => {
      // 跳转到导出页面，带上文件夹参数
      router.push(`/export?folder=${folderId}`);
    },
    [router],
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
      selectedGroup={selectedGroup}
      onSelectGroup={handleSelectGroup}
      onSelectFolder={handleSelectFolder}
      onCreateFolder={handleCreateClick}
      className="h-full"
    />
  );

  return (
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
          {/* AI 助手按钮 */}
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

        {/* 内容区域 */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* 桌面端顶部操作栏 */}
          <div className="hidden lg:flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <h1 className="text-lg font-semibold">收藏夹</h1>
            {/* AI 助手按钮 */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAIAssistantOpen(true)}
              className="gap-2 text-violet-600 border-violet-200 hover:bg-violet-50 hover:border-violet-300 dark:text-violet-400 dark:border-violet-800 dark:hover:bg-violet-950"
            >
              <Sparkles className="size-4" />
              AI 助手
            </Button>
          </div>

          <FolderContentArea
            folders={localFolders}
            selectedGroup={selectedGroup}
            recentBookmarks={recentBookmarks}
            lockStatusMap={lockStatusMap}
            onCreateFolder={handleCreateClick}
            onActionComplete={() => router.refresh()}
            onFolderDeleted={handleFolderDeleted}
            onFolderRenamed={handleFolderRenamed}
            onFolderMerged={handleFolderMerged}
            onExportFolder={handleExportFolder}
            className="flex-1"
          />
        </div>
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
  );
}
