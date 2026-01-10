/**
 * 整理中心类型定义
 *
 * @version 1.0.0
 * @since 2026-01-10
 */

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
