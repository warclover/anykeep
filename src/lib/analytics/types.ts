/**
 * Analytics 类型定义
 * @module lib/analytics/types
 * @version 1.0.0
 */

import type { Platform } from "@/types/supabase";

// ============================================================================
// 统计概览
// ============================================================================

export interface AnalyticsStats {
  /** 总收藏数 */
  totalBookmarks: number;
  /** 内容收藏数（排除浏览器书签） */
  contentBookmarks: number;
  /** 浏览器书签数 */
  browserBookmarks: number;
  /** 今日新增 */
  todayCount: number;
  /** 近7天新增 */
  weekCount: number;
  /** 近30天新增 */
  last30DaysCount: number;
  /** 未分类数量 */
  unclassifiedCount: number;
  /** 分类率 */
  classificationRate: number;
}

// ============================================================================
// 趋势数据
// ============================================================================

export interface TrendDataItem {
  /** 日期 YYYY-MM-DD */
  date: string;
  /** 内容收藏数量 */
  count: number;
  /** 浏览器书签数量 */
  browserCount: number;
  /** 总计 */
  total: number;
}

// ============================================================================
// 平台分布
// ============================================================================

export interface PlatformDistribution {
  /** 平台标识或合并后的标识 */
  platform: string;
  /** 显示名称 */
  name: string;
  /** 数量 */
  value: number;
  /** 颜色 */
  color: string;
  /** 占比 */
  percentage: number;
}

// ============================================================================
// 文件夹分布
// ============================================================================

export interface FolderDistribution {
  /** 文件夹 ID */
  folderId: number | null;
  /** 文件夹名称 */
  name: string;
  /** 收藏数量 */
  value: number;
  /** 占比 */
  percentage: number;
}

// ============================================================================
// 标签统计
// ============================================================================

export interface TagStats {
  /** 标签名 */
  tag: string;
  /** 使用次数 */
  count: number;
}

// ============================================================================
// 内容类型统计
// ============================================================================

export interface ContentTypeStats {
  /** 类型名 */
  type: string;
  /** 数量 */
  count: number;
  /** 占比 */
  percentage: number;
}

// ============================================================================
// 时间对比
// ============================================================================

export interface TimeComparison {
  /** 当前周期数值 */
  current: number;
  /** 上个周期数值 */
  previous: number;
  /** 变化量 */
  change: number;
  /** 变化百分比 */
  changePercent: number;
  /** 趋势方向 */
  trend: "up" | "down" | "flat";
}

export interface PeriodComparison {
  /** 今日 vs 昨日 */
  daily: TimeComparison;
  /** 本周 vs 上周 */
  weekly: TimeComparison;
  /** 本月 vs 上月 */
  monthly: TimeComparison;
}

// ============================================================================
// AI 处理统计
// ============================================================================

export interface AIProcessingStats {
  /** 摘要生成次数 */
  summaryCount: number;
  /** 标签生成次数 */
  tagCount: number;
  /** 分类建议次数 */
  classificationCount: number;
  /** 分类采纳率 */
  classificationAcceptRate: number;
  /** 分类拒绝率 */
  classificationRejectRate: number;
}

// ============================================================================
// 完整分析数据
// ============================================================================

export interface AnalyticsData {
  /** 统计概览 */
  stats: AnalyticsStats;
  /** 趋势数据 */
  trendData: TrendDataItem[];
  /** 平台分布 */
  platformData: PlatformDistribution[];
  /** 文件夹分布 */
  folderData: FolderDistribution[];
  /** 热门标签 */
  tagData: TagStats[];
  /** 内容类型 */
  typeData: ContentTypeStats[];
  /** 时间对比（可选） */
  comparison?: PeriodComparison;
  /** AI 处理统计（可选） */
  aiStats?: AIProcessingStats;
  /** 数据生成时间 */
  generatedAt: string;
}

// ============================================================================
// 服务配置
// ============================================================================

export interface AnalyticsConfig {
  /** 趋势数据天数 */
  trendDays: number;
  /** 热门标签数量 */
  topTagsCount: number;
  /** 文件夹分布数量 */
  topFoldersCount: number;
  /** 是否合并浏览器平台 */
  mergeBrowserPlatforms: boolean;
  /** 是否包含时间对比 */
  includeComparison: boolean;
  /** 是否包含 AI 统计 */
  includeAIStats: boolean;
}

export const DEFAULT_ANALYTICS_CONFIG: AnalyticsConfig = {
  trendDays: 30,
  topTagsCount: 10,
  topFoldersCount: 10,
  mergeBrowserPlatforms: true,
  includeComparison: false,
  includeAIStats: false,
};

// ============================================================================
// 浏览器平台常量
// ============================================================================

export const BROWSER_PLATFORMS: Platform[] = [
  "BROWSER_CHROME",
  "BROWSER_EDGE",
  "BROWSER_FIREFOX",
  "BROWSER_SAFARI",
];

export function isBrowserPlatform(platform: Platform): boolean {
  return BROWSER_PLATFORMS.includes(platform);
}
