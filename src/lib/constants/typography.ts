/**
 * 字体排版系统
 * 统一全局文字样式，建立清晰视觉层级
 *
 * V4.2.25: UI 全局优化 - 视觉层级规范化
 *
 * @version 1.0.0
 * @since 2025-12-17
 */

/**
 * 主要排版样式
 *
 * 视觉层级设计：
 * - 第1层（最弱）：元信息 meta
 * - 第2层（最强）：标题 h1/h2/h3
 * - 第3层（中等）：扩展信息 tag
 * - 第4层（最弱）：辅助信息 description
 */
export const TYPOGRAPHY = {
  /** 页面标题 - 最高层级 */
  h1: "text-xl md:text-2xl font-bold text-gray-900 dark:text-white",
  /** 卡片标题 */
  h2: "text-lg font-semibold text-gray-900 dark:text-white",
  /** 区块标题 */
  h3: "text-base font-medium text-gray-800 dark:text-gray-200",
  /** 列表项标题（更紧凑） */
  h4: "text-sm font-medium text-gray-900 dark:text-white",
  /** 正文 */
  body: "text-sm text-gray-700 dark:text-gray-300",
  /** 摘要/描述 */
  description: "text-sm text-gray-600 dark:text-gray-400",
  /** 元信息（时间、来源等） */
  meta: "text-xs text-gray-500 dark:text-gray-400",
  /** 标签文字 */
  tag: "text-xs font-medium",
  /** 引用文字 */
  quote: "text-sm italic text-gray-600 dark:text-gray-400",
  /** 代码/等宽字体 */
  code: "text-sm font-mono text-gray-800 dark:text-gray-200",
} as const;

/**
 * 标题样式变体
 */
export const HEADING_VARIANTS = {
  /** 页面主标题 */
  page: "text-xl md:text-2xl font-semibold text-gray-900 dark:text-white mb-2",
  /** 页面副标题 */
  pageSubtitle: "text-gray-500 dark:text-gray-400 text-sm",
  /** 卡片标题（带图标） */
  cardWithIcon: "flex items-center gap-2 text-lg font-semibold",
  /** 区块标题（带下划线） */
  sectionUnderline:
    "text-base font-medium text-gray-800 dark:text-gray-200 pb-2 border-b border-gray-200 dark:border-gray-700",
} as const;

/**
 * 文字颜色
 */
export const TEXT_COLORS = {
  /** 主要文字 */
  primary: "text-gray-900 dark:text-white",
  /** 次要文字 */
  secondary: "text-gray-600 dark:text-gray-400",
  /** 弱化文字 */
  muted: "text-gray-500 dark:text-gray-400",
  /** 禁用文字 */
  disabled: "text-gray-400 dark:text-gray-500",
  /** 成功文字 */
  success: "text-green-600 dark:text-green-400",
  /** 警告文字 */
  warning: "text-amber-600 dark:text-amber-400",
  /** 错误文字 */
  error: "text-red-600 dark:text-red-400",
  /** 链接文字 */
  link: "text-primary hover:underline",
} as const;

/**
 * 行高
 */
export const LINE_HEIGHT = {
  /** 紧凑（标题、标签） */
  tight: "leading-tight",
  /** 正常（正文） */
  normal: "leading-normal",
  /** 宽松（长文本） */
  relaxed: "leading-relaxed",
} as const;
