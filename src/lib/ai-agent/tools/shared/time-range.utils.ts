/**
 * 共享时间范围工具
 *
 * 统一所有工具的时间范围处理逻辑
 *
 * @version 1.0.0
 * @since 2026-01-10
 */

import { z } from "zod";

// ============================================
// 时间范围枚举
// ============================================

export const TIME_RANGE_VALUES = [
  "today", // 今天
  "yesterday", // 昨天
  "week", // 本周
  "last_week", // 上周
  "month", // 本月
  "last_month", // 上月
  "quarter", // 本季度
  "year", // 今年
  "all", // 全部（默认）
] as const;

export type TimeRangeValue = (typeof TIME_RANGE_VALUES)[number];

// ============================================
// Zod Schema（可复用）
// ============================================

export const timeRangeSchema = z
  .enum(TIME_RANGE_VALUES)
  .optional()
  .default("all")
  .describe("统计/查询时间范围，默认为全部");

// ============================================
// 时间范围转换
// ============================================

export interface DateRange {
  start?: Date;
  end?: Date;
}

/**
 * 将时间范围枚举转换为具体日期
 */
export function getTimeRangeDates(timeRange: TimeRangeValue): DateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  switch (timeRange) {
    case "today":
      return { start: today, end: tomorrow };

    case "yesterday": {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: yesterday, end: today };
    }

    case "week": {
      // 本周一（中国习惯周一为一周开始）
      const weekStart = new Date(today);
      const dayOfWeek = weekStart.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // 周日为0，需要回退6天
      weekStart.setDate(weekStart.getDate() + diff);
      return { start: weekStart };
    }

    case "last_week": {
      // 上周一到上周日
      const thisWeekStart = new Date(today);
      const dayOfWeek = thisWeekStart.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      thisWeekStart.setDate(thisWeekStart.getDate() + diff);

      const lastWeekEnd = new Date(thisWeekStart);
      const lastWeekStart = new Date(thisWeekStart);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      return { start: lastWeekStart, end: lastWeekEnd };
    }

    case "month": {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: monthStart };
    }

    case "last_month": {
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastMonthStart = new Date(
        today.getFullYear(),
        today.getMonth() - 1,
        1,
      );
      return { start: lastMonthStart, end: lastMonthEnd };
    }

    case "quarter": {
      const quarterMonth = Math.floor(today.getMonth() / 3) * 3;
      const quarterStart = new Date(today.getFullYear(), quarterMonth, 1);
      return { start: quarterStart };
    }

    case "year": {
      const yearStart = new Date(today.getFullYear(), 0, 1);
      return { start: yearStart };
    }

    case "all":
    default:
      return {};
  }
}

/**
 * 为 Supabase 查询添加时间范围过滤
 *
 * @param query Supabase 查询对象
 * @param timeRange 时间范围
 * @param column 时间列名，默认 created_at
 * @returns 添加了时间过滤的查询对象
 */
export function applyTimeRangeFilter<T>(
  query: T,
  timeRange: TimeRangeValue,
  column: string = "created_at",
): T {
  if (timeRange === "all") {
    return query;
  }

  const { start, end } = getTimeRangeDates(timeRange);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let result = query as any;

  if (start) {
    result = result.gte(column, start.toISOString());
  }
  if (end) {
    result = result.lt(column, end.toISOString());
  }

  return result as T;
}

/**
 * 获取时间范围的人类可读描述
 */
export function getTimeRangeLabel(timeRange: TimeRangeValue): string {
  const labels: Record<TimeRangeValue, string> = {
    today: "今天",
    yesterday: "昨天",
    week: "本周",
    last_week: "上周",
    month: "本月",
    last_month: "上月",
    quarter: "本季度",
    year: "今年",
    all: "全部",
  };
  return labels[timeRange] || "全部";
}

/**
 * 从中文时间表达提取时间范围值
 *
 * @param text 用户输入文本
 * @returns 时间范围值，未匹配返回 undefined
 */
export function extractTimeRangeFromText(
  text: string,
): TimeRangeValue | undefined {
  const patterns: Array<{ pattern: RegExp; value: TimeRangeValue }> = [
    { pattern: /今天|今日/, value: "today" },
    { pattern: /昨天|昨日/, value: "yesterday" },
    { pattern: /上周/, value: "last_week" },
    { pattern: /本周|这周|这一周/, value: "week" },
    { pattern: /上月|上个月/, value: "last_month" },
    { pattern: /本月|这个月|这月/, value: "month" },
    { pattern: /本季度|这季度/, value: "quarter" },
    { pattern: /今年|本年/, value: "year" },
    { pattern: /全部|所有|全量/, value: "all" },
  ];

  for (const { pattern, value } of patterns) {
    if (pattern.test(text)) {
      return value;
    }
  }

  return undefined;
}
