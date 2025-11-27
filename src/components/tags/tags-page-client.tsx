/**
 * 标签浏览页面客户端组件
 */

"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Tag, Search, Sparkles, User, TrendingUp, SortAsc } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorMessage } from "@/components/ui/error-message";
import type { TagWithCount } from "@/app/(main)/tags/page";
import { cn } from "@/lib/utils";

interface TagsPageClientProps {
  tags: TagWithCount[];
  error?: string;
}

type SortMode = "frequency" | "alphabetical";

export function TagsPageClient({ tags, error }: TagsPageClientProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("frequency");

  // 筛选和排序标签
  const filteredAndSortedTags = useMemo(() => {
    let result = tags;

    // 搜索筛选
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((item) => item.tag.toLowerCase().includes(query));
    }

    // 排序
    if (sortMode === "alphabetical") {
      result = [...result].sort((a, b) => a.tag.localeCompare(b.tag, "zh-CN"));
    }

    return result;
  }, [tags, searchQuery, sortMode]);

  // 点击标签跳转到搜索页面
  const handleTagClick = (tag: string) => {
    router.push(`/search?q=${encodeURIComponent(tag)}`);
  };

  // 获取标签的徽章样式
  const getTagBadgeClass = (type: TagWithCount["type"]) => {
    switch (type) {
      case "ai":
        return "bg-pink-100 dark:bg-pink-900/30 border-pink-200 dark:border-pink-700 text-pink-700 dark:text-pink-300 hover:bg-pink-200 dark:hover:bg-pink-900/50";
      case "user":
        return "bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50";
      case "both":
        return "bg-purple-100 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50";
    }
  };

  // 获取标签图标
  const getTagIcon = (type: TagWithCount["type"]) => {
    switch (type) {
      case "ai":
        return <Sparkles className="size-3" />;
      case "user":
        return <User className="size-3" />;
      case "both":
        return <Tag className="size-3" />;
    }
  };

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <ErrorMessage message={error} />
      </div>
    );
  }

  const totalTags = tags.length;
  const totalUsage = tags.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-8 py-4 md:py-6">
        <h2 className="text-gray-900 dark:text-white text-xl md:text-2xl font-semibold mb-2">
          标签浏览
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          共 {totalTags} 个标签，使用 {totalUsage} 次
        </p>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 md:px-8 py-6">
        <div className="max-w-6xl mx-auto">
          {/* 工具栏 */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            {/* 搜索框 */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索标签..."
                className="pl-10"
              />
            </div>

            {/* 排序选择 */}
            <Select
              value={sortMode}
              onValueChange={(value) => setSortMode(value as SortMode)}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="frequency">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="size-4" />
                    按频率排序
                  </div>
                </SelectItem>
                <SelectItem value="alphabetical">
                  <div className="flex items-center gap-2">
                    <SortAsc className="size-4" />
                    按字母排序
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 标签网格 */}
          {filteredAndSortedTags.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {filteredAndSortedTags.map((item) => (
                <Button
                  key={item.tag}
                  variant="outline"
                  size="lg"
                  onClick={() => handleTagClick(item.tag)}
                  className={cn(
                    "h-auto py-3 px-4 flex flex-col items-start gap-1 transition-all",
                    getTagBadgeClass(item.type),
                  )}
                >
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {getTagIcon(item.type)}
                    <span>{item.tag}</span>
                  </div>
                  <div className="text-xs opacity-75">{item.count} 个收藏</div>
                </Button>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <Tag className="size-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                {searchQuery
                  ? "没有找到匹配的标签"
                  : "还没有标签，去创建第一个收藏吧"}
              </p>
            </div>
          )}

          {/* 说明卡片 */}
          {tags.length > 0 && (
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-pink-50 dark:bg-pink-900/20 rounded-lg border border-pink-200 dark:border-pink-800">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="size-4 text-pink-600 dark:text-pink-400" />
                  <span className="font-medium text-pink-900 dark:text-pink-100">
                    AI 标签
                  </span>
                </div>
                <p className="text-xs text-pink-700 dark:text-pink-300">
                  由 AI 自动生成的内容标签
                </p>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-2">
                  <User className="size-4 text-blue-600 dark:text-blue-400" />
                  <span className="font-medium text-blue-900 dark:text-blue-100">
                    用户标签
                  </span>
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  由你手动添加的自定义标签
                </p>
              </div>

              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2 mb-2">
                  <Tag className="size-4 text-purple-600 dark:text-purple-400" />
                  <span className="font-medium text-purple-900 dark:text-purple-100">
                    混合标签
                  </span>
                </div>
                <p className="text-xs text-purple-700 dark:text-purple-300">
                  同时作为 AI 标签和用户标签
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
