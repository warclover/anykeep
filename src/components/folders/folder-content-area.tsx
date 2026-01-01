/**
 * 右侧文件夹内容区域
 * 展示当前分组的文件夹卡片、快捷操作和最近活动
 */

"use client";

import { useMemo, useState, useDeferredValue } from "react";
import Link from "next/link";
import {
  Search,
  SortAsc,
  LayoutGrid,
  List,
  Plus,
  Clock,
  Globe,
  Folder,
  FolderTree,
  Inbox,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FolderCardGrid, FolderListItem } from "./folder-card";
import { FOLDER_GROUPS, UI_GROUP_KEYS, type UIFolderGroup } from "./constants";
import type {
  FolderWithStats,
  BookmarkWithFolder,
  LockStatusMap,
  FolderActionCallbacks,
} from "./types";

// ==================== 类型定义 ====================

type SortOption = "name" | "count" | "created" | "updated";

interface FolderContentAreaProps extends FolderActionCallbacks {
  folders: FolderWithStats[];
  selectedGroup: UIFolderGroup | "all" | "system";
  recentBookmarks: BookmarkWithFolder[];
  lockStatusMap: LockStatusMap;
  onCreateFolder: () => void;
  onOpenAIAssistant?: () => void;
  className?: string;
}

// ==================== 排序配置 ====================

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "name", label: "名称" },
  { value: "count", label: "收藏数" },
  { value: "created", label: "创建时间" },
  { value: "updated", label: "更新时间" },
];

// ==================== 主组件 ====================

