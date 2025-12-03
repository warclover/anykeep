/**
 * 用途标签预设常量
 * P3.2: 提供预设的用途型标签选项
 */

export interface UsageTagPreset {
  /** 标签值（存储到 user_tags） */
  value: string;
  /** 显示标签 */
  label: string;
  /** 标签颜色（Tailwind CSS 类名） */
  color: string;
  /** 背景色（亮色模式） */
  bgLight: string;
  /** 背景色（深色模式） */
  bgDark: string;
  /** 边框色（亮色模式） */
  borderLight: string;
  /** 边框色（深色模式） */
  borderDark: string;
  /** 文字色（亮色模式） */
  textLight: string;
  /** 文字色（深色模式） */
  textDark: string;
  /** 图标（可选） */
  icon?: string;
}

/**
 * 预设用途标签列表
 * 用户确认的预设：下次分享用、值得复读、优质经验、值得关注
 */
export const USAGE_TAG_PRESETS: UsageTagPreset[] = [
  {
    value: "下次分享用",
    label: "下次分享用",
    color: "orange",
    bgLight: "bg-orange-50",
    bgDark: "dark:bg-orange-900/30",
    borderLight: "border-orange-200",
    borderDark: "dark:border-orange-700",
    textLight: "text-orange-700",
    textDark: "dark:text-orange-300",
    icon: "Share2",
  },
  {
    value: "值得复读",
    label: "值得复读",
    color: "emerald",
    bgLight: "bg-emerald-50",
    bgDark: "dark:bg-emerald-900/30",
    borderLight: "border-emerald-200",
    borderDark: "dark:border-emerald-700",
    textLight: "text-emerald-700",
    textDark: "dark:text-emerald-300",
    icon: "RefreshCcw",
  },
  {
    value: "优质经验",
    label: "优质经验",
    color: "amber",
    bgLight: "bg-amber-50",
    bgDark: "dark:bg-amber-900/30",
    borderLight: "border-amber-200",
    borderDark: "dark:border-amber-700",
    textLight: "text-amber-700",
    textDark: "dark:text-amber-300",
    icon: "Award",
  },
  {
    value: "值得关注",
    label: "值得关注",
    color: "rose",
    bgLight: "bg-rose-50",
    bgDark: "dark:bg-rose-900/30",
    borderLight: "border-rose-200",
    borderDark: "dark:border-rose-700",
    textLight: "text-rose-700",
    textDark: "dark:text-rose-300",
    icon: "Eye",
  },
];

/**
 * 预设标签值集合（用于快速查找）
 */
export const USAGE_TAG_VALUES = new Set(
  USAGE_TAG_PRESETS.map((preset) => preset.value),
);

/**
 * 获取用途标签的样式配置
 * @param tagValue 标签值
 * @returns 样式配置，如果不是预设标签则返回 null
 */
export function getUsageTagStyle(tagValue: string): UsageTagPreset | null {
  return USAGE_TAG_PRESETS.find((preset) => preset.value === tagValue) || null;
}

/**
 * 判断标签是否为预设用途标签
 * @param tagValue 标签值
 */
export function isUsageTag(tagValue: string): boolean {
  return USAGE_TAG_VALUES.has(tagValue);
}

/**
 * 将用户标签分为用途标签和普通标签
 * @param userTags 用户标签数组
 * @returns { usageTags: string[], regularTags: string[] }
 */
export function separateUserTags(userTags: string[] | null | undefined): {
  usageTags: string[];
  regularTags: string[];
} {
  if (!userTags || userTags.length === 0) {
    return { usageTags: [], regularTags: [] };
  }

  const usageTags: string[] = [];
  const regularTags: string[] = [];

  for (const tag of userTags) {
    if (isUsageTag(tag)) {
      usageTags.push(tag);
    } else {
      regularTags.push(tag);
    }
  }

  return { usageTags, regularTags };
}

/**
 * AI标签彩色样式配置（用于P3.3）
 * 基于标签内容计算颜色，保证同一标签颜色一致
 */
export const AI_TAG_COLORS = [
  {
    bgLight: "bg-violet-50",
    bgDark: "dark:bg-violet-900/30",
    borderLight: "border-violet-200",
    borderDark: "dark:border-violet-700",
    textLight: "text-violet-700",
    textDark: "dark:text-violet-300",
  },
  {
    bgLight: "bg-cyan-50",
    bgDark: "dark:bg-cyan-900/30",
    borderLight: "border-cyan-200",
    borderDark: "dark:border-cyan-700",
    textLight: "text-cyan-700",
    textDark: "dark:text-cyan-300",
  },
  {
    bgLight: "bg-fuchsia-50",
    bgDark: "dark:bg-fuchsia-900/30",
    borderLight: "border-fuchsia-200",
    borderDark: "dark:border-fuchsia-700",
    textLight: "text-fuchsia-700",
    textDark: "dark:text-fuchsia-300",
  },
  {
    bgLight: "bg-teal-50",
    bgDark: "dark:bg-teal-900/30",
    borderLight: "border-teal-200",
    borderDark: "dark:border-teal-700",
    textLight: "text-teal-700",
    textDark: "dark:text-teal-300",
  },
  {
    bgLight: "bg-indigo-50",
    bgDark: "dark:bg-indigo-900/30",
    borderLight: "border-indigo-200",
    borderDark: "dark:border-indigo-700",
    textLight: "text-indigo-700",
    textDark: "dark:text-indigo-300",
  },
];

/**
 * 根据标签内容获取颜色索引（保证同一标签颜色一致）
 * @param tag 标签内容
 */
export function getAiTagColorIndex(tag: string): number {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash << 5) - hash + tag.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash) % AI_TAG_COLORS.length;
}

/**
 * 获取AI标签的颜色样式
 * @param tag 标签内容
 */
export function getAiTagColor(tag: string): (typeof AI_TAG_COLORS)[0] {
  return AI_TAG_COLORS[getAiTagColorIndex(tag)];
}
