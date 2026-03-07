/**
 * AI 书签助手 - 常量、类型定义
 *
 * 从 ai-bookmark-assistant.tsx 提取
 */

import {
  Tags,
  FolderInput,
  FileText,
  Star,
  Search,
  HelpCircle,
} from "lucide-react";
import type {
  QuickActionType,
  AutoTagResult,
  AutoClassifyResult,
  ExtractKeyResult,
  RateQualityResult,
} from "@/lib/ai-actions";

// =============================================================================
// 类型定义
// =============================================================================

export type QuickActionResultData = {
  "auto-tag": AutoTagResult;
  "auto-classify": AutoClassifyResult;
  "extract-key": ExtractKeyResult;
  "rate-quality": RateQualityResult;
};

export type ActionStatus = "idle" | "loading" | "success" | "error";

export interface ActionState {
  status: ActionStatus;
  message?: string;
}

export interface KeyPointsPanel {
  tldr: string;
  keyPoints: string[];
  keywords: string[];
  sentiment?: "positive" | "neutral" | "negative";
  readingTime?: number;
}

// =============================================================================
// 常量配置
// =============================================================================

export interface QuickActionDef {
  id: QuickActionType;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

export const OPERATION_ACTIONS: QuickActionDef[] = [
  {
    id: "auto-tag",
    label: "智能标签",
    description: "AI 自动推荐并应用标签",
    icon: Tags,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  {
    id: "auto-classify",
    label: "智能分类",
    description: "AI 推荐并移入合适文件夹",
    icon: FolderInput,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
  {
    id: "extract-key",
    label: "提取要点",
    description: "提取关键信息与核心要点",
    icon: FileText,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
  },
  {
    id: "rate-quality",
    label: "质量评估",
    description: "AI 评估内容质量并评分",
    icon: Star,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
  },
];

export interface ChatPreset {
  id: string;
  label: string;
  icon: React.ElementType;
  prompt: string;
}

export const CHAT_PRESETS: ChatPreset[] = [
  {
    id: "similar",
    label: "相似内容",
    icon: Search,
    prompt: "帮我找找我收藏中有没有类似的内容",
  },
  {
    id: "explain",
    label: "解释内容",
    icon: HelpCircle,
    prompt: "请解释一下这篇内容的主要观点",
  },
];

export const SENTIMENT_LABELS: Record<string, string> = {
  positive: "正面",
  neutral: "中性",
  negative: "负面",
};

// =============================================================================
// 书签上下文构建
// =============================================================================

export function buildBookmarkAttachmentContext(params: {
  title: string;
  url?: string | null;
  summary?: string | null;
  tags?: string[] | null;
  platform?: string | null;
}): string {
  const lines = ["【当前浏览的书签】", `标题：${params.title}`];
  if (params.url) lines.push(`链接：${params.url}`);
  if (params.platform) lines.push(`来源平台：${params.platform}`);
  if (params.tags?.length) lines.push(`标签：${params.tags.join("、")}`);
  if (params.summary) lines.push(`AI 摘要：${params.summary}`);
  lines.push("", "请基于以上书签信息回答用户的问题。");
  return lines.join("\n");
}
