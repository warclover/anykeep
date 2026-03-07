/**
 * 左侧文件夹导航面板 (v3.0 栏目重构)
 *
 * 核心变更：
 * - 使用 category_id 代替 folder_group 进行分组
 * - 支持用户自定义栏目的 CRUD
 * - 保留系统文件夹和已归档文件夹区域
 */

"use client";

import { useState, useMemo, useCallback } from "react";
import { ChevronDown, ChevronRight, Inbox, Plus, Archive } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { FolderActionMenu } from "./folder-action-menu";
import { DroppableFolder } from "./droppable-folder";
import { useFolderHeat } from "@/hooks/domain/folder/use-folder-heat";
import { getFolderEmoji } from "./constants";
import type { FolderCategory } from "@/types/domain";
import type { FolderWithStats, FolderSelection, LockStatusMap } from "./types";

// 拆分后的子组件
import { FolderNavHeader } from "./folder-nav-header";
import { NavItem } from "./folder-nav-item";
import { CategoryHeader } from "./folder-category-header";

// re-export 保持外部调用方兼容
export { FolderNavHeader } from "./folder-nav-header";
export type { FolderNavHeaderStats } from "./folder-nav-header";

// ==================== 组件 Props ====================

interface FolderNavPanelProps {
  folders: FolderWithStats[];
  categories: FolderCategory[];
  selection: FolderSelection | null;
  onSelectCategory: (categoryId: number) => void;
  onSelectFolder: (folderId: number) => void;
  onSelectSystem: (folderId: number) => void;
  onCreateFolder: (defaultCategoryId?: number) => void;
  onCreateCategory: () => void;
  onFolderDeleted?: (folderId: number) => void;
  onFolderRenamed?: (folderId: number, newName: string) => void;
  onFolderMerged?: (
    sourceFolderId: number,
    targetFolderId: number,
    movedCount: number,
  ) => void;
  onCategoryDeleted?: (categoryId: number) => void;
  onCategoryRenamed?: (categoryId: number, newName: string) => void;
  onCategoryIconChanged?: (categoryId: number, newIcon: string) => void;
  onCategoryColorChanged?: (categoryId: number, newColor: string) => void;
  onCategoryMoved?: (
    categoryId: number,
    newSortOrder: number,
    neighborId: number,
    neighborNewOrder: number,
  ) => void;
  onFolderCategoryChanged?: (
    folderId: number,
    categoryId: number | null,
  ) => void;
  lockStatusMap?: LockStatusMap;
  /** 为 true 时不渲染头部（头部已移至工具栏行时使用） */
  hideHeader?: boolean;
  className?: string;
}

// ==================== 主组件 ====================

