/**
 * Supabase 类型定义入口文件
 *
 * 从自动生成的类型文件重新导出
 */

export * from "./supabase.generated";
export type {
  Database,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "./supabase.generated";

// ============================================
// 自定义用途标签相关常量
// ============================================

/**
 * 自定义用途标签数量上限
 */
export const CUSTOM_USAGE_TAG_LIMIT = 20;

/**
 * 自定义标签可用颜色类型
 */
export type CustomTagColor =
  | "blue"
  | "purple"
  | "pink"
  | "sky"
  | "lime"
  | "yellow"
  | "slate"
  | "zinc"
  | "green"
  | "red"
  | "orange"
  | "cyan"
  | "indigo"
  | "amber"
  | "rose"
  | "violet"
  | "teal"
  | "emerald"
  | "fuchsia";

/**
 * 自定义标签可用颜色列表
 */
export const CUSTOM_TAG_COLOR_LIST: CustomTagColor[] = [
  "blue",
  "purple",
  "pink",
  "sky",
  "lime",
  "yellow",
  "slate",
  "zinc",
];

/**
 * 自定义标签颜色映射（用于类型安全的颜色查找）
 */
export const CUSTOM_TAG_COLORS: Record<CustomTagColor, true> = {
  blue: true,
  purple: true,
  pink: true,
  sky: true,
  lime: true,
  yellow: true,
  slate: true,
  zinc: true,
  green: true,
  red: true,
  orange: true,
  cyan: true,
  indigo: true,
  amber: true,
  rose: true,
  violet: true,
  teal: true,
  emerald: true,
  fuchsia: true,
};

/**
 * 自定义用途标签类型
 */
export interface CustomUsageTag {
  /** 唯一标识符 */
  id: string;
  /** 标签值（用于存储） */
  value: string;
  /** 显示标签（可选，默认等于 value） */
  label?: string;
  /** 标签颜色 */
  color: CustomTagColor;
  /** 创建时间 */
  createdAt: string;
  /** 最后使用时间 */
  lastUsedAt?: string;
}
