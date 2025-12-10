/**
 * 用途标签预设常量
 * P3.2: 提供预设的用途型标签选项
 * V9.0: 扩展支持自定义用途标签
 */

import type { CustomUsageTag, CustomTagColor } from "@/types/supabase";
import { CUSTOM_TAG_COLORS } from "@/types/supabase";

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

// ============================================
// V9.0 新增：支持自定义用途标签的扩展函数
// ============================================

/**
 * 自定义标签的颜色样式映射
 * 将 Tailwind 颜色名转换为完整样式配置
 */
export const CUSTOM_TAG_COLOR_STYLES: Partial<
  Record<CustomTagColor, Omit<UsageTagPreset, "value" | "label" | "icon">>
> = {
  blue: {
    color: "blue",
    bgLight: "bg-blue-50",
    bgDark: "dark:bg-blue-900/30",
    borderLight: "border-blue-200",
    borderDark: "dark:border-blue-700",
    textLight: "text-blue-700",
    textDark: "dark:text-blue-300",
  },
  purple: {
    color: "purple",
    bgLight: "bg-purple-50",
    bgDark: "dark:bg-purple-900/30",
    borderLight: "border-purple-200",
    borderDark: "dark:border-purple-700",
    textLight: "text-purple-700",
    textDark: "dark:text-purple-300",
  },
  pink: {
    color: "pink",
    bgLight: "bg-pink-50",
    bgDark: "dark:bg-pink-900/30",
    borderLight: "border-pink-200",
    borderDark: "dark:border-pink-700",
    textLight: "text-pink-700",
    textDark: "dark:text-pink-300",
  },
  sky: {
    color: "sky",
    bgLight: "bg-sky-50",
    bgDark: "dark:bg-sky-900/30",
    borderLight: "border-sky-200",
    borderDark: "dark:border-sky-700",
    textLight: "text-sky-700",
    textDark: "dark:text-sky-300",
  },
  lime: {
    color: "lime",
    bgLight: "bg-lime-50",
    bgDark: "dark:bg-lime-900/30",
    borderLight: "border-lime-200",
    borderDark: "dark:border-lime-700",
    textLight: "text-lime-700",
    textDark: "dark:text-lime-300",
  },
  yellow: {
    color: "yellow",
    bgLight: "bg-yellow-50",
    bgDark: "dark:bg-yellow-900/30",
    borderLight: "border-yellow-200",
    borderDark: "dark:border-yellow-700",
    textLight: "text-yellow-700",
    textDark: "dark:text-yellow-300",
  },
  slate: {
    color: "slate",
    bgLight: "bg-slate-100",
    bgDark: "dark:bg-slate-800/50",
    borderLight: "border-slate-300",
    borderDark: "dark:border-slate-600",
    textLight: "text-slate-700",
    textDark: "dark:text-slate-300",
  },
  zinc: {
    color: "zinc",
    bgLight: "bg-zinc-100",
    bgDark: "dark:bg-zinc-800/50",
    borderLight: "border-zinc-300",
    borderDark: "dark:border-zinc-600",
    textLight: "text-zinc-700",
    textDark: "dark:text-zinc-300",
  },
};

/**
 * 统一的用途标签类型（包含预设和自定义）
 */
export interface UnifiedUsageTag {
  /** 标签值 */
  value: string;
  /** 显示标签 */
  label: string;
  /** 是否为预设标签 */
  isPreset: boolean;
  /** 样式配置 */
  style: Omit<UsageTagPreset, "value" | "label" | "icon">;
  /** 图标（仅预设标签有） */
  icon?: string;
  /** 最后使用时间（仅自定义标签有） */
  lastUsedAt?: string;
}

/**
 * 获取所有用途标签（预设 + 自定义）
 * @param customTags 用户的自定义标签列表
 * @returns 统一格式的标签列表
 */
