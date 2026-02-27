/**
 * 左侧文件夹导航面板 (v2.0 重构)
 *
 * 树形结构展示文件夹层级，支持分组折叠
 * 核心变更：
 * - 使用 FolderSelection 统一选择状态
 * - 分组可点击选中（显示分组内所有书签）
 * - 移除「全部文件夹」入口
 * - 添加文件夹操作菜单
 */

"use client";

import { useState, useMemo, useCallback } from "react";
import { ChevronDown, ChevronRight, Inbox, Plus, Archive } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { FolderActionMenu } from "./folder-action-menu";
import { DroppableFolder } from "./droppable-folder";
import { FolderHeatIndicator } from "@/components/folder/folder-heat-indicator";
import { useFolderHeat } from "@/hooks/domain/folder/use-folder-heat";
import {
  FOLDER_GROUPS,
  UI_GROUP_KEYS,
  getFolderEmoji,
  groupFolders,
  type UIFolderGroup,
} from "./constants";
import type { FolderWithStats, FolderSelection, LockStatusMap } from "./types";

// ==================== 组件 Props ====================

interface FolderNavPanelProps {
  folders: FolderWithStats[];
  /** 当前选择状态 */
  selection: FolderSelection | null;
  /** 选择分组回调 */
  onSelectGroup: (groupId: UIFolderGroup) => void;
  /** 选择文件夹回调 */
  onSelectFolder: (folderId: number) => void;
  /** 选择系统文件夹回调 */
  onSelectSystem: (folderId: number) => void;
  /** 创建文件夹回调 */
  onCreateFolder: () => void;
  /** 文件夹删除回调 */
  onFolderDeleted?: (folderId: number) => void;
  /** 文件夹重命名回调 */
  onFolderRenamed?: (folderId: number, newName: string) => void;
  /** 文件夹合并回调 */
  onFolderMerged?: (
    sourceFolderId: number,
    targetFolderId: number,
    movedCount: number,
  ) => void;
  /** 锁状态映射 */
  lockStatusMap?: LockStatusMap;
  className?: string;
}

// ==================== 导航项组件 ====================

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  count?: number;
  todayCount?: number;
  /** 文件夹热度值 (0-100) */
  heat?: number;
  isSelected?: boolean;
  isSystem?: boolean;
  indent?: number;
  onClick?: () => void;
  actionMenu?: React.ReactNode;
  /** 文件夹自定义颜色 */
  folderColor?: string | null;
  /** 文件夹自定义图标 */
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
        {/* 热度指示器 */}
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

// ==================== 分组标题组件 ====================

interface GroupHeaderProps {
  groupKey: UIFolderGroup;
  bookmarkCount: number;
  _folderCount: number;
  isExpanded: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onSelect: () => void;
}

function GroupHeader({
  groupKey,
  bookmarkCount,
  _folderCount,
  isExpanded,
  isSelected,
  onToggle,
  onSelect,
}: GroupHeaderProps) {
  const config = FOLDER_GROUPS[groupKey];
  const GroupIcon = config.icon;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors",
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
          className={cn(
            "flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center",
            `bg-gradient-to-br ${config.colors.gradient.from} ${config.colors.gradient.to}`,
          )}
        >
          <GroupIcon className="size-3.5 text-white" />
        </div>
        <span
          className={cn(
            "flex-1 text-left text-xs font-medium truncate",
            isSelected && "text-primary",
          )}
        >
          {config.label}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {bookmarkCount}
        </span>
      </button>
    </div>
  );
}

// ==================== 主组件 ====================

