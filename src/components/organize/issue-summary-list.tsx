/**
 * 问题摘要列表组件
 *
 * 显示健康分析发现的问题摘要，每类最多显示指定条数
 *
 * @version 1.0.0
 * @since 2026-01-31
 */

"use client";

import {
  GitMerge,
  FolderX,
  FolderOpen,
  PenLine,
  PlusCircle,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  DuplicateFolderGroup,
  OversizedFolder,
  PoorlyNamedFolder,
  MissingCategory,
  Folder,
} from "@/hooks/domain/folder/use-librarian-analysis";

// ============================================================================
// 类型定义
// ============================================================================

export type IssueType =
  | "duplicates"
  | "empty"
  | "oversized"
  | "naming"
  | "missing";

export type ActionType = "merge" | "delete" | "split" | "rename" | "create";

interface IssueSummaryListProps {
  duplicateFolders: DuplicateFolderGroup[];
  emptyFolders: Folder[];
  oversizedFolders: OversizedFolder[];
  poorlyNamedFolders: PoorlyNamedFolder[];
  missingCategories: MissingCategory[];
  maxItemsPerCategory?: number;
  onViewAll?: () => void;
  onAction?: (type: IssueType, itemId: number, action: ActionType) => void;
  disabled?: boolean;
}

interface IssueCategory {
  type: IssueType;
  icon: typeof GitMerge;
  label: string;
  count: number;
  items: React.ReactNode[];
  color: string;
}

// ============================================================================
// 子组件
// ============================================================================

function IssueCategorySection({
  category,
  maxItems,
  onViewAll,
}: {
  category: IssueCategory;
  maxItems: number;
  onViewAll?: () => void;
}) {
  if (category.count === 0) return null;

  const Icon = category.icon;
  const displayItems = category.items.slice(0, maxItems);
  const hasMore = category.count > maxItems;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", category.color)} />
        <span className="text-sm font-medium">{category.label}</span>
        <Badge variant="secondary" className="ml-auto">
          {category.count}
        </Badge>
      </div>
      <div className="space-y-1.5 pl-6">{displayItems}</div>
      {hasMore && onViewAll && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs text-muted-foreground hover:text-foreground"
          onClick={onViewAll}
        >
          查看更多 ({category.count - maxItems} 项)
          <ChevronRight className="h-3 w-3 ml-1" />
        </Button>
      )}
    </div>
  );
}

function IssueItem({
  children,
  action,
  actionLabel,
  onAction,
  disabled,
}: {
  children: React.ReactNode;
  action?: ActionType;
  actionLabel?: string;
  onAction?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
      <span className="text-muted-foreground truncate flex-1">{children}</span>
      {action && actionLabel && onAction && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={onAction}
          disabled={disabled}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

// ============================================================================
// 主组件
// ============================================================================

export function IssueSummaryList({
  duplicateFolders,
  emptyFolders,
  oversizedFolders,
  poorlyNamedFolders,
  missingCategories,
  maxItemsPerCategory = 2,
  onViewAll,
  onAction,
  disabled,
}: IssueSummaryListProps) {
  const totalIssues =
    duplicateFolders.length +
    emptyFolders.length +
    oversizedFolders.length +
    poorlyNamedFolders.length +
    missingCategories.length;

  if (totalIssues === 0) {
    return (
      <div className="text-center py-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-3">
          <PlusCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
        </div>
        <p className="text-sm font-medium">文件夹结构非常健康！</p>
        <p className="text-xs text-muted-foreground mt-1">暂无需要优化的问题</p>
      </div>
    );
  }

  const categories: IssueCategory[] = [
    {
      type: "duplicates",
      icon: GitMerge,
      label: "重复文件夹",
      count: duplicateFolders.length,
      color: "text-orange-500",
      items: duplicateFolders.map((group, index) => (
        <IssueItem
          key={`dup-${index}`}
          action="merge"
          actionLabel="合并"
          onAction={() => onAction?.("duplicates", index, "merge")}
          disabled={disabled}
        >
          {group.folders.map((f) => f.name).join(" ≈ ")}
          <span className="text-xs ml-1">
            ({(group.similarity * 100).toFixed(0)}%)
          </span>
        </IssueItem>
      )),
    },
    {
      type: "empty",
      icon: FolderX,
      label: "空文件夹",
      count: emptyFolders.length,
      color: "text-gray-500",
      items: emptyFolders.map((folder) => (
        <IssueItem
          key={`empty-${folder.id}`}
          action="delete"
          actionLabel="清理"
          onAction={() => onAction?.("empty", folder.id, "delete")}
          disabled={disabled}
        >
          {folder.name}
        </IssueItem>
      )),
    },
    {
      type: "oversized",
      icon: FolderOpen,
      label: "过大文件夹",
      count: oversizedFolders.length,
      color: "text-blue-500",
      items: oversizedFolders.map((item) => (
        <IssueItem
          key={`oversized-${item.folder.id}`}
          action="split"
          actionLabel="拆分"
          onAction={() => onAction?.("oversized", item.folder.id, "split")}
          disabled={disabled}
        >
          {item.folder.name}
          <Badge variant="outline" className="ml-2 text-xs">
            {item.bookmarkCount} 条
          </Badge>
        </IssueItem>
      )),
    },
    {
      type: "naming",
      icon: PenLine,
      label: "命名问题",
      count: poorlyNamedFolders.length,
      color: "text-yellow-500",
      items: poorlyNamedFolders.map((item) => (
        <IssueItem
          key={`naming-${item.folder.id}`}
          action="rename"
          actionLabel="重命名"
          onAction={() => onAction?.("naming", item.folder.id, "rename")}
          disabled={disabled}
        >
          {item.folder.name} → {item.suggestedName}
        </IssueItem>
      )),
    },
    {
      type: "missing",
      icon: PlusCircle,
      label: "缺失分类",
      count: missingCategories.length,
      color: "text-purple-500",
      items: missingCategories.map((item, index) => (
        <IssueItem
          key={`missing-${index}`}
          action="create"
          actionLabel="创建"
          onAction={() => onAction?.("missing", index, "create")}
          disabled={disabled}
        >
          {item.category}
          <span className="text-xs ml-1">({item.bookmarkCount} 条相关)</span>
        </IssueItem>
      )),
    },
  ];

  // 按问题数量排序，优先显示问题多的类别
  const sortedCategories = categories
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-4">
      {sortedCategories.map((category) => (
        <IssueCategorySection
          key={category.type}
          category={category}
          maxItems={maxItemsPerCategory}
          onViewAll={onViewAll}
        />
      ))}

      {onViewAll && totalIssues > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onViewAll}
        >
          查看全部问题 ({totalIssues})
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      )}
    </div>
  );
}
