/**
 * 间距系统常量
 * 统一全局间距使用，基于 4px 基准
 *
 * V4.2.25: UI 全局优化 - 间距规范化
 *
 * @version 1.0.0
 * @since 2025-12-17
 */

/**
 * 通用间距（使用 Tailwind gap 类）
 */
export const SPACING = {
  /** 组件内紧凑间距 - 4px */
  xs: "gap-1",
  /** 元素内部间距 - 8px */
  sm: "gap-2",
  /** 相关元素间 - 12px */
  md: "gap-3",
  /** 组件间标准间距 - 16px */
  lg: "gap-4",
  /** 区块间间距 - 24px */
  xl: "gap-6",
  /** 大区块间 - 32px */
  "2xl": "gap-8",
} as const;

/**
 * Card 内边距标准
 */
export const CARD_PADDING = {
  /** 标准头部内边距 */
  header: "p-4",
  /** 标准内容内边距（上边距为0避免与header重叠） */
  content: "p-4 pt-0",
  /** 紧凑模式内边距 */
  compact: "p-3",
  /** 移动端内边距 */
  mobile: "p-3 md:p-4",
} as const;

/**
 * 列表项间距
 */
export const LIST_SPACING = {
  /** 紧凑列表 - 4px */
  tight: "space-y-1",
  /** 常规列表 - 8px */
  normal: "space-y-2",
  /** 宽松列表 - 16px */
  relaxed: "space-y-4",
} as const;

/**
 * 页面布局间距
 */
export const PAGE_SPACING = {
  /** 页面水平内边距 */
  paddingX: "px-4 md:px-6 lg:px-8",
  /** 页面垂直内边距 */
  paddingY: "py-4 md:py-6",
  /** 内容区最大宽度 */
  maxWidth: "max-w-5xl",
  /** 区块间距 */
  sectionGap: "space-y-6",
} as const;

/**
 * 按钮间距
 */
export const BUTTON_SPACING = {
  /** 按钮组间距 */
  group: "gap-2",
  /** 紧凑按钮组 */
  groupCompact: "gap-1.5",
  /** 图标与文字间距 */
  iconText: "gap-1.5",
} as const;

/**
 * 标签/Badge 间距
 */
export const TAG_SPACING = {
  /** 标签组间距 */
  group: "gap-2",
  /** 紧凑标签组 */
  groupCompact: "gap-1.5",
  /** 标签内部间距 */
  inner: "gap-1",
} as const;
