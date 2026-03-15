/**
 * 字体排版系统
 * 统一全局文字样式，建立清晰视觉层级
 *
 * V4.2.25: UI 全局优化 - 视觉层级规范化
 * V4.2.26: 阅读体验优化 - 统一 slate 色系，优化色阶梯度
 *
 * @version 1.1.0
 * @since 2025-12-17
 */

/**
 * 主要排版样式
 *
 * 视觉层级设计（基于 slate 色系）：
 * - 第1层（最强）：标题 h1/h2/h3 — slate-800 / dark:slate-100
 * - 第2层（中等）：正文 body — slate-600 / dark:slate-300
 * - 第3层（中弱）：描述 description — slate-500 / dark:slate-400
 * - 第4层（最弱）：元信息 meta — slate-400 / dark:slate-500
 */
export const TYPOGRAPHY = {
  /** 页面标题 - 最高层级 */
  h1: "text-xl md:text-2xl font-semibold text-slate-800 dark:text-slate-100",
  /** 卡片标题 */
  h2: "text-lg font-semibold text-slate-800 dark:text-slate-100",
  /** 区块标题 */
  h3: "text-base font-medium text-slate-700 dark:text-slate-200",
  /** 列表项标题（更紧凑） */
  h4: "text-sm font-medium text-slate-800 dark:text-slate-100",
  /** 正文 */
  body: "text-sm text-slate-600 dark:text-slate-300",
  /** 摘要/描述 */
  description: "text-sm text-slate-500 dark:text-slate-400",
  /** 元信息（时间、来源等） */
  meta: "text-xs text-slate-400 dark:text-slate-500",
  /** 标签文字 */
  tag: "text-xs font-medium",
  /** 引用文字 */
  quote: "text-sm italic text-slate-500 dark:text-slate-400",
  /** 代码/等宽字体 */
  code: "text-sm font-mono text-slate-700 dark:text-slate-200",
} as const;

/**
 * 标题样式变体
 */
export const HEADING_VARIANTS = {
  /** 页面主标题 */
  page: "text-xl md:text-2xl font-semibold text-slate-800 dark:text-slate-100 mb-2",
  /** 页面副标题 */
  pageSubtitle: "text-slate-400 dark:text-slate-500 text-sm",
  /** 卡片标题（带图标） */
  cardWithIcon: "flex items-center gap-2 text-lg font-semibold",
  /** 区块标题（带下划线） */
  sectionUnderline:
    "text-base font-medium text-slate-700 dark:text-slate-200 pb-2 border-b border-slate-200 dark:border-slate-700",
} as const;

/**
 * 文字颜色（统一 slate 色系）
 */
export const TEXT_COLORS = {
  /** 主要文字 */
  primary: "text-slate-800 dark:text-slate-100",
  /** 次要文字 */
  secondary: "text-slate-500 dark:text-slate-400",
  /** 弱化文字 */
  muted: "text-slate-400 dark:text-slate-500",
  /** 禁用文字 */
  disabled: "text-slate-300 dark:text-slate-600",
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
