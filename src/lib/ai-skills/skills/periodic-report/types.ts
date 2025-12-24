/**
 * PeriodicReportSkill 类型定义
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

/**
 * 报告周期
 */
export type ReportPeriod = "daily" | "weekly" | "monthly" | "quarterly";

/**
 * 报告类型
 */
export type PeriodicReportType =
  | "summary" // 综合摘要
  | "activity" // 活跃度报告
  | "trends" // 趋势报告
  | "highlights"; // 精选亮点

/**
 * 周期报告输入
 */
export interface PeriodicReportInput {
  /** 报告周期 */
  period: ReportPeriod;
  /** 报告类型 */
  reportType: PeriodicReportType;
  /** 是否包含历史对比 */
  includeComparison?: boolean;
  /** 对比周期数 */
  comparisonPeriods?: number;
  /** 是否包含趋势图表数据 */
  includeChartData?: boolean;
  /** 筛选条件 */
  filter?: {
    folderId?: number;
    platforms?: string[];
    tags?: string[];
  };
}

/**
 * 周期统计
 */
export interface PeriodStats {
  /** 新增收藏数 */
  newBookmarks: number;
  /** 活跃天数 */
  activeDays: number;
  /** 日均收藏 */
  dailyAverage: number;
  /** 总阅读时长估算（分钟） */
  estimatedReadingTime: number;
  /** 最活跃日 */
  mostActiveDay: string;
  /** 最活跃时段 */
  mostActiveHour: number;
}

/**
 * 周期对比
 */
export interface PeriodComparison {
  /** 当前周期 */
  currentPeriod: string;
  /** 对比周期 */
  previousPeriod: string;
  /** 收藏变化 */
  bookmarksChange: {
    current: number;
    previous: number;
    changeRate: number;
    trend: "up" | "down" | "stable";
  };
  /** 活跃度变化 */
  activityChange: {
    current: number;
    previous: number;
    changeRate: number;
    trend: "up" | "down" | "stable";
  };
  /** 平台变化 */
  platformChanges: Array<{
    platform: string;
    current: number;
    previous: number;
    changeRate: number;
  }>;
}

/**
 * 图表数据点
 */
export interface ChartDataPoint {
  /** 时间标签 */
  label: string;
  /** 数值 */
  value: number;
  /** 类型（可选） */
  type?: string;
}

/**
 * 图表数据
 */
export interface ChartData {
  /** 收藏趋势 */
  bookmarkTrend: ChartDataPoint[];
  /** 平台分布 */
  platformDistribution: ChartDataPoint[];
  /** 标签分布 */
  tagDistribution: ChartDataPoint[];
  /** 时段分布 */
  hourlyDistribution: ChartDataPoint[];
}

/**
 * 亮点书签
 */
export interface HighlightBookmark {
  /** 书签 ID */
  id: number;
  /** 标题 */
  title: string;
  /** URL */
  url: string;
  /** 平台 */
  platform: string;
  /** 摘要 */
  summary?: string;
  /** 亮点原因 */
  reason: string;
  /** 收藏时间 */
  createdAt: string;
}

/**
 * 周期洞察
 */
export interface PeriodInsight {
  /** 洞察类型 */
  type: "achievement" | "trend" | "suggestion" | "milestone";
  /** 标题 */
  title: string;
  /** 描述 */
  description: string;
  /** 图标 */
  icon: string;
  /** 相关数据 */
  data?: Record<string, unknown>;
}

/**
 * 周期报告输出
 */
export interface PeriodicReportOutput {
  /** 报告标题 */
  title: string;
  /** 报告周期 */
  period: ReportPeriod;
  /** 周期描述（如：2025年第52周） */
  periodLabel: string;
  /** 时间范围 */
  dateRange: {
    start: string;
    end: string;
  };
  /** 周期统计 */
  stats: PeriodStats;
  /** 历史对比（可选） */
  comparison?: PeriodComparison;
  /** 图表数据（可选） */
  chartData?: ChartData;
  /** 亮点书签 */
  highlights: HighlightBookmark[];
  /** 洞察 */
  insights: PeriodInsight[];
  /** 摘要文本 */
  summary: string;
  /** 建议 */
  suggestions: string[];
  /** 生成时间 */
  generatedAt: string;
}

/**
 * 周期配置
 */
export const PERIOD_CONFIG: Record<
  ReportPeriod,
  {
    name: string;
    icon: string;
    days: number;
    labelFormat: (date: Date) => string;
  }
> = {
  daily: {
    name: "日报",
    icon: "📅",
    days: 1,
    labelFormat: (d) =>
      d.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
  },
  weekly: {
    name: "周报",
    icon: "📊",
    days: 7,
    labelFormat: (d) => {
      const weekNum = Math.ceil(
        (d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) /
          (7 * 24 * 60 * 60 * 1000),
      );
      return `${d.getFullYear()}年第${weekNum}周`;
    },
  },
  monthly: {
    name: "月报",
    icon: "📈",
    days: 30,
    labelFormat: (d) =>
      d.toLocaleDateString("zh-CN", { year: "numeric", month: "long" }),
  },
  quarterly: {
    name: "季报",
    icon: "📉",
    days: 90,
    labelFormat: (d) => {
      const quarter = Math.ceil((d.getMonth() + 1) / 3);
      return `${d.getFullYear()}年Q${quarter}`;
    },
  },
};

/**
 * 默认配置
 */
export const DEFAULT_PERIODIC_REPORT_CONFIG = {
  period: "weekly" as ReportPeriod,
  reportType: "summary" as PeriodicReportType,
  includeComparison: true,
  comparisonPeriods: 1,
  includeChartData: true,
};
