/**
 * Source Badge Component
 * V4.2 来源信息徽章组件
 *
 * @description 显示书签的来源信息
 * - 显示来源名称和图标
 * - 支持多种来源类型（微信、知乎、小红书等）
 * - 点击可查看来源详情
 * - 支持来源置信度显示
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

"use client";

import { useMemo } from "react";
import {
  Globe,
  FileText,
  Video,
  Image as ImageIcon,
  Music,
  BookOpen,
  Newspaper,
  MessageSquare,
  ShoppingBag,
  Github,
  Twitter,
  Linkedin,
  Youtube,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ============================================================================
// 类型定义
// ============================================================================

export interface SourceInfo {
  /** 来源 ID */
  sourceId: string;
  /** 来源名称 */
  sourceName?: string;
  /** 来源域名 */
  domain?: string;
  /** 来源类型 */
  sourceType?: SourceType;
  /** 来源图标 URL */
  iconUrl?: string;
  /** 置信度（来源匹配时） */
  confidence?: number;
}

export type SourceType =
  | "wechat" // 微信公众号
  | "zhihu" // 知乎
  | "xiaohongshu" // 小红书
  | "bilibili" // B站
  | "weibo" // 微博
  | "douyin" // 抖音
  | "taobao" // 淘宝
  | "jd" // 京东
  | "github" // GitHub
  | "twitter" // Twitter/X
  | "youtube" // YouTube
  | "linkedin" // LinkedIn
  | "medium" // Medium
  | "news" // 新闻网站
  | "blog" // 博客
  | "forum" // 论坛
  | "ecommerce" // 电商
  | "video" // 视频
  | "music" // 音乐
  | "image" // 图片
  | "document" // 文档
  | "unknown"; // 未知

export interface SourceBadgeProps {
  /** 来源信息 */
  source: SourceInfo;
  /** 尺寸 */
  size?: "sm" | "md" | "lg";
  /** 是否显示详情（Tooltip） */
  showTooltip?: boolean;
  /** 是否显示置信度 */
  showConfidence?: boolean;
  /** 点击回调 */
  onClick?: () => void;
  /** 额外样式 */
  className?: string;
}

// ============================================================================
// 来源配置
// ============================================================================

const SOURCE_CONFIG: Record<
  SourceType,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bgColor: string;
  }
> = {
  wechat: {
    label: "微信公众号",
    icon: MessageSquare,
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-950/30",
  },
  zhihu: {
    label: "知乎",
    icon: BookOpen,
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
  },
  xiaohongshu: {
    label: "小红书",
    icon: BookOpen,
    color: "text-red-500",
    bgColor: "bg-red-50 dark:bg-red-950/30",
  },
  bilibili: {
    label: "B站",
    icon: Video,
    color: "text-pink-500",
    bgColor: "bg-pink-50 dark:bg-pink-950/30",
  },
  weibo: {
    label: "微博",
    icon: MessageSquare,
    color: "text-orange-500",
    bgColor: "bg-orange-50 dark:bg-orange-950/30",
  },
  douyin: {
    label: "抖音",
    icon: Video,
    color: "text-gray-900 dark:text-white",
    bgColor: "bg-gray-100 dark:bg-gray-800",
  },
  taobao: {
    label: "淘宝",
    icon: ShoppingBag,
    color: "text-orange-600",
    bgColor: "bg-orange-50 dark:bg-orange-950/30",
  },
  jd: {
    label: "京东",
    icon: ShoppingBag,
    color: "text-red-600",
    bgColor: "bg-red-50 dark:bg-red-950/30",
  },
  github: {
    label: "GitHub",
    icon: Github,
    color: "text-gray-900 dark:text-white",
    bgColor: "bg-gray-100 dark:bg-gray-800",
  },
  twitter: {
    label: "Twitter",
    icon: Twitter,
    color: "text-sky-500",
    bgColor: "bg-sky-50 dark:bg-sky-950/30",
  },
  youtube: {
    label: "YouTube",
    icon: Youtube,
    color: "text-red-600",
    bgColor: "bg-red-50 dark:bg-red-950/30",
  },
  linkedin: {
    label: "LinkedIn",
    icon: Linkedin,
    color: "text-blue-700",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
  },
  medium: {
    label: "Medium",
    icon: FileText,
    color: "text-gray-900 dark:text-white",
    bgColor: "bg-gray-100 dark:bg-gray-800",
  },
  news: {
    label: "新闻",
    icon: Newspaper,
    color: "text-gray-700",
    bgColor: "bg-gray-50 dark:bg-gray-800",
  },
  blog: {
    label: "博客",
    icon: FileText,
    color: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-950/30",
  },
  forum: {
    label: "论坛",
    icon: MessageSquare,
    color: "text-amber-600",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
  },
  ecommerce: {
    label: "电商",
    icon: ShoppingBag,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
  },
  video: {
    label: "视频",
    icon: Video,
    color: "text-violet-600",
    bgColor: "bg-violet-50 dark:bg-violet-950/30",
  },
  music: {
    label: "音乐",
    icon: Music,
    color: "text-rose-600",
    bgColor: "bg-rose-50 dark:bg-rose-950/30",
  },
  image: {
    label: "图片",
    icon: ImageIcon,
    color: "text-cyan-600",
    bgColor: "bg-cyan-50 dark:bg-cyan-950/30",
  },
  document: {
    label: "文档",
    icon: FileText,
    color: "text-indigo-600",
    bgColor: "bg-indigo-50 dark:bg-indigo-950/30",
  },
  unknown: {
    label: "网页",
    icon: Globe,
    color: "text-gray-500",
    bgColor: "bg-gray-50 dark:bg-gray-800",
  },
};

