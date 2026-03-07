/**
 * 文件夹导航头部
 * 可独立用于工具栏行
 *
 * 从 folder-nav-panel.tsx 提取
 */

"use client";

import { Plus, FolderPlus, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
