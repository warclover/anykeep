/**
 * InsightReportSkill 类型定义
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

/**
 * 报告类型
 */
export type ReportType =
  | "weekly" // 周报
  | "monthly" // 月报
  | "usage" // 使用分析
  | "content" // 内容分析
  | "trends"; // 趋势分析

/**
 * 报告时间范围
 */
export type ReportTimeRange = "week" | "month" | "quarter" | "year" | "all";

/**
 * InsightReport Skill 输入
 */
export interface InsightReportInput {
  /** 报告类型 */
  reportType: ReportType;
  /** 时间范围 */
  timeRange: ReportTimeRange;
  /** 是否包含详细分析 */
  includeDetails?: boolean;
  /** 筛选条件 */
  filter?: {
    /** 文件夹 ID */
    folderId?: number;
    /** 标签 */
    tags?: string[];
    /** 平台 */
    platforms?: string[];
  };
}

/**
 * 时间趋势数据点
 */
export interface TrendDataPoint {
  /** 时间标签（如：2025-01, 周一） */
  label: string;
  /** 数值 */
  value: number;
  /** 变化率（相比上期） */
  changeRate?: number;
}

/**
 * 分布统计项
 */
export interface DistributionItem {
  /** 分类名称 */
  name: string;
  /** 数量 */
  count: number;
  /** 百分比 */
  percentage: number;
}

/**
 * 热门项目
 */
export interface TopItem {
  /** 项目名称 */
  name: string;
  /** 统计数量 */
  count: number;
  /** 排名 */
  rank: number;
  /** 变化趋势 */
  trend?: "up" | "down" | "stable";
}

/**
 * 收藏活跃度分析
 */
export interface ActivityAnalysis {
  /** 总收藏数 */
  totalBookmarks: number;
  /** 时间段内新增 */
  newBookmarks: number;
  /** 日均收藏 */
  dailyAverage: number;
  /** 最活跃日期 */
  mostActiveDay: string;
  /** 最活跃时段 */
  mostActiveHour: number;
  /** 活跃天数 */
  activeDays: number;
}

/**
 * 内容分析
 */
export interface ContentAnalysis {
  /** 平台分布 */
  byPlatform: DistributionItem[];
  /** 文件夹分布 */
  byFolder: DistributionItem[];
  /** 热门标签 */
  topTags: TopItem[];
  /** AI 标签分析 */
  topAiTags: TopItem[];
  /** 有摘要的比例 */
  summaryRate: number;
  /** 有评分的比例 */
  ratedRate: number;
  /** 平均评分 */
  averageRating: number | null;
}

/**
 * 趋势分析
 */
export interface TrendAnalysis {
  /** 收藏趋势（按天/周/月） */
  bookmarkTrend: TrendDataPoint[];
  /** 平台趋势 */
  platformTrend: Record<string, TrendDataPoint[]>;
  /** 标签趋势 */
  tagTrend: {
    rising: TopItem[];
    declining: TopItem[];
  };
  /** 整体趋势描述 */
  summary: string;
}

/**
 * 洞察建议
 */
export interface Insight {
  /** 洞察类型 */
  type: "highlight" | "warning" | "suggestion";
  /** 洞察标题 */
  title: string;
  /** 洞察描述 */
  description: string;
  /** 相关数据 */
  data?: Record<string, unknown>;
  /** 优先级 */
  priority: "high" | "medium" | "low";
}

/**
 * InsightReport Skill 输出
 */
export interface InsightReportOutput {
  /** 报告标题 */
  title: string;
  /** 报告类型 */
  reportType: ReportType;
  /** 时间范围描述 */
  timeRangeDescription: string;
  /** 活跃度分析 */
  activity: ActivityAnalysis;
  /** 内容分析 */
  content: ContentAnalysis;
  /** 趋势分析 */
  trends: TrendAnalysis;
  /** 洞察建议 */
  insights: Insight[];
  /** 摘要 */
  summary: string;
  /** 后续建议 */
  suggestions: string[];
  /** 生成时间 */
  generatedAt: string;
}

/**
 * 报告类型配置
 */
export const REPORT_TYPE_CONFIG: Record<
  ReportType,
  {
    name: string;
    description: string;
    icon: string;
  }
> = {
  weekly: {
    name: "周报",
    description: "过去一周的收藏活动分析",
    icon: "📅",
  },
  monthly: {
    name: "月报",
    description: "过去一个月的收藏趋势分析",
    icon: "📊",
  },
  usage: {
    name: "使用分析",
    description: "收藏习惯和使用模式分析",
    icon: "📈",
  },
  content: {
    name: "内容分析",
    description: "收藏内容的分类和质量分析",
    icon: "📝",
  },
  trends: {
    name: "趋势分析",
    description: "收藏趋势和兴趣变化分析",
    icon: "📉",
  },
};

/**
 * 默认报告配置
 */
export const DEFAULT_REPORT_CONFIG = {
  reportType: "monthly" as ReportType,
  timeRange: "month" as ReportTimeRange,
  includeDetails: true,
};

// ============================================
// 数据库类型扩展
// ============================================

import type { BookmarkRow as BookmarkRowBase } from "@/types/domain";

/**
 * 数据库书签行类型（扩展 folders 关联）
 */
export type BookmarkRow = Pick<
  BookmarkRowBase,
  | "id"
  | "title"
  | "url"
  | "platform"
  | "ai_tags"
  | "user_tags"
  | "rating"
  | "folder_id"
  | "created_at"
> & {
  folders?: Array<{ name: string }> | { name: string } | null;
};
