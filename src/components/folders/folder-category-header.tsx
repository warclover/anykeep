/**
 * 栏目标题组件
 *
 * 从 folder-nav-panel.tsx 提取
 */

"use client";

import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CategoryActionMenu } from "./category-action-menu";
import { getCategoryEmoji } from "./constants";
import type { FolderCategory } from "@/types/domain";

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

export function CategoryHeader({
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
