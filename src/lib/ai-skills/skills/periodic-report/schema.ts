/**
 * PeriodicReportSkill Schema 定义
 *
 * @module ai-skills/periodic-report/schema
 * @version 1.0.0
 * @since 2025-12-25
 */

import { z } from "zod";

// ============================================
// 输入/输出 Schema
// ============================================

export const PeriodicReportInputSchema = z.object({
  period: z.enum(["daily", "weekly", "monthly", "quarterly"]).default("weekly"),
  reportType: z
    .enum(["summary", "activity", "trends", "highlights"])
    .default("summary"),
  includeComparison: z.boolean().default(true),
  comparisonPeriods: z.number().min(1).max(4).default(1),
  includeChartData: z.boolean().default(true),
  filter: z
    .object({
      folderId: z.number().optional(),
      platforms: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
    })
    .optional(),
});

export const PeriodicReportOutputSchema = z.object({
  title: z.string(),
  period: z.enum(["daily", "weekly", "monthly", "quarterly"]),
  periodLabel: z.string(),
  dateRange: z.object({
    start: z.string(),
    end: z.string(),
  }),
  stats: z.any(),
  comparison: z.any().optional(),
  chartData: z.any().optional(),
  highlights: z.array(z.any()),
  insights: z.array(z.any()),
  summary: z.string(),
  suggestions: z.array(z.string()),
  generatedAt: z.string(),
});

// ============================================
// 步骤定义
// ============================================

export const REPORT_STEPS = [
  {
    id: "collect",
    name: "收集数据",
    description: "收集当前周期数据",
    weight: 20,
  },
  {
    id: "compare",
    name: "历史对比",
    description: "与上一周期对比",
    weight: 20,
  },
  {
    id: "analyze",
    name: "分析趋势",
    description: "分析数据趋势",
    weight: 20,
  },
  {
    id: "highlights",
    name: "精选亮点",
    description: "筛选亮点内容",
    weight: 20,
  },
  {
    id: "generate",
    name: "生成报告",
    description: "生成最终报告",
    weight: 20,
  },
];
