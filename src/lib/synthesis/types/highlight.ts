/**
 * 综述标注类型定义
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import type { Json } from "@/types/supabase";

// ============================================================================
// 标注颜色
// ============================================================================

export const HIGHLIGHT_COLORS = ["yellow", "green", "blue", "pink"] as const;

export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

export const HIGHLIGHT_COLOR_CLASSES: Record<
  HighlightColor,
  { bg: string; hover: string; border: string }
> = {
  yellow: {
    bg: "bg-yellow-200/70 dark:bg-yellow-500/30",
    hover: "hover:bg-yellow-300/70 dark:hover:bg-yellow-500/40",
    border: "border-yellow-400 dark:border-yellow-600",
  },
  green: {
    bg: "bg-green-200/70 dark:bg-green-500/30",
    hover: "hover:bg-green-300/70 dark:hover:bg-green-500/40",
    border: "border-green-400 dark:border-green-600",
  },
  blue: {
    bg: "bg-blue-200/70 dark:bg-blue-500/30",
    hover: "hover:bg-blue-300/70 dark:hover:bg-blue-500/40",
    border: "border-blue-400 dark:border-blue-600",
  },
  pink: {
    bg: "bg-pink-200/70 dark:bg-pink-500/30",
    hover: "hover:bg-pink-300/70 dark:hover:bg-pink-500/40",
    border: "border-pink-400 dark:border-pink-600",
  },
};

// ============================================================================
// 标注区块类型
// ============================================================================

export type HighlightSection =
  | "overview"
  | "consensus"
  | "divergence"
  | "blindspot"
  | "full";

export const SECTION_LABELS: Record<HighlightSection, string> = {
  overview: "概述",
  consensus: "共识",
  divergence: "分歧",
  blindspot: "盲区",
  full: "全文",
};

// ============================================================================
// 标注位置信息
// ============================================================================

export interface HighlightPosition {
  start: number;
  end: number;
  section: HighlightSection;
  /** 可选：用于精确定位的元素索引（如共识点索引） */
  itemIndex?: number;
}

// ============================================================================
// 标注实体
// ============================================================================

export interface SynthesisHighlight {
  id: string;
  reportId: string;
  userId: string;
  content: string;
  note: string | null;
  color: HighlightColor;
  position: HighlightPosition;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// API 请求/响应类型
// ============================================================================

export interface CreateHighlightRequest {
  content: string;
  note?: string;
  color?: HighlightColor;
  position: HighlightPosition;
}

export interface UpdateHighlightRequest {
  note?: string;
  color?: HighlightColor;
}

export interface HighlightListResponse {
  data: SynthesisHighlight[];
  total: number;
}

// ============================================================================
// 数据库行类型（Supabase 返回）
// ============================================================================

export interface SynthesisHighlightRow {
  id: string;
  report_id: string;
  user_id: string;
  content: string;
  note: string | null;
  color: string;
  position: Json;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// 类型转换
// ============================================================================

export function toHighlight(row: SynthesisHighlightRow): SynthesisHighlight {
  return {
    id: row.id,
    reportId: row.report_id,
    userId: row.user_id,
    content: row.content,
    note: row.note,
    color: (row.color as HighlightColor) || "yellow",
    position: row.position as unknown as HighlightPosition,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * 创建标注行数据（用于插入数据库）
 */
export function toHighlightRow(
  highlight: CreateHighlightRequest,
  reportId: string,
  userId: string,
): {
  report_id: string;
  user_id: string;
  content: string;
  note: string | null;
  color: string;
  position: Json;
} {
  return {
    report_id: reportId,
    user_id: userId,
    content: highlight.content,
    note: highlight.note || null,
    color: highlight.color || "yellow",
    position: highlight.position as unknown as Json,
  };
}
