/**
 * 提取的过滤器徽章组件
 *
 * 展示单个智能提取的过滤器
 *
 * @version 1.0.0
 * @since 2026-01-02
 */

"use client";

import { Badge } from "@/components/ui/badge";
import {
  Clock,
  Globe,
  Tag,
  Folder,
  Star,
  BookOpen,
  FileType,
  ArrowUpDown,
  Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 序列化后的过滤器类型（从 API 返回）
 */
export interface SerializedFilter {
  type: string;
  expression: string;
  // 时间范围
  start?: string;
  end?: string;
  // 平台
  platform?: string;
  // 标签
  tags?: string[];
  matchMode?: "all" | "any";
  // 文件夹
  folderName?: string;
  folderId?: number;
  includeSubfolders?: boolean;
  // 星标
  isStarred?: boolean;
  // 已读状态
  isRead?: boolean;
  // 内容类型
  contentType?: string;
  // 排序
  field?: string;
  direction?: "asc" | "desc";
  // 数量限制
  count?: number;
}

interface ExtractedFilterBadgeProps {
  filter: SerializedFilter;
  className?: string;
}

/**
 * 过滤器类型配置
 */
const FILTER_CONFIG: Record<
  string,
  {
    icon: typeof Clock;
    label: string;
    colorClass: string;
  }
> = {
  time_range: {
    icon: Clock,
    label: "时间",
    colorClass:
      "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300",
  },
  platform: {
    icon: Globe,
    label: "平台",
    colorClass:
      "bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300",
  },
  tag: {
    icon: Tag,
    label: "标签",
    colorClass:
      "bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300",
  },
  folder: {
    icon: Folder,
    label: "文件夹",
    colorClass:
      "bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300",
  },
  starred: {
    icon: Star,
    label: "星标",
    colorClass:
      "bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300",
  },
  read_status: {
    icon: BookOpen,
    label: "阅读状态",
    colorClass:
      "bg-cyan-50 dark:bg-cyan-900/30 border-cyan-200 dark:border-cyan-700 text-cyan-700 dark:text-cyan-300",
  },
  content_type: {
    icon: FileType,
    label: "类型",
    colorClass:
      "bg-pink-50 dark:bg-pink-900/30 border-pink-200 dark:border-pink-700 text-pink-700 dark:text-pink-300",
  },
  sort: {
    icon: ArrowUpDown,
    label: "排序",
    colorClass:
      "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300",
  },
  limit: {
    icon: Hash,
    label: "数量",
    colorClass:
      "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300",
  },
};

/**
 * 平台名称映射
 */
const PLATFORM_NAMES: Record<string, string> = {
  wechat: "微信",
  bilibili: "B站",
  xiaohongshu: "小红书",
  zhihu: "知乎",
  juejin: "掘金",
  csdn: "CSDN",
  browser: "浏览器",
  twitter: "Twitter",
  github: "GitHub",
};

/**
 * 内容类型名称映射
 */
const CONTENT_TYPE_NAMES: Record<string, string> = {
  article: "文章",
  video: "视频",
  image: "图片",
  audio: "音频",
  document: "文档",
  code: "代码",
};

/**
 * 获取过滤器显示文本
 */
function getFilterDisplayText(filter: SerializedFilter): string {
  switch (filter.type) {
    case "time_range":
      return filter.expression;
    case "platform":
      return PLATFORM_NAMES[filter.platform || ""] || filter.expression;
    case "tag":
      if (filter.tags && filter.tags.length > 0) {
        return filter.tags.join(", ");
      }
      return filter.expression;
    case "folder":
      return filter.folderName || filter.expression;
    case "starred":
      return "星标";
    case "read_status":
      return filter.isRead ? "已读" : "未读";
    case "content_type":
      return CONTENT_TYPE_NAMES[filter.contentType || ""] || filter.expression;
    case "sort":
      const fieldName =
        {
          time: "时间",
          relevance: "相关度",
          title: "标题",
          visits: "访问量",
        }[filter.field || ""] || filter.field;
      const directionName = filter.direction === "asc" ? "升序" : "降序";
      return `${fieldName}${directionName}`;
    case "limit":
      return `前${filter.count}条`;
    default:
      return filter.expression;
  }
}

export function ExtractedFilterBadge({
  filter,
  className,
}: ExtractedFilterBadgeProps) {
  const config = FILTER_CONFIG[filter.type] || FILTER_CONFIG.limit;
  const Icon = config.icon;
  const displayText = getFilterDisplayText(filter);

  return (
    <Badge
      variant="outline"
      className={cn("gap-1 font-normal", config.colorClass, className)}
    >
      <Icon className="size-3" />
      <span>{displayText}</span>
    </Badge>
  );
}
