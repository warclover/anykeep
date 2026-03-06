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
import {
  ChevronDown,
  ChevronRight,
  Inbox,
  Plus,
  Archive,
  FolderPlus,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { FolderActionMenu } from "./folder-action-menu";
import { CategoryActionMenu } from "./category-action-menu";
import { DroppableFolder } from "./droppable-folder";
import { FolderHeatIndicator } from "@/components/folder/folder-heat-indicator";
import { useFolderHeat } from "@/hooks/domain/folder/use-folder-heat";
import { getFolderEmoji, getCategoryEmoji } from "./constants";
import type { FolderCategory } from "@/types/domain";
import type { FolderWithStats, FolderSelection, LockStatusMap } from "./types";

// ==================== 导航头部（可独立用于工具栏行） ====================

export interface FolderNavHeaderStats {
  folderCount: number;
  bookmarkCount: number;
  todayCount: number;
}

interface FolderNavHeaderProps {
  totalStats: FolderNavHeaderStats;
  onCreateCategory: () => void;
  onCreateFolder: (defaultCategoryId?: number) => void;
  className?: string;
}

export function FolderNavHeader({
  totalStats,
  onCreateCategory,
  onCreateFolder,
  className,
}: FolderNavHeaderProps) {
  return (
    <div
      className={cn(
        "flex-shrink-0 p-4 border-b border-transparent",
        "flex flex-row items-center min-h-[2.75rem] w-full",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white leading-tight">
          我的分类
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {totalStats.folderCount} 个文件夹 · {totalStats.bookmarkCount} 篇收藏
          {totalStats.todayCount > 0 && (
            <span className="text-green-500 ml-1">
              +{totalStats.todayCount} 今日
            </span>
          )}
        </p>
      </div>
      <div className="ml-auto flex shrink-0 items-center justify-center self-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 px-2 gap-1.5">
              <Plus className="size-4" />
              <span className="text-xs">新建</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onCreateCategory}>
              <LayoutGrid className="size-4 mr-2" />
              新建栏目
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onCreateFolder()}>
              <FolderPlus className="size-4 mr-2" />
              新建文件夹
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

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

// ==================== 导航项组件 ====================

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  count?: number;
  todayCount?: number;
  heat?: number;
  isSelected?: boolean;
  isSystem?: boolean;
  indent?: number;
  onClick?: () => void;
  actionMenu?: React.ReactNode;
  folderColor?: string | null;
  folderIcon?: string | null;
}

function NavItem({
  icon,
  label,
  count,
  todayCount,
  heat,
  isSelected,
  isSystem,
  indent = 0,
  onClick,
  actionMenu,
  folderColor,
  folderIcon,
}: NavItemProps) {
  return (
    <div className="group flex items-center min-w-0">
      <button
        onClick={onClick}
        role="treeitem"
        aria-selected={isSelected}
        aria-level={indent + 1}
        className={cn(
          "flex-1 min-w-0 flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors",
          "hover:bg-gray-100 dark:hover:bg-gray-800",
          isSelected && "bg-primary/10 text-primary font-medium",
          isSystem && !isSelected && "bg-blue-50/50 dark:bg-blue-900/10",
        )}
        style={{
          paddingLeft: `${12 + indent * 16}px`,
          ...(folderColor &&
            !isSelected && {
              borderLeftColor: folderColor,
              borderLeftWidth: "3px",
            }),
        }}
      >
        <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
          {folderIcon ? <span className="text-base">{folderIcon}</span> : icon}
        </span>
        <span className="flex-1 min-w-0 text-left truncate">{label}</span>
        {heat !== undefined && heat > 0 && (
          <FolderHeatIndicator heat={heat} size="sm" />
        )}
        {count !== undefined && count > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {count}
          </span>
        )}
        {todayCount !== undefined && todayCount > 0 && (
          <span className="text-xs text-green-500 tabular-nums">
            +{todayCount}
          </span>
        )}
      </button>
      {actionMenu && <div className="pr-1">{actionMenu}</div>}
    </div>
  );
}

// ==================== 栏目标题组件 ====================

interface CategoryHeaderProps {
  category: FolderCategory;
  allCategories: FolderCategory[];
  bookmarkCount: number;
  folderCount: number;
  isExpanded: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onAddFolder: () => void;
  onDeleted?: (categoryId: number) => void;
  onRenamed?: (categoryId: number, newName: string) => void;
  onIconChanged?: (categoryId: number, newIcon: string) => void;
  onColorChanged?: (categoryId: number, newColor: string) => void;
  onMoved?: (
    categoryId: number,
    newSortOrder: number,
    neighborId: number,
    neighborNewOrder: number,
  ) => void;
}

function CategoryHeader({
  category,
  allCategories,
  bookmarkCount,
  folderCount,
  isExpanded,
  isSelected,
  onToggle,
  onSelect,
  onAddFolder,
  onDeleted,
  onRenamed,
  onIconChanged,
  onColorChanged,
  onMoved,
}: CategoryHeaderProps) {
  return (
    <div
      className={cn(
        "group flex items-center gap-1 px-2 py-1.5 rounded-lg transition-colors",
        "hover:bg-gray-100 dark:hover:bg-gray-800",
        isSelected && "bg-primary/10",
      )}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="flex-shrink-0 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
        aria-label={isExpanded ? "收起" : "展开"}
      >
        {isExpanded ? (
          <ChevronDown className="size-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 text-muted-foreground" />
        )}
      </button>

      <button
        onClick={onSelect}
        className="flex-1 flex items-center gap-2 min-w-0"
      >
        <div
          className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center"
          style={{
            backgroundColor: category.color ? `${category.color}20` : undefined,
          }}
        >
          <span
            className="text-sm"
            style={{ color: category.color || undefined }}
          >
            {getCategoryEmoji(category.icon)}
          </span>
        </div>
        <span
          className={cn(
            "flex-1 text-left text-xs font-bold truncate",
            isSelected && "text-primary",
          )}
        >
          {category.name}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {bookmarkCount}
        </span>
      </button>

      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          onAddFolder();
        }}
        title="在此栏目下新建文件夹"
      >
        <Plus className="size-3.5" />
      </Button>

      <CategoryActionMenu
        category={category}
        folderCount={folderCount}
        allCategories={allCategories}
        onDeleted={onDeleted}
        onRenamed={onRenamed}
        onIconChanged={onIconChanged}
        onColorChanged={onColorChanged}
        onMoved={onMoved}
      />
    </div>
  );
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

    // 按 sort_order 排序
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
