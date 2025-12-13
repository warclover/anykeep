/**
 * 智能列表预设模板常量
 * @module lib/smart-list/presets
 * @version 10.0.0
 * @description 定义 6 个预设智能列表模板，用于前端显示和初始化
 */

import type {
  PresetSmartList,
  SmartListColor,
  SmartListSortBy,
} from "@/types/smart-list";

/**
 * 预设智能列表模板配置
 * 注意：这些配置与数据库迁移中的 init_smart_list_presets 函数保持同步
 */
export const PRESET_SMART_LISTS: PresetSmartList[] = [
  {
    name: "最近一周",
    description: "过去7天内收藏的内容",
    icon: "calendar",
    color: "blue",
    filters: {
      dateRange: { type: "relative", value: 7, unit: "day" },
    },
    sortBy: "created_desc",
    sortOrder: 0,
  },
  {
    name: "高价值收藏",
    description: "评分为5星的精选内容",
    icon: "star",
    color: "amber",
    filters: {
      isHighValue: true,
    },
    sortBy: "created_desc",
    sortOrder: 1,
  },
  {
    name: "待阅读",
    description: "尚未阅读的收藏内容",
    icon: "book-open",
    color: "green",
    filters: {
      isRead: false,
    },
    sortBy: "created_desc",
    sortOrder: 2,
  },
  {
    name: "优质经验",
    description: "标记为优质经验的内容",
    icon: "award",
    color: "orange",
    filters: {
      usageTags: ["优质经验"],
    },
    sortBy: "created_desc",
    sortOrder: 3,
  },
  {
    name: "推荐关注",
    description: "值得持续关注的来源",
    icon: "eye",
    color: "purple",
    filters: {
      usageTags: ["值得关注"],
    },
    sortBy: "created_desc",
    sortOrder: 4,
  },
  {
    name: "值得复读",
    description: "需要反复阅读的精华内容",
    icon: "refresh-ccw",
    color: "emerald",
    filters: {
      usageTags: ["值得复读"],
    },
    sortBy: "created_desc",
    sortOrder: 5,
  },
];

/**
 * 预设模板名称列表（用于快速判断是否为预设）
 */
export const PRESET_NAMES = new Set(PRESET_SMART_LISTS.map((p) => p.name));

/**
 * 检查智能列表名称是否为预设名称
 */
export function isPresetName(name: string): boolean {
  return PRESET_NAMES.has(name);
}

/**
 * 获取预设模板的图标名称
 */
export function getPresetIcon(name: string): string {
  const preset = PRESET_SMART_LISTS.find((p) => p.name === name);
  return preset?.icon ?? "filter";
}

/**
 * 获取预设模板的颜色
 */
export function getPresetColor(name: string): SmartListColor {
  const preset = PRESET_SMART_LISTS.find((p) => p.name === name);
  return preset?.color ?? "default";
}

/**
 * 智能列表颜色配置
 */
export const SMART_LIST_COLORS: Record<
  SmartListColor,
  { bg: string; text: string; border: string }
> = {
  default: {
    bg: "bg-gray-100 dark:bg-gray-800",
    text: "text-gray-600 dark:text-gray-400",
    border: "border-gray-200 dark:border-gray-700",
  },
  blue: {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-800",
  },
  green: {
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-600 dark:text-green-400",
    border: "border-green-200 dark:border-green-800",
  },
  orange: {
    bg: "bg-orange-100 dark:bg-orange-900/30",
    text: "text-orange-600 dark:text-orange-400",
    border: "border-orange-200 dark:border-orange-800",
  },
  purple: {
    bg: "bg-purple-100 dark:bg-purple-900/30",
    text: "text-purple-600 dark:text-purple-400",
    border: "border-purple-200 dark:border-purple-800",
  },
  red: {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-600 dark:text-red-400",
    border: "border-red-200 dark:border-red-800",
  },
  cyan: {
    bg: "bg-cyan-100 dark:bg-cyan-900/30",
    text: "text-cyan-600 dark:text-cyan-400",
    border: "border-cyan-200 dark:border-cyan-800",
  },
  pink: {
    bg: "bg-pink-100 dark:bg-pink-900/30",
    text: "text-pink-600 dark:text-pink-400",
    border: "border-pink-200 dark:border-pink-800",
  },
  amber: {
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-800",
  },
  emerald: {
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-800",
  },
};

/**
 * 智能列表排序选项
 */
export const SMART_LIST_SORT_OPTIONS: {
  value: SmartListSortBy;
  label: string;
}[] = [
  { value: "created_desc", label: "最新收藏" },
  { value: "created_asc", label: "最早收藏" },
  { value: "title_asc", label: "标题 A-Z" },
  { value: "title_desc", label: "标题 Z-A" },
  { value: "rating_desc", label: "评分最高" },
  { value: "publish_time_desc", label: "发布时间" },
];

/**
 * 智能列表视图模式选项
 */
export const SMART_LIST_VIEW_MODE_OPTIONS = [
  { value: "inherit", label: "跟随系统" },
  { value: "card", label: "卡片视图" },
  { value: "list", label: "列表视图" },
  { value: "compact", label: "紧凑视图" },
] as const;