export function getAllUsageTags(
  customTags: CustomUsageTag[] = [],
): UnifiedUsageTag[] {
  // 预设标签
  const presetTags: UnifiedUsageTag[] = USAGE_TAG_PRESETS.map((preset) => ({
    value: preset.value,
    label: preset.label,
    isPreset: true,
    style: {
      color: preset.color,
      bgLight: preset.bgLight,
      bgDark: preset.bgDark,
      borderLight: preset.borderLight,
      borderDark: preset.borderDark,
      textLight: preset.textLight,
      textDark: preset.textDark,
    },
    icon: preset.icon,
  }));

  // 自定义标签
  const customUnifiedTags: UnifiedUsageTag[] = customTags.map((tag) => {
    const colorStyle =
      CUSTOM_TAG_COLOR_STYLES[tag.color as CustomTagColor] ||
      CUSTOM_TAG_COLOR_STYLES.blue!;
    return {
      value: tag.value,
      label: tag.label || tag.value, // 如果没有 label，使用 value 作为默认
      isPreset: false,
      style: colorStyle,
      lastUsedAt: tag.lastUsedAt,
    };
  });

  return [...presetTags, ...customUnifiedTags];
}

/**
 * 判断标签是否为用途标签（预设或自定义）
 * @param tagValue 标签值
 * @param customTags 用户的自定义标签列表
 */
export function isUsageTagExtended(
  tagValue: string,
  customTags: CustomUsageTag[] = [],
): boolean {
  // 先检查预设
  if (USAGE_TAG_VALUES.has(tagValue)) {
    return true;
  }
  // 再检查自定义
  return customTags.some((tag) => tag.value === tagValue);
}

/**
 * 获取用途标签的样式（支持预设和自定义）
 * @param tagValue 标签值
 * @param customTags 用户的自定义标签列表
 * @returns 样式配置，如果不是用途标签则返回 null
 */
export function getUsageTagStyleExtended(
  tagValue: string,
  customTags: CustomUsageTag[] = [],
): UnifiedUsageTag | null {
  // 先检查预设
  const preset = USAGE_TAG_PRESETS.find((p) => p.value === tagValue);
  if (preset) {
    return {
      value: preset.value,
      label: preset.label,
      isPreset: true,
      style: {
        color: preset.color,
        bgLight: preset.bgLight,
        bgDark: preset.bgDark,
        borderLight: preset.borderLight,
        borderDark: preset.borderDark,
        textLight: preset.textLight,
        textDark: preset.textDark,
      },
      icon: preset.icon,
    };
  }

  // 再检查自定义
  const customTag = customTags.find((tag) => tag.value === tagValue);
  if (customTag) {
    const colorStyle =
      CUSTOM_TAG_COLOR_STYLES[customTag.color as CustomTagColor] ||
      CUSTOM_TAG_COLOR_STYLES.blue!;
    return {
      value: customTag.value,
      label: customTag.label || customTag.value, // 如果没有 label，使用 value 作为默认
      isPreset: false,
      style: colorStyle,
      lastUsedAt: customTag.lastUsedAt,
    };
  }

  return null;
}

/**
 * 将用户标签分为用途标签和普通标签（支持自定义标签）
 * @param userTags 用户标签数组
 * @param customTags 用户的自定义标签列表
 * @returns { usageTags: string[], regularTags: string[] }
 */
export function separateUserTagsExtended(
  userTags: string[] | null | undefined,
  customTags: CustomUsageTag[] = [],
): {
  usageTags: string[];
  regularTags: string[];
} {
  if (!userTags || userTags.length === 0) {
    return { usageTags: [], regularTags: [] };
  }

  const usageTags: string[] = [];
  const regularTags: string[] = [];

  for (const tag of userTags) {
    if (isUsageTagExtended(tag, customTags)) {
      usageTags.push(tag);
    } else {
      regularTags.push(tag);
    }
  }

  return { usageTags, regularTags };
}

/**
 * 获取最近使用的用途标签（按 lastUsedAt 排序）
 * @param customTags 用户的自定义标签列表
 * @param limit 返回数量限制
 * @returns 最近使用的标签列表（预设 + 自定义混合）
 */
