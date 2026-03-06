/**
 * 数据统计页面 - 类型、常量、工具函数
 */

import type { TimeComparison } from "@/lib/analytics";

// 时间范围选项
export type DateRange = "7" | "14" | "30";

export const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: "7", label: "最近 7 天" },
  { value: "14", label: "最近 14 天" },
  { value: "30", label: "最近 30 天" },
];

// 文件夹颜色
export const FOLDER_COLORS = [
  "#8b5cf6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#6366f1",
  "#84cc16",
];

// Skill 名称映射
const SKILL_NAME_MAP: Record<string, string> = {
  knowledge_review: "知识回顾",
  data_export: "数据导出",
  insight_report: "洞察报告",
  batch_organize: "智能整理",
  search: "智能搜索",
  classify: "智能分类",
  tag: "标签生成",
  summary: "摘要生成",
};

/**
 * 格式化 Skill ID 为可读名称
 */
export function formatSkillName(skillId: string): string {
  if (SKILL_NAME_MAP[skillId]) {
    return SKILL_NAME_MAP[skillId];
  }
  return skillId
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Tooltip 类型定义
export interface TooltipPayload {
  value: number;
  payload: {
    date: string;
    count: number;
  };
}

export interface TooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
}

export interface PieTooltipPayload {
  name: string;
  value: number;
}

export interface PieTooltipProps {
  active?: boolean;
  payload?: PieTooltipPayload[];
}

export type { TimeComparison };
