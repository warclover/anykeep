/**
 * 搜索过滤器面板组件
 *
 * 提供手动选择过滤条件的界面
 * 支持平台、时间范围、内容类型、状态等多维度过滤
 *
 * @version 1.0.0
 * @since 2026-01-07
 */

"use client";

import { useCallback, memo } from "react";
import {
  Filter,
  Clock,
  Globe,
  FileType,
  Star,
  BookOpen,
  ArrowUpDown,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ============================================
// 类型定义
// ============================================

export interface SearchFilters {
  /** 平台过滤 */
  platform?: string;
  /** 时间范围 */
  timeRange?: "today" | "week" | "month" | "3months" | "year" | "all";
  /** 内容类型 */
  contentType?: string;
  /** 已读状态 */
  readStatus?: "all" | "read" | "unread";
  /** 星标状态 */
  starredOnly?: boolean;
  /** 排序方式 */
  sortBy?: "relevance" | "time" | "title";
  /** 排序方向 */
  sortOrder?: "asc" | "desc";
}

export interface SearchFilterPanelProps {
  /** 当前过滤条件 */
  filters: SearchFilters;
  /** 过滤条件变更回调 */
  onFiltersChange: (filters: SearchFilters) => void;
  /** 自定义类名 */
  className?: string;
}

// ============================================
// 常量配置
// ============================================

const PLATFORMS = [
  { value: "_all", label: "全部平台" },
  { value: "wechat", label: "微信" },
  { value: "bilibili", label: "B站" },
  { value: "xiaohongshu", label: "小红书" },
  { value: "zhihu", label: "知乎" },
  { value: "juejin", label: "掘金" },
  { value: "csdn", label: "CSDN" },
  { value: "github", label: "GitHub" },
  { value: "twitter", label: "Twitter" },
  { value: "browser", label: "浏览器书签" },
];

const TIME_RANGES = [
  { value: "all", label: "全部时间" },
  { value: "today", label: "今天" },
  { value: "week", label: "本周" },
  { value: "month", label: "本月" },
  { value: "3months", label: "近三月" },
  { value: "year", label: "今年" },
];

const CONTENT_TYPES = [
  { value: "_all", label: "全部类型" },
  { value: "article", label: "文章" },
  { value: "video", label: "视频" },
  { value: "image", label: "图片" },
  { value: "audio", label: "音频" },
  { value: "document", label: "文档" },
  { value: "code", label: "代码" },
];

const READ_STATUS_OPTIONS = [
  { value: "all", label: "全部状态" },
  { value: "unread", label: "未读" },
  { value: "read", label: "已读" },
];

const SORT_OPTIONS = [
  { value: "relevance", label: "相关度" },
  { value: "time", label: "时间" },
  { value: "title", label: "标题" },
];

// ============================================
// 主组件
// ============================================

/**
 * 搜索过滤器面板
 */
export const SearchFilterPanel = memo(function SearchFilterPanel({
  filters,
  onFiltersChange,
  className,
}: SearchFilterPanelProps) {
  /**
   * 更新单个过滤条件
   */
  const updateFilter = useCallback(
    <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
      onFiltersChange({
        ...filters,
        [key]: value,
      });
    },
    [filters, onFiltersChange],
  );

  /**
   * 清除所有过滤条件
   */
  const clearAllFilters = useCallback(() => {
    onFiltersChange({
      platform: "",
      timeRange: "all",
      contentType: "",
      readStatus: "all",
      starredOnly: false,
      sortBy: "relevance",
      sortOrder: "desc",
    });
  }, [onFiltersChange]);

  /**
   * 计算激活的过滤器数量
   */
  const activeFilterCount = [
    filters.platform && filters.platform !== "" && filters.platform !== "_all",
    filters.timeRange && filters.timeRange !== "all",
    filters.contentType &&
      filters.contentType !== "" &&
      filters.contentType !== "_all",
    filters.readStatus && filters.readStatus !== "all",
    filters.starredOnly,
  ].filter(Boolean).length;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {/* 过滤器标签 */}
      <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
        <Filter className="size-4" />
        <span>筛选</span>
        {activeFilterCount > 0 && (
          <Badge variant="secondary" className="h-5 px-1.5 text-xs">
            {activeFilterCount}
          </Badge>
        )}
      </div>

      {/* 平台过滤器 */}
      <Select
        value={filters.platform || "_all"}
        onValueChange={(v) => updateFilter("platform", v === "_all" ? "" : v)}
      >
        <SelectTrigger
          className={cn(
            "h-8 w-auto min-w-[100px] gap-1.5",
            filters.platform &&
              filters.platform !== "" &&
              filters.platform !== "_all"
              ? "border-purple-300 bg-purple-50 dark:border-purple-700 dark:bg-purple-900/30"
              : "",
          )}
        >
          <Globe className="size-3.5 shrink-0" />
          <SelectValue placeholder="平台" />
        </SelectTrigger>
        <SelectContent>
          {PLATFORMS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 时间范围过滤器 */}
      <Select
        value={filters.timeRange || "all"}
        onValueChange={(v) =>
          updateFilter("timeRange", v as SearchFilters["timeRange"])
        }
      >
        <SelectTrigger
          className={cn(
            "h-8 w-auto min-w-[100px] gap-1.5",
            filters.timeRange && filters.timeRange !== "all"
              ? "border-purple-300 bg-purple-50 dark:border-purple-700 dark:bg-purple-900/30"
              : "",
          )}
        >
          <Clock className="size-3.5 shrink-0" />
          <SelectValue placeholder="时间" />
        </SelectTrigger>
        <SelectContent>
          {TIME_RANGES.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 内容类型过滤器 */}
      <Select
        value={filters.contentType || "_all"}
        onValueChange={(v) =>
          updateFilter("contentType", v === "_all" ? "" : v)
        }
      >
        <SelectTrigger
          className={cn(
            "h-8 w-auto min-w-[100px] gap-1.5",
            filters.contentType &&
              filters.contentType !== "" &&
              filters.contentType !== "_all"
              ? "border-purple-300 bg-purple-50 dark:border-purple-700 dark:bg-purple-900/30"
              : "",
          )}
        >
          <FileType className="size-3.5 shrink-0" />
          <SelectValue placeholder="类型" />
        </SelectTrigger>
        <SelectContent>
          {CONTENT_TYPES.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 已读状态过滤器 */}
      <Select
        value={filters.readStatus || "all"}
        onValueChange={(v) =>
          updateFilter("readStatus", v as SearchFilters["readStatus"])
        }
      >
        <SelectTrigger
          className={cn(
            "h-8 w-auto min-w-[100px] gap-1.5",
            filters.readStatus && filters.readStatus !== "all"
              ? "border-purple-300 bg-purple-50 dark:border-purple-700 dark:bg-purple-900/30"
              : "",
          )}
        >
          <BookOpen className="size-3.5 shrink-0" />
          <SelectValue placeholder="阅读状态" />
        </SelectTrigger>
        <SelectContent>
          {READ_STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 星标过滤器 */}
      <Button
        variant="outline"
        size="sm"
        className={cn(
          "h-8 gap-1.5 font-normal",
          filters.starredOnly
            ? "border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/30"
            : "",
        )}
        onClick={() => updateFilter("starredOnly", !filters.starredOnly)}
      >
        <Star
          className={cn(
            "size-3.5",
            filters.starredOnly ? "fill-yellow-400 text-yellow-400" : "",
          )}
        />
        <span>星标</span>
      </Button>

      {/* 排序选择器 */}
      <div className="flex items-center gap-1 ml-auto">
        <Select
          value={filters.sortBy || "relevance"}
          onValueChange={(v) =>
            updateFilter("sortBy", v as SearchFilters["sortBy"])
          }
        >
          <SelectTrigger className="h-8 w-auto min-w-[90px] gap-1.5">
            <ArrowUpDown className="size-3.5 shrink-0" />
            <SelectValue placeholder="排序" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() =>
            updateFilter(
              "sortOrder",
              filters.sortOrder === "asc" ? "desc" : "asc",
            )
          }
          title={filters.sortOrder === "asc" ? "升序" : "降序"}
        >
          <ArrowUpDown
            className={cn(
              "size-4 transition-transform",
              filters.sortOrder === "asc" ? "rotate-180" : "",
            )}
          />
        </Button>
      </div>

      {/* 清除所有过滤器 */}
      {activeFilterCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          onClick={clearAllFilters}
        >
          <X className="size-3.5" />
          <span>清除</span>
        </Button>
      )}
    </div>
  );
});

export default SearchFilterPanel;