export function getRecentUsageTags(
  customTags: CustomUsageTag[] = [],
  limit: number = 4,
): UnifiedUsageTag[] {
  const allTags = getAllUsageTags(customTags);

  // 按 lastUsedAt 排序（有 lastUsedAt 的排前面，时间越近越前）
  const sorted = [...allTags].sort((a, b) => {
    // 如果都没有 lastUsedAt，保持原顺序
    if (!a.lastUsedAt && !b.lastUsedAt) return 0;
    // 有 lastUsedAt 的排前面
    if (!a.lastUsedAt) return 1;
    if (!b.lastUsedAt) return -1;
    // 时间越近越前
    return new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime();
  });

  return sorted.slice(0, limit);
}

/**
 * 验证自定义标签值是否可用（不与预设和已有自定义重复）
 * @param value 要验证的标签值
 * @param existingCustomTags 现有自定义标签
 * @param excludeId 排除的标签ID（编辑时使用）
 */
export function validateCustomTagValue(
  value: string,
  existingCustomTags: CustomUsageTag[] = [],
  excludeId?: string,
): { valid: boolean; error?: string } {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return { valid: false, error: "标签名不能为空" };
  }

  if (trimmedValue.length > 20) {
    return { valid: false, error: "标签名不能超过20个字符" };
  }

  // 检查是否与预设标签重复
  if (USAGE_TAG_VALUES.has(trimmedValue)) {
    return { valid: false, error: "不能与预设标签重复" };
  }

  // 检查是否与已有自定义标签重复
  const duplicate = existingCustomTags.find(
    (tag) => tag.value === trimmedValue && tag.id !== excludeId,
  );
  if (duplicate) {
    return { valid: false, error: "标签名已存在" };
  }

  return { valid: true };
}

/**
 * 生成新的自定义标签
 * @param value 标签值
 * @param color 颜色
 */
export function createCustomUsageTag(
  value: string,
  color: CustomTagColor = "blue",
): CustomUsageTag {
  return {
    id: crypto.randomUUID(),
    value: value.trim(),
    label: value.trim(),
    color,
    createdAt: new Date().toISOString(),
  };
}

/**
 * 获取可用的标签颜色列表
 */
export function getAvailableColors(): CustomTagColor[] {
  return Object.keys(CUSTOM_TAG_COLORS) as CustomTagColor[];
}

/**
 * 获取颜色的显示名称（中文）
 */
export function getColorDisplayName(color: CustomTagColor): string {
  const colorNames: Partial<Record<CustomTagColor, string>> = {
    blue: "蓝色",
    purple: "紫色",
    pink: "粉色",
    sky: "天蓝",
    lime: "青绿",
    yellow: "黄色",
    slate: "灰色",
    zinc: "深灰",
    green: "绿色",
    red: "红色",
    orange: "橙色",
    cyan: "青色",
    indigo: "靛蓝",
    amber: "琥珀",
    rose: "玫红",
    violet: "紫罗兰",
    teal: "青绿",
    emerald: "翡翠绿",
    fuchsia: "紫红",
  };
  return colorNames[color] || color;
}

/**
 * 颜色选择器按钮样式（用于颜色选择圆形按钮）
 * 使用较深的颜色（400级别）以便在白色背景上清晰可见
 */
export const COLOR_PICKER_BUTTON_STYLES: Partial<
  Record<CustomTagColor, string>
> = {
  blue: "bg-blue-400",
  purple: "bg-purple-400",
  pink: "bg-pink-400",
  sky: "bg-sky-400",
  lime: "bg-lime-400",
  yellow: "bg-yellow-400",
  slate: "bg-slate-400",
  zinc: "bg-zinc-400",
  green: "bg-green-400",
  red: "bg-red-400",
  orange: "bg-orange-400",
  cyan: "bg-cyan-400",
  indigo: "bg-indigo-400",
  amber: "bg-amber-400",
  rose: "bg-rose-400",
  violet: "bg-violet-400",
  teal: "bg-teal-400",
  emerald: "bg-emerald-400",
  fuchsia: "bg-fuchsia-400",
};
