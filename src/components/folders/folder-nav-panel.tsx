/**
 * 左侧文件夹导航面板
 * 树形结构展示文件夹层级，支持分组折叠
 */

"use client";

import { useState, useMemo } from "react";
import {
  ChevronDown,
  ChevronRight,
  Inbox,
  Plus,
  Archive,
  FolderTree,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  FOLDER_GROUPS,
  UI_GROUP_KEYS,
  getFolderEmoji,
  groupFolders,
  type UIFolderGroup,
} from "./constants";
import type { FolderWithStats } from "./types";

// ==================== 组件 Props ====================

interface FolderNavPanelProps {
  folders: FolderWithStats[];
  selectedGroup: UIFolderGroup | "all" | "system";
  selectedFolderId?: number;
  onSelectGroup: (group: UIFolderGroup | "all" | "system") => void;
  onSelectFolder?: (folderId: number) => void;
  onCreateFolder: () => void;
  className?: string;
}

// ==================== 导航项组件 ====================

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  count?: number;
  todayCount?: number;
  isSelected?: boolean;
  isSystem?: boolean;
  indent?: number;
  onClick?: () => void;
}

function NavItem({
  icon,
  label,
  count,
  todayCount,
  isSelected,
  isSystem,
  indent = 0,
  onClick,
}: NavItemProps) {
  return (
    <button
      onClick={onClick}
      role="treeitem"
      aria-selected={isSelected}
      aria-level={indent + 1}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors",
        "hover:bg-gray-100 dark:hover:bg-gray-800",
        isSelected && "bg-primary/10 text-primary font-medium",
        isSystem && "bg-blue-50 dark:bg-blue-900/20",
      )}
      style={{ paddingLeft: `${12 + indent * 16}px` }}
    >
      <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
        {icon}
      </span>
      <span className="flex-1 text-left truncate">{label}</span>
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
  );
}

// ==================== 分组标题组件 ====================

interface GroupHeaderProps {
  groupKey: UIFolderGroup;
  folderCount: number;
  isExpanded: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onSelect: () => void;
}

function GroupHeader({
  groupKey,
  folderCount,
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
        isSelected && "bg-primary/5",
      )}
    >
      <button
        onClick={onToggle}
        className="flex-shrink-0 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
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
          ({folderCount})
        </span>
      </button>
    </div>
  );
}

// ==================== 主组件 ====================

export function FolderNavPanel({
  folders,
  selectedGroup,
  selectedFolderId,
  onSelectGroup,
  onSelectFolder,
  onCreateFolder,
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

  // 切换分组展开状态
  const toggleGroup = (group: UIFolderGroup) => {
    setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

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
            收藏夹
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
          {/* 全部 */}
          <NavItem
            icon={<FolderTree className="size-4 text-primary" />}
            label="全部文件夹"
            count={totalStats.bookmarkCount}
            isSelected={selectedGroup === "all"}
            onClick={() => onSelectGroup("all")}
          />

          {/* 系统文件夹 */}
          {groupedFolders.system.length > 0 && (
            <div className="pt-2">
              <p className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                系统
              </p>
              {groupedFolders.system.map((folder) => (
                <NavItem
                  key={folder.id}
                  icon={<Inbox className="size-4 text-slate-600" />}
                  label={folder.name}
                  count={folder.bookmark_count}
                  todayCount={folder.today_count}
                  isSystem
                  isSelected={selectedGroup === "system"}
                  onClick={() => onSelectGroup("system")}
                />
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

                return (
                  <Collapsible
                    key={groupKey}
                    open={isExpanded}
                    onOpenChange={() => toggleGroup(groupKey)}
                  >
                    <GroupHeader
                      groupKey={groupKey}
                      folderCount={foldersInGroup.length}
                      isExpanded={isExpanded}
                      isSelected={selectedGroup === groupKey}
                      onToggle={() => toggleGroup(groupKey)}
                      onSelect={() => onSelectGroup(groupKey)}
                    />

                    <CollapsibleContent>
                      <div className="ml-2 border-l border-gray-200 dark:border-gray-700">
                        {foldersInGroup.map((folder) => (
                          <NavItem
                            key={folder.id}
                            icon={
                              <span className="text-base">
                                {getFolderEmoji(folder.name)}
                              </span>
                            }
                            label={folder.name}
                            count={folder.bookmark_count}
                            todayCount={folder.today_count}
                            indent={1}
                            isSelected={selectedFolderId === folder.id}
                            onClick={() => onSelectFolder?.(folder.id)}
                          />
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
                  <div className="ml-4 space-y-0.5 opacity-60">
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
