/**
 * 搜索空状态：标题、搜索历史、热门标签
 *
 * 从 search-page-client.tsx 提取
 */

"use client";

import { Search, Clock, Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SearchEmptyStateProps {
  searchHistory: string[];
  hotTags: string[];
  onTagClick: (tag: string) => void;
  onClearHistory: () => void;
}

export function SearchEmptyState({
  searchHistory,
  hotTags,
  onTagClick,
  onClearHistory,
}: SearchEmptyStateProps) {
  return (
    <>
      {/* 空状态标题区域 */}
      <div className="flex flex-col items-center text-center mb-6 pt-4">
        <div className="w-14 h-14 bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/40 dark:to-purple-800/20 rounded-full flex items-center justify-center mb-3">
          <Search className="size-7 text-purple-500 dark:text-purple-400" />
        </div>
        <h2 className="text-gray-900 dark:text-white text-xl md:text-2xl font-semibold mb-2">
          开始搜索你的收藏
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm max-w-md">
          搜索标题、作者或摘要，支持 AI 语义匹配
        </p>
      </div>

      {/* 搜索历史 */}
      <div className={searchHistory.length > 0 ? "mb-6" : "hidden"}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <Clock className="size-4" />
            搜索历史
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearHistory}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            清空
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {searchHistory.map((item, index) => (
            <Badge
              key={index}
              variant="outline"
              className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={() => onTagClick(item)}
            >
              {item}
            </Badge>
          ))}
        </div>
      </div>

      {/* 热门标签 */}
      <div className={hotTags.length > 0 ? "mb-6" : "hidden"}>
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          <Flame className="size-4 text-orange-500" />
          热门标签
        </div>
        <div className="flex flex-wrap gap-2">
          {hotTags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/50 text-sm"
              onClick={() => onTagClick(tag)}
            >
              {tag}
            </Badge>
          ))}
        </div>
      </div>
    </>
  );
}