// 域名到来源类型映射
const DOMAIN_TO_SOURCE: Record<string, SourceType> = {
  "mp.weixin.qq.com": "wechat",
  "weixin.qq.com": "wechat",
  "zhihu.com": "zhihu",
  "zhuanlan.zhihu.com": "zhihu",
  "xiaohongshu.com": "xiaohongshu",
  "xhslink.com": "xiaohongshu",
  "bilibili.com": "bilibili",
  "b23.tv": "bilibili",
  "weibo.com": "weibo",
  "weibo.cn": "weibo",
  "douyin.com": "douyin",
  "taobao.com": "taobao",
  "tmall.com": "taobao",
  "jd.com": "jd",
  "github.com": "github",
  "twitter.com": "twitter",
  "x.com": "twitter",
  "youtube.com": "youtube",
  "youtu.be": "youtube",
  "linkedin.com": "linkedin",
  "medium.com": "medium",
};

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 从域名推断来源类型
 */
export function inferSourceType(domain: string): SourceType {
  const normalizedDomain = domain.toLowerCase().replace(/^www\./, "");

  // 精确匹配
  if (DOMAIN_TO_SOURCE[normalizedDomain]) {
    return DOMAIN_TO_SOURCE[normalizedDomain];
  }

  // 部分匹配
  for (const [key, type] of Object.entries(DOMAIN_TO_SOURCE)) {
    if (normalizedDomain.includes(key)) {
      return type;
    }
  }

  return "unknown";
}

/**
 * 从 URL 提取域名
 */
function _extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

// ============================================================================
// 组件实现
// ============================================================================

export function SourceBadge({
  source,
  size = "sm",
  showTooltip = true,
  showConfidence = false,
  onClick,
  className,
}: SourceBadgeProps) {
  // 推断来源类型
  const sourceType = useMemo(() => {
    if (source.sourceType) return source.sourceType;
    if (source.domain) return inferSourceType(source.domain);
    if (source.sourceId) return inferSourceType(source.sourceId);
    return "unknown";
  }, [source.sourceType, source.domain, source.sourceId]);

  const config = SOURCE_CONFIG[sourceType];
  const Icon = config.icon;

  // 显示名称
  const displayName = source.sourceName || source.domain || config.label;

  // 尺寸样式
  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5 gap-1",
    md: "text-sm px-2 py-1 gap-1.5",
    lg: "text-sm px-3 py-1.5 gap-2",
  };

  const iconSizes = {
    sm: "size-3",
    md: "size-3.5",
    lg: "size-4",
  };

  const badge = (
    <Badge
      variant="secondary"
      className={cn(
        "font-normal cursor-default transition-colors",
        config.bgColor,
        config.color,
        sizeClasses[size],
        onClick && "cursor-pointer hover:opacity-80",
        className,
      )}
      onClick={onClick}
    >
      <Icon className={iconSizes[size]} />
      <span className="truncate max-w-[100px]">{displayName}</span>
      {showConfidence && source.confidence !== undefined && (
        <span className="text-muted-foreground opacity-70">
          {source.confidence}%
        </span>
      )}
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">{displayName}</p>
            {source.domain && (
              <p className="text-xs text-muted-foreground">{source.domain}</p>
            )}
            {source.confidence !== undefined && (
              <p className="text-xs text-muted-foreground">
                来源匹配置信度: {source.confidence}%
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// 来源列表组件
// ============================================================================

export interface SourceListProps {
  /** 来源列表 */
  sources: SourceInfo[];
  /** 最大显示数量 */
  maxDisplay?: number;
  /** 尺寸 */
  size?: "sm" | "md" | "lg";
  /** 点击回调 */
  onSourceClick?: (source: SourceInfo) => void;
}

export function SourceList({
  sources,
  maxDisplay = 3,
  size = "sm",
  onSourceClick,
}: SourceListProps) {
  const displaySources = sources.slice(0, maxDisplay);
  const remainingCount = sources.length - maxDisplay;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {displaySources.map((source, index) => (
        <SourceBadge
          key={source.sourceId || index}
          source={source}
          size={size}
          onClick={onSourceClick ? () => onSourceClick(source) : undefined}
        />
      ))}
      {remainingCount > 0 && (
        <Badge variant="outline" className="text-xs text-muted-foreground">
          +{remainingCount}
        </Badge>
      )}
    </div>
  );
}

export default SourceBadge;
