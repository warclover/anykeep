/**
 * 标签浏览页面客户端组件 - 分组卡片视图
 *
 * @version 2.0.0
 * @since 2025-12-29
 * @description 重构为分组卡片视图，支持热门标签区和类型分组折叠
 */

"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Tag,
  Search,
  Sparkles,
  User,
  TrendingUp,
  SortAsc,
  ChevronDown,
  ChevronRight,
  Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ErrorMessage } from "@/components/ui/error-message";
import type { TagWithCount } from "@/app/(main)/tags/page";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface TagsPageClientProps {
  tags: TagWithCount[];
  error?: string;
}

type SortMode = "frequency" | "alphabetical";

interface TagGroupConfig {
  type: TagWithCount["type"];
  title: string;
  icon: React.ReactNode;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}

// ============================================================================
// Constants
// ============================================================================

const TOP_TAGS_COUNT = 10;

const TAG_GROUP_CONFIGS: TagGroupConfig[] = [
  {
    type: "ai",
    title: "AI 标签",
    icon: <Sparkles className="size-4" />,
    colorClass: "text-pink-600 dark:text-pink-400",
    bgClass: "bg-pink-50 dark:bg-pink-900/20",
    borderClass: "border-pink-200 dark:border-pink-800",
  },
  {
    type: "user",
    title: "用户标签",
    icon: <User className="size-4" />,
    colorClass: "text-blue-600 dark:text-blue-400",
    bgClass: "bg-blue-50 dark:bg-blue-900/20",
    borderClass: "border-blue-200 dark:border-blue-800",
  },
  {
    type: "both",
    title: "混合标签",
    icon: <Tag className="size-4" />,
    colorClass: "text-purple-600 dark:text-purple-400",
    bgClass: "bg-purple-50 dark:bg-purple-900/20",
    borderClass: "border-purple-200 dark:border-purple-800",
  },
];

// ============================================================================
// Components
// ============================================================================

/**
 * 单个标签按钮
 */
function TagButton({
  item,
  onClick,
  size = "default",
}: {
  item: TagWithCount;
  onClick: () => void;
  size?: "default" | "large";
}) {
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

  return (
    <Button
      variant="outline"
      size={size === "large" ? "lg" : "default"}
      onClick={onClick}
      className={cn(
        "h-auto transition-all border",
        size === "large"
          ? "py-2.5 px-3 flex flex-col items-start gap-0.5"
          : "py-1.5 px-2.5 flex items-center gap-1.5",
        getTagBadgeClass(item.type),
      )}
    >
      {size === "large" ? (
        <>
          <div className="flex items-center gap-1.5 text-xs font-medium">
            {getTagIcon(item.type)}
            <span>{item.tag}</span>
          </div>
          <div className="text-[10px] opacity-75">{item.count} 个收藏</div>
        </>
      ) : (
        <>
          {getTagIcon(item.type)}
          <span className="text-xs">{item.tag}</span>
          <span className="text-[10px] opacity-60">({item.count})</span>
        </>
      )}
    </Button>
  );
}

/**
 * 热门标签区
 */
function HotTagsSection({
  tags,
  onTagClick,
}: {
  tags: TagWithCount[];
  onTagClick: (tag: string) => void;
}) {
  if (tags.length === 0) return null;

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Flame className="size-5 text-orange-500" />
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          热门标签
        </h3>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Top {tags.length}
        </span>
      </div>
      <div className="flex flex-wrap gap-3">
        {tags.map((item) => (
          <TagButton
            key={item.tag}
            item={item}
            onClick={() => onTagClick(item.tag)}
            size="large"
          />
        ))}
      </div>
    </section>
  );
}

/**
 * 标签分组（可折叠）
 */
function TagGroup({
  config,
  tags,
  onTagClick,
  defaultOpen = false,
}: {
  config: TagGroupConfig;
  tags: TagWithCount[];
  onTagClick: (tag: string) => void;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (tags.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-4">
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            "w-full flex items-center justify-between p-4 rounded-lg border transition-colors",
            "hover:bg-gray-50 dark:hover:bg-gray-800/50",
            config.bgClass,
            config.borderClass,
          )}
        >
          <div className="flex items-center gap-3">
            <span className={config.colorClass}>{config.icon}</span>
            <span className={cn("text-sm font-medium", config.colorClass)}>
              {config.title}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ({tags.length})
            </span>
          </div>
          {isOpen ? (
            <ChevronDown className="size-5 text-gray-400" />
          ) : (
            <ChevronRight className="size-5 text-gray-400" />
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-3 ml-4 flex flex-wrap gap-2">
          {tags.map((item) => (
            <TagButton
              key={item.tag}
              item={item}
              onClick={() => onTagClick(item.tag)}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function TagsPageClient({ tags, error }: TagsPageClientProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("frequency");

  // 筛选和排序标签
  const filteredTags = useMemo(() => {
    let result = tags;

    // 搜索筛选
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((item) => item.tag.toLowerCase().includes(query));
    }

    // 排序
    if (sortMode === "alphabetical") {
      result = [...result].sort((a, b) => a.tag.localeCompare(b.tag, "zh-CN"));
    } else {
      result = [...result].sort((a, b) => b.count - a.count);
    }

    return result;
  }, [tags, searchQuery, sortMode]);

  // 热门标签（Top N，仅在无搜索时显示）
  const hotTags = useMemo(() => {
    if (searchQuery.trim()) return [];
    return [...tags].sort((a, b) => b.count - a.count).slice(0, TOP_TAGS_COUNT);
  }, [tags, searchQuery]);

  // 按类型分组（排除热门标签）
  const groupedTags = useMemo(() => {
    const hotTagSet = new Set(hotTags.map((t) => t.tag));
    const filtered = filteredTags.filter((t) => !hotTagSet.has(t.tag));

    return TAG_GROUP_CONFIGS.map((config) => ({
      config,
      tags: filtered.filter((t) => t.type === config.type),
    }));
  }, [filteredTags, hotTags]);

  // 点击标签跳转到搜索页面
  const handleTagClick = (tag: string) => {
    router.push(`/search?q=${encodeURIComponent(tag)}`);
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
        <h2 className="text-gray-900 dark:text-white text-lg md:text-xl font-semibold mb-1">
          标签浏览
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-xs">
          共 {totalTags} 个标签，使用 {totalUsage} 次
        </p>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 md:px-8 py-6">
        <div className="max-w-4xl mx-auto">
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
              <SelectTrigger className="w-full sm:w-[160px]">
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

          {/* 内容区 */}
          {filteredTags.length > 0 ? (
            <>
              {/* 热门标签区（搜索时隐藏） */}
              {!searchQuery.trim() && (
                <HotTagsSection tags={hotTags} onTagClick={handleTagClick} />
              )}

              {/* 分隔线 */}
              {!searchQuery.trim() && hotTags.length > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-700 my-6" />
              )}

              {/* 分组标签 */}
              <section>
                {!searchQuery.trim() && (
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">
                    按类型浏览
                  </h3>
                )}
                {groupedTags.map(({ config, tags: groupTags }) => (
                  <TagGroup
                    key={config.type}
                    config={config}
                    tags={groupTags}
                    onTagClick={handleTagClick}
                    defaultOpen={searchQuery.trim().length > 0}
                  />
                ))}
              </section>
            </>
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
        </div>
      </div>
    </div>
  );
}