export function FolderContentArea({
  folders,
  selectedGroup,
  recentBookmarks,
  lockStatusMap,
  onCreateFolder,
  onOpenAIAssistant,
  onActionComplete,
  onFolderDeleted,
  onFolderRenamed,
  onFolderMerged,
  onExportFolder,
  className,
}: FolderContentAreaProps) {
  // 搜索和排序状态
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery); // 防抖优化
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // 过滤后的文件夹
  const filteredFolders = useMemo(() => {
    let result = folders.filter((f) => !f.is_archived);

    // 按选中的分组过滤
    if (selectedGroup === "system") {
      result = result.filter((f) => f.is_system);
    } else if (
      selectedGroup !== "all" &&
      UI_GROUP_KEYS.includes(selectedGroup)
    ) {
      result = result.filter(
        (f) => !f.is_system && (f.folder_group || "other") === selectedGroup,
      );
    }

    // 搜索过滤（使用防抖后的值）
    if (deferredSearch.trim()) {
      const query = deferredSearch.toLowerCase();
      result = result.filter((f) => f.name.toLowerCase().includes(query));
    }

    // 排序
    result.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name, "zh-CN");
        case "count":
          return (b.bookmark_count || 0) - (a.bookmark_count || 0);
        case "created":
          return (
            new Date(b.created_at || 0).getTime() -
            new Date(a.created_at || 0).getTime()
          );
        case "updated":
          return (
            new Date(b.updated_at || 0).getTime() -
            new Date(a.updated_at || 0).getTime()
          );
        default:
          return (a.sort_order ?? 0) - (b.sort_order ?? 0);
      }
    });

    return result;
  }, [folders, selectedGroup, deferredSearch, sortBy]);

  // 获取当前分组配置
  const getGroupConfig = () => {
    if (selectedGroup === "all") {
      return {
        label: "全部文件夹",
        icon: FolderTree,
        description: "查看所有分类的文件夹",
        colors: FOLDER_GROUPS.other.colors,
      };
    }
    if (selectedGroup === "system") {
      return {
        label: "系统文件夹",
        icon: Inbox,
        description: "系统自动创建的文件夹",
        colors: FOLDER_GROUPS.default.colors,
      };
    }
    const config = FOLDER_GROUPS[selectedGroup];
    return {
      label: config.label,
      icon: config.icon,
      description: `${config.keywords.slice(0, 3).join("、")}等相关内容`,
      colors: config.colors,
    };
  };

  const groupConfig = getGroupConfig();
  const GroupIcon = groupConfig.icon;

  // 统计信息
  const stats = useMemo(() => {
    return {
      folderCount: filteredFolders.length,
      bookmarkCount: filteredFolders.reduce(
        (sum, f) => sum + (f.bookmark_count || 0),
        0,
      ),
      todayCount: filteredFolders.reduce(
        (sum, f) => sum + (f.today_count || 0),
        0,
      ),
    };
  }, [filteredFolders]);

  return (
    <div className={cn("flex flex-col h-full overflow-hidden", className)}>
      {/* 单行标题栏 */}
      <div className="flex-shrink-0 px-6 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-3">
          {/* 左侧：图标 + 标题 + 统计 */}
          <div
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
              selectedGroup !== "all" && selectedGroup !== "system"
                ? `bg-gradient-to-br ${FOLDER_GROUPS[selectedGroup]?.colors.gradient.from} ${FOLDER_GROUPS[selectedGroup]?.colors.gradient.to}`
                : "bg-gray-100 dark:bg-gray-800",
            )}
          >
            <GroupIcon
              className={cn(
                "size-4",
                selectedGroup !== "all" && selectedGroup !== "system"
                  ? "text-white"
                  : "text-gray-600 dark:text-gray-400",
              )}
            />
          </div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            {groupConfig.label}
          </h2>
          <span className="text-xs text-muted-foreground">
            {stats.folderCount} 个文件夹 · {stats.bookmarkCount} 篇收藏
            {stats.todayCount > 0 && (
              <span className="text-green-500 ml-1">+{stats.todayCount}</span>
            )}
          </span>

          {/* 右侧：按钮组 */}
          <div className="flex-1" />
          {onOpenAIAssistant && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenAIAssistant}
              className="hidden lg:flex gap-1.5 text-violet-600 border-violet-200 hover:bg-violet-50 hover:border-violet-300 dark:text-violet-400 dark:border-violet-800 dark:hover:bg-violet-950"
            >
              <Sparkles className="size-4" />
              AI 助手
            </Button>
          )}
          <Button size="sm" onClick={onCreateFolder}>
            <Plus className="size-4 mr-1" />
            新建文件夹
          </Button>
        </div>
      </div>

      {/* 快捷操作栏 */}
      <div className="flex-shrink-0 px-6 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
        <div className="flex items-center gap-3">
          {/* 搜索框 */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="搜索文件夹..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          {/* 排序 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <SortAsc className="size-4 mr-2" />
                {SORT_OPTIONS.find((o) => o.value === sortBy)?.label}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {SORT_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => setSortBy(option.value)}
                  className={sortBy === option.value ? "bg-accent" : ""}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 视图切换 */}
          <div
            className="flex items-center border rounded-lg overflow-hidden"
            role="group"
            aria-label="视图切换"
          >
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="sm"
              className="h-9 rounded-none"
              onClick={() => setViewMode("grid")}
              aria-label="网格视图"
              aria-pressed={viewMode === "grid"}
            >
              <LayoutGrid className="size-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className="h-9 rounded-none"
              onClick={() => setViewMode("list")}
              aria-label="列表视图"
              aria-pressed={viewMode === "list"}
            >
              <List className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-8">
          {/* 文件夹视图 - 根据 viewMode 切换 */}
          {filteredFolders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <p>
                {searchQuery
                  ? "没有找到匹配的文件夹"
                  : "暂无文件夹，点击上方按钮创建"}
              </p>
            </div>
          ) : viewMode === "grid" ? (
            <FolderCardGrid
              folders={filteredFolders}
              allFolders={folders}
              lockStatusMap={lockStatusMap}
              onActionComplete={onActionComplete}
              onFolderDeleted={onFolderDeleted}
              onFolderRenamed={onFolderRenamed}
              onFolderMerged={onFolderMerged}
              onExportFolder={onExportFolder}
            />
          ) : (
            <div className="space-y-2">
              {filteredFolders.map((folder) => (
                <FolderListItem
                  key={folder.id}
                  folder={folder}
                  allFolders={folders}
                  lockStatus={lockStatusMap[folder.id.toString()]}
                  onActionComplete={onActionComplete}
                  onFolderDeleted={onFolderDeleted}
                  onFolderRenamed={onFolderRenamed}
                  onFolderMerged={onFolderMerged}
                  onExportFolder={onExportFolder}
                />
              ))}
            </div>
          )}

          {/* 最近添加 */}
          {recentBookmarks.length > 0 && selectedGroup === "all" && (
            <div>
              <h3 className="text-base font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Clock className="size-4 text-muted-foreground" />
                最近添加
              </h3>
              <div className="space-y-2">
                {recentBookmarks.slice(0, 5).map((bookmark) => (
                  <Link key={bookmark.id} href={`/bookmark/${bookmark.id}`}>
                    <Card className="hover:shadow-sm hover:border-primary/20 transition-all">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          {bookmark.cover_url ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={bookmark.cover_url}
                              alt={bookmark.title}
                              className="w-12 h-12 object-cover rounded flex-shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center flex-shrink-0">
                              <Globe className="size-5 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">
                              {bookmark.title}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Folder className="size-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                {bookmark.folders?.name || "未分类"}
                              </span>
                            </div>
                          </div>
                          {bookmark.ai_tags && bookmark.ai_tags.length > 0 && (
                            <div className="hidden md:flex gap-1">
                              {bookmark.ai_tags.slice(0, 2).map((tag) => (
                                <Badge
                                  key={tag}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
