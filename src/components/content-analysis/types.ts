import type {
  SynthesisDepthMode,
  SynthesisStatus,
  SynthesisOutputStyle,
} from "@/lib/synthesis";
import { GitCompare, Layers } from "lucide-react";

export interface BookmarkItem {
  id: number;
  title: string;
  url: string;
  platform: string | null;
  ai_summary: string | null;
  created_at: string;
  folder_name: string | null;
}

export type AnalysisTab = "compare" | "synthesis" | "history";

export const DEPTH_MODE_LABELS: Record<
  SynthesisDepthMode,
  { label: string; icon: string }
> = {
  quick: { label: "快读", icon: "⚡" },
  standard: { label: "标准", icon: "📖" },
  academic: { label: "学术", icon: "🎓" },
};

export const STATUS_CONFIG: Record<
  SynthesisStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  pending: { label: "等待中", variant: "secondary" },
  generating: { label: "生成中", variant: "default" },
  completed: { label: "已完成", variant: "outline" },
  failed: { label: "失败", variant: "destructive" },
  cancelled: { label: "已取消", variant: "secondary" },
};

export const SORT_OPTIONS = [
  {
    value: "createdAt-desc",
    label: "最新创建",
    sort: "createdAt" as const,
    order: "desc" as const,
  },
  {
    value: "createdAt-asc",
    label: "最早创建",
    sort: "createdAt" as const,
    order: "asc" as const,
  },
  {
    value: "updatedAt-desc",
    label: "最近更新",
    sort: "updatedAt" as const,
    order: "desc" as const,
  },
  {
    value: "wordCount-desc",
    label: "字数最多",
    sort: "wordCount" as const,
    order: "desc" as const,
  },
  {
    value: "wordCount-asc",
    label: "字数最少",
    sort: "wordCount" as const,
    order: "asc" as const,
  },
];

const PLATFORM_LABELS: Record<string, string> = {
  wechat: "微信",
  bilibili: "B站",
  zhihu: "知乎",
  weibo: "微博",
  xiaohongshu: "小红书",
  twitter: "Twitter",
  youtube: "YouTube",
  unknown: "其他",
};

export function getPlatformLabel(platform: string | null): string {
  return PLATFORM_LABELS[platform || "unknown"] || platform || "其他";
}

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return "刚刚";
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays === 1) return "昨天";
  if (diffDays < 7) return `${diffDays}天前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
  return `${Math.floor(diffDays / 30)}月前`;
}

export function getReportType(
  outputStyle: SynthesisOutputStyle,
  sourceCount: number,
): { label: string; icon: typeof GitCompare; color: string } {
  if (outputStyle === "comparison" || sourceCount === 2) {
    return {
      label: "对比分析",
      icon: GitCompare,
      color: "text-cyan-600 dark:text-cyan-400",
    };
  }
  return {
    label: "主题综述",
    icon: Layers,
    color: "text-purple-600 dark:text-purple-400",
  };
}
