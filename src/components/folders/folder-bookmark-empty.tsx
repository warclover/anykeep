/**
 * 文件夹书签区域 - 空状态组件
 */

import { Search, FolderOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FolderSelection } from "./types";

interface FolderBookmarkEmptyProps {
  hasSearch: boolean;
  selectionTitle: string;
  selectionType?: FolderSelection["type"];
  onCreateBookmark?: () => void;
}

export function FolderBookmarkEmpty({
  hasSearch,
  selectionTitle,
  selectionType,
  onCreateBookmark,
}: FolderBookmarkEmptyProps) {
  if (hasSearch) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Search className="size-12 mb-4 opacity-50" />
        <p className="text-sm">没有找到匹配的书签</p>
        <p className="text-xs mt-1">尝试使用不同的关键词搜索</p>
      </div>
    );
  }

  // 栏目下没有文件夹或文件夹为空时，给出区分提示
  const isCategory = selectionType === "category" || selectionType === "group";
  const hint = isCategory
    ? "在此栏目下创建文件夹并添加收藏"
    : "添加第一个收藏开始整理吧";

  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <FolderOpen className="size-12 mb-4 opacity-50" />
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
        「{selectionTitle}」暂无收藏
      </p>
      <p className="text-xs mt-1">{hint}</p>
      {onCreateBookmark && (
        <Button size="sm" className="mt-4" onClick={onCreateBookmark}>
          <Plus className="size-4 mr-1" />
          添加收藏
        </Button>
      )}
    </div>
  );
}