export function FolderNavPanel({
  folders,
  categories,
  selection,
  onSelectCategory,
  onSelectFolder,
  onSelectSystem,
  onCreateFolder,
  onCreateCategory,
  onFolderDeleted,
  onFolderRenamed,
  onFolderMerged,
  onCategoryDeleted,
  onCategoryRenamed,
  onCategoryIconChanged,
  onCategoryColorChanged,
  onCategoryMoved,
  onFolderCategoryChanged,
  lockStatusMap = {},
  hideHeader = false,
  className,
}: FolderNavPanelProps) {
  const [expandedCategories, setExpandedCategories] = useState<
    Record<number, boolean>
  >(() => {
    const initial: Record<number, boolean> = {};
    categories.forEach((c) => {
      initial[c.id] = true;
    });
    return initial;
  });

  const [showArchived, setShowArchived] = useState(false);
  const [showUncategorized, setShowUncategorized] = useState(true);

  const { getHeat } = useFolderHeat();

  // 按 category_id 分组
  const grouped = useMemo(() => {
    const system: FolderWithStats[] = [];
    const archived: FolderWithStats[] = [];
    const uncategorized: FolderWithStats[] = [];
    const byCat = new Map<number, FolderWithStats[]>();

    categories.forEach((c) => byCat.set(c.id, []));

    for (const folder of folders) {
      if (folder.is_archived) {
        archived.push(folder);
      } else if (folder.is_system) {
        system.push(folder);
      } else if (folder.category_id) {
        const catList = byCat.get(folder.category_id);
        if (catList) {
          catList.push(folder);
        } else {
          uncategorized.push(folder);
        }
      } else {
        uncategorized.push(folder);
      }
    }

    byCat.forEach((list) => {
      list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    });
    uncategorized.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    return { system, byCat, uncategorized, archived };
  }, [folders, categories]);

  // 统计
  const totalStats = useMemo(() => {
    const active = folders.filter((f) => !f.is_archived);
    return {
      folderCount: active.length,
      bookmarkCount: active.reduce(
        (sum, f) => sum + (f.bookmark_count || 0),
        0,
      ),
      todayCount: active.reduce((sum, f) => sum + (f.today_count || 0), 0),
    };
  }, [folders]);

  const toggleCategory = useCallback((catId: number) => {
    setExpandedCategories((prev) => ({ ...prev, [catId]: !prev[catId] }));
  }, []);

  const isCategorySelected = useCallback(
    (catId: number) =>
      selection?.type === "category" && selection.categoryId === catId,
    [selection],
  );

  const isFolderSelected = useCallback(
    (folderId: number) =>
      (selection?.type === "folder" || selection?.type === "system") &&
      selection.folderId === folderId,
    [selection],
  );

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-gray-50/50 dark:bg-gray-900/50",
        className,
      )}
    >
      {/* 头部（hideHeader 时由工具栏行渲染） */}
      {!hideHeader && (
        <FolderNavHeader
          totalStats={totalStats}
          onCreateCategory={onCreateCategory}
          onCreateFolder={onCreateFolder}
          className="border-b border-gray-200 dark:border-gray-800"
        />
      )}

      {/* 导航内容 */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-1">
          {/* 系统文件夹 */}
          {grouped.system.length > 0 && (
            <div className="pb-2">
              <p className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                系统
              </p>
              {grouped.system.map((folder) => (
                <DroppableFolder
                  key={folder.id}
                  folderId={folder.id}
                  folderName={folder.name}
                >
                  <NavItem
                    icon={<Inbox className="size-4 text-slate-600" />}
                    label={folder.name}
                    count={folder.bookmark_count}
                    todayCount={folder.today_count}
                    isSystem
                    isSelected={isFolderSelected(folder.id)}
                    onClick={() => onSelectSystem(folder.id)}
                  />
                </DroppableFolder>
              ))}
            </div>
          )}

          {/* 栏目列表 */}
          <div className="pt-2">
            <div className="flex items-center justify-between px-3 py-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                栏目
              </p>
              <button
                onClick={onCreateCategory}
                className="h-5 w-5 flex items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-muted-foreground hover:text-foreground transition-colors"
                title="新建栏目"
                aria-label="新建栏目"
              >
                <Plus className="size-3.5" />
              </button>
            </div>

            {categories.length === 0 ? (
              <button
                onClick={onCreateCategory}
                className="w-full px-3 py-3 text-xs text-muted-foreground hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-center"
              >
                + 创建第一个栏目
              </button>
            ) : (
              categories.map((category) => {
                const foldersInCat = grouped.byCat.get(category.id) || [];
                const isExpanded = expandedCategories[category.id] ?? true;
                const bookmarkCount = foldersInCat.reduce(
                  (sum, f) => sum + (f.bookmark_count || 0),
                  0,
                );

                return (
                  <Collapsible
                    key={category.id}
                    open={isExpanded}
                    onOpenChange={() => toggleCategory(category.id)}
                  >
                    <CategoryHeader
                      category={category}
                      allCategories={categories}
                      bookmarkCount={bookmarkCount}
                      folderCount={foldersInCat.length}
                      isExpanded={isExpanded}
                      isSelected={isCategorySelected(category.id)}
                      onToggle={() => toggleCategory(category.id)}
                      onSelect={() => onSelectCategory(category.id)}
                      onAddFolder={() => onCreateFolder(category.id)}
                      onDeleted={onCategoryDeleted}
                      onRenamed={onCategoryRenamed}
                      onIconChanged={onCategoryIconChanged}
                      onColorChanged={onCategoryColorChanged}
                      onMoved={onCategoryMoved}
                    />

                    <CollapsibleContent>
                      <div className="ml-2 border-l border-gray-200 dark:border-gray-700">
                        {foldersInCat.length === 0 ? (
                          <p className="px-4 py-2 text-xs text-muted-foreground italic">
                            暂无文件夹
                          </p>
                        ) : (
                          foldersInCat.map((folder) => (
                            <DroppableFolder
                              key={folder.id}
                              folderId={folder.id}
                              folderName={folder.name}
                            >
                              <NavItem
                                icon={
                                  <span className="text-base">
                                    {getFolderEmoji(folder.name)}
                                  </span>
                                }
                                label={folder.name}
                                count={folder.bookmark_count}
                                todayCount={folder.today_count}
                                heat={getHeat(folder.id)}
                                indent={1}
                                isSelected={isFolderSelected(folder.id)}
                                onClick={() => onSelectFolder(folder.id)}
                                folderColor={folder.color}
                                folderIcon={folder.icon}
                                actionMenu={
                                  <FolderActionMenu
                                    folder={folder}
                                    allFolders={folders}
                                    categories={categories}
                                    initialLockStatus={lockStatusMap[folder.id]}
                                    onFolderDeleted={onFolderDeleted}
                                    onFolderRenamed={onFolderRenamed}
                                    onFolderMerged={onFolderMerged}
                                    onFolderCategoryChanged={
                                      onFolderCategoryChanged
                                    }
                                  />
                                }
                              />
                            </DroppableFolder>
                          ))
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })
            )}
          </div>

          {/* 未分类文件夹 */}
          {grouped.uncategorized.length > 0 && (
            <div className="pt-2">
              <Collapsible
                open={showUncategorized}
                onOpenChange={setShowUncategorized}
              >
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-gray-100 dark:hover:bg-gray-800">
                    {showUncategorized ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                    <span className="text-xs font-medium">未分类</span>
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {grouped.uncategorized.length}
                    </Badge>
                  </button>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="ml-2 border-l border-gray-200 dark:border-gray-700">
                    {grouped.uncategorized.map((folder) => (
                      <DroppableFolder
                        key={folder.id}
                        folderId={folder.id}
                        folderName={folder.name}
                      >
                        <NavItem
                          icon={
                            <span className="text-base">
                              {getFolderEmoji(folder.name)}
                            </span>
                          }
                          label={folder.name}
                          count={folder.bookmark_count}
                          todayCount={folder.today_count}
                          heat={getHeat(folder.id)}
                          indent={1}
                          isSelected={isFolderSelected(folder.id)}
                          onClick={() => onSelectFolder(folder.id)}
                          folderColor={folder.color}
                          folderIcon={folder.icon}
                          actionMenu={
                            <FolderActionMenu
                              folder={folder}
                              allFolders={folders}
                              categories={categories}
                              initialLockStatus={lockStatusMap[folder.id]}
                              onFolderDeleted={onFolderDeleted}
                              onFolderRenamed={onFolderRenamed}
                              onFolderMerged={onFolderMerged}
                              onFolderCategoryChanged={onFolderCategoryChanged}
                            />
                          }
                        />
                      </DroppableFolder>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          {/* 已归档 */}
          {grouped.archived.length > 0 && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-800 mt-4">
              <Collapsible open={showArchived} onOpenChange={setShowArchived}>
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-gray-100 dark:hover:bg-gray-800">
                    {showArchived ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                    <Archive className="size-4" />
                    <span>已停用</span>
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {grouped.archived.length}
                    </Badge>
                  </button>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="ml-4 space-y-0.5">
                    {grouped.archived.map((folder) => (
                      <NavItem
                        key={folder.id}
                        icon={
                          <span className="text-base grayscale">
                            {getFolderEmoji(folder.name)}
                          </span>
                        }
                        label={folder.name}
                        count={folder.bookmark_count}
                        isSelected={isFolderSelected(folder.id)}
                        onClick={() => onSelectFolder(folder.id)}
                        folderColor={folder.color}
                        folderIcon={folder.icon}
                        actionMenu={
                          <FolderActionMenu
                            folder={folder}
                            allFolders={folders}
                            categories={categories}
                            initialLockStatus={lockStatusMap[folder.id]}
                            onFolderDeleted={onFolderDeleted}
                            onFolderRenamed={onFolderRenamed}
                            onFolderMerged={onFolderMerged}
                            onFolderCategoryChanged={onFolderCategoryChanged}
                          />
                        }
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
