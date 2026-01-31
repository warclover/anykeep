/**
 * 整理中心类型定义
 *
 * @version 1.1.0
 * @since 2026-01-10
 * @updated 2026-01-31
 */

import type { LibrarianAnalysis } from "@/types/librarian.types";

// ============================================================================
// 健康度常量
// ============================================================================

/**
 * 健康度评分阈值
 */
export const HEALTH_SCORE_THRESHOLDS = {
  /** 健康：>= 80 分 */
  HEALTHY: 80,
  /** 一般：>= 60 分 */
  MODERATE: 60,
} as const;

/**
 * 健康度等级标签
 */
export const HEALTH_SCORE_LABELS = {
  HEALTHY: "健康",
  MODERATE: "一般",
  NEEDS_IMPROVEMENT: "需改进",
} as const;

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 计算分析结果中的问题总数
 * @param analysis - 整��大师分析结果
 * @returns 问题总数
 */
export function calculateTotalIssues(analysis: LibrarianAnalysis): number {
  return (
    analysis.duplicateFolders.length +
    analysis.emptyFolders.length +
    analysis.oversizedFolders.length +
    analysis.poorlyNamedFolders.length +
    analysis.missingCategories.length
  );
}

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 整理操作快照 - 用于前后对比
 */
export interface OrganizeSnapshot {
  /** 快照时间 */
  timestamp: string;
  /** 总数 */
  total: number;
  /** 未分类数 */
  uncategorized: number;
  /** 重复数 */
  duplicates: number;
  /** 无标签数 */
  untagged: number;
  /** 长期未读数 */
  stale: number;
}

/**
 * 整理变更记录
 */
export interface OrganizeChange {
  type: "categorized" | "cleaned" | "tagged" | "archived" | "merged";
  count: number;
  label: string;
  icon: string;
}

/**
 * 整理结果对比
 */
export interface OrganizeComparisonData {
  before: OrganizeSnapshot;
  after: OrganizeSnapshot;
  changes: OrganizeChange[];
  summary: {
    totalCleaned: number;
    totalCategorized: number;
    totalTagged: number;
    totalArchived: number;
    improvementPercent: number;
  };
}

/**
 * 整理中心页面状态
 */
export type OrganizePageState =
  | "idle"
  | "analyzing"
  | "confirming"
  | "executing"
  | "complete";

/**
 * 快速操作类型
 */
export type QuickActionType =
  | "one-click"
  | "clean-duplicates"
  | "smart-categorize"
  | "auto-tag"
  | "archive-stale";

/**
 * 快速操作配置
 */
export interface QuickAction {
  id: QuickActionType;
  title: string;
  description: string;
  icon: string;
  variant: "default" | "outline";
  highlight?: boolean;
}

/**
 * 收藏统计 API 响应
 */
export interface CollectionStatsResponse {
  timestamp: string;
  total: number;
  uncategorized: number;
  duplicates: number;
  untagged: number;
  stale: number;
}