export function FolderNavPanel({
  folders,
  selection,
  onSelectGroup,
  onSelectFolder,
  onSelectSystem,
  onCreateFolder,
  onFolderDeleted,
  onFolderRenamed,
  onFolderMerged,
  lockStatusMap = {},
  className,
}: FolderNavPanelProps) {
  // 分组展开状态
  const [expandedGroups, setExpandedGroups] = useState<
    Record<UIFolderGroup, boolean>
  >({
    work: true,
    study: true,
    life: true,
    entertainment: true,
    other: true,
  });

  // 已归档展开状态
  const [showArchived, setShowArchived] = useState(false);

  // 获取文件夹热度数据
  const { getHeat } = useFolderHeat();

  // 分组后的文件夹
  const groupedFolders = useMemo(() => groupFolders(folders), [folders]);

  // 计算总统计
  const totalStats = useMemo(() => {
    const activeFolders = folders.filter((f) => !f.is_archived);
    return {
      folderCount: activeFolders.length,
      bookmarkCount: activeFolders.reduce(
        (sum, f) => sum + (f.bookmark_count || 0),
        0,
      ),
      todayCount: activeFolders.reduce(
        (sum, f) => sum + (f.today_count || 0),
        0,
      ),
    };
  }, [folders]);

  // 计算每个分组的书签总数
  const groupBookmarkCounts = useMemo(() => {
    const counts: Record<UIFolderGroup, number> = {
      work: 0,
      study: 0,
      life: 0,
      entertainment: 0,
      other: 0,
    };

    for (const groupKey of UI_GROUP_KEYS) {
      counts[groupKey] = groupedFolders.groups[groupKey].reduce(
        (sum, f) => sum + (f.bookmark_count || 0),
        0,
      );
    }

    return counts;
  }, [groupedFolders]);

  // 切换分组展开状态
  const toggleGroup = useCallback((group: UIFolderGroup) => {
    setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  }, []);

  // 判断选择状态
  const isGroupSelected = useCallback(
    (groupId: UIFolderGroup) => {
      return selection?.type === "group" && selection.groupId === groupId;
    },
    [selection],
  );

  const isFolderSelected = useCallback(
    (folderId: number) => {
      return (
        (selection?.type === "folder" || selection?.type === "system") &&
        selection.folderId === folderId
      );
    },
    [selection],
  );

  // 获取非空分组
  const nonEmptyGroups = UI_GROUP_KEYS.filter(
    (group) => groupedFolders.groups[group].length > 0,
  );

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-gray-50/50 dark:bg-gray-900/50",
        className,
      )}
    >
      {/* 头部 */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            我的分类
          </h2>
          <Button size="sm" variant="ghost" onClick={onCreateFolder}>
            <Plus className="size-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {totalStats.folderCount} 个文件夹 · {totalStats.bookmarkCount} 篇收藏
          {totalStats.todayCount > 0 && (
            <span className="text-green-500 ml-1">
              +{totalStats.todayCount} 今日
            </span>
          )}
        </p>
      </div>

      {/* 导航内容 */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-1">
          {/* 系统文件夹 */}
          {groupedFolders.system.length > 0 && (
            <div className="pb-2">
              <p className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                系统
              </p>
              {groupedFolders.system.map((folder) => (
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

          {/* 分组列表 */}
          {nonEmptyGroups.length > 0 && (
            <div className="pt-2">
              <p className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                分类
              </p>

              {nonEmptyGroups.map((groupKey) => {
                const foldersInGroup = groupedFolders.groups[groupKey];
                const isExpanded = expandedGroups[groupKey];
                const bookmarkCount = groupBookmarkCounts[groupKey];

                return (
                  <Collapsible
                    key={groupKey}
                    open={isExpanded}
                    onOpenChange={() => toggleGroup(groupKey)}
                  >
                    <GroupHeader
                      groupKey={groupKey}
                      bookmarkCount={bookmarkCount}
                      _folderCount={foldersInGroup.length}
                      isExpanded={isExpanded}
                      isSelected={isGroupSelected(groupKey)}
                      onToggle={() => toggleGroup(groupKey)}
                      onSelect={() => onSelectGroup(groupKey)}
                    />

                    <CollapsibleContent>
                      <div className="ml-2 border-l border-gray-200 dark:border-gray-700">
                        {foldersInGroup.map((folder) => (
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
                                  initialLockStatus={lockStatusMap[folder.id]}
                                  onFolderDeleted={onFolderDeleted}
                                  onFolderRenamed={onFolderRenamed}
                                  onFolderMerged={onFolderMerged}
                                />
                              }
                            />
                          </DroppableFolder>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}

          {/* 已归档 */}
          {groupedFolders.archived.length > 0 && (
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
                      {groupedFolders.archived.length}
                    </Badge>
                  </button>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="ml-4 space-y-0.5">
                    {groupedFolders.archived.map((folder) => (
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
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
        </div>
      </div>

      {/* 底部操作 */}
      <div className="flex-shrink-0 p-3 border-t border-gray-200 dark:border-gray-800">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onCreateFolder}
        >
          <Plus className="size-4 mr-2" />
          新建文件夹
        </Button>
      </div>
    </div>
  );
}
