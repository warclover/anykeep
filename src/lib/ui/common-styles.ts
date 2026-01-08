/**
 * 通用样式常量
 *
 * 提供项目中常用的 Tailwind 样式组合
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

// ============================================
// 文本样式
// ============================================

export const TEXT_STYLES = {
  /** 标题文本 - 深色主题兼容 */
  heading: "text-gray-900 dark:text-white",
  /** 正文文本 - 深色主题兼容 */
  body: "text-gray-600 dark:text-gray-400",
  /** 次要文本 - 深色主题兼容 */
  muted: "text-gray-500 dark:text-gray-400",
  /** 提示文本 - 更淡的颜色 */
  hint: "text-gray-400 dark:text-gray-500",
} as const;

// ============================================
// 边框样式
// ============================================

export const BORDER_STYLES = {
  /** 默认边框 */
  default: "border-gray-300 dark:border-gray-600",
  /** 卡片边框 */
  card: "border-gray-200 dark:border-gray-700",
  /** 输入框边框 */
  input: "border-gray-300 dark:border-gray-600",
} as const;

// ============================================
// 背景样式
// ============================================

export const BG_STYLES = {
  /** 卡片背景 */
  card: "bg-white dark:bg-gray-900",
  /** 页面背景 */
  page: "bg-gray-50 dark:bg-gray-900",
  /** 次要背景 */
  secondary: "bg-gray-100 dark:bg-gray-800",
  /** 悬浮状态背景 */
  hover: "hover:bg-gray-100 dark:hover:bg-gray-800",
} as const;

// ============================================
// 交互样式
// ============================================

export const INTERACTIVE_STYLES = {
  /** 可点击元素的基础样式 */
  clickable: "cursor-pointer transition-colors",
  /** 悬浮阴影效果 */
  hoverShadow:
    "hover:shadow-sm hover:border-gray-300 dark:hover:border-gray-600",
  /** 焦点环 */
  focusRing:
    "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
} as const;

// ============================================
// 布局样式
// ============================================

export const LAYOUT_STYLES = {
  /** 页面容器 */
  pageContainer: "container mx-auto p-4 lg:p-8 max-w-7xl space-y-8",
  /** 紧凑页面容器 */
  pageContainerCompact: "container mx-auto p-4 lg:p-8 max-w-4xl space-y-6",
  /** 卡片网格 - 响应式 */
  cardGrid: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4",
  /** 统计卡片网格 */
  statsGrid: "grid grid-cols-2 md:grid-cols-4 gap-4",
} as const;

// ============================================
// 颜色预设
// ============================================

export const COLOR_PRESETS = {
  /** 主题色 - 粉色渐变 */
  primary: "bg-gradient-to-r from-pink-500 to-rose-500",
  primaryHover: "hover:from-pink-600 hover:to-rose-600",
  /** 成功 - 绿色 */
  success: "bg-green-500",
  successLight:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  /** 警告 - 黄色 */
  warning: "bg-yellow-500",
  warningLight:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  /** 错误 - 红色 */
  error: "bg-red-500",
  errorLight: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  /** 信息 - 蓝色 */
  info: "bg-blue-500",
  infoLight: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
} as const;

// ============================================
// 时间常量
// ============================================

export const TIME_CONSTANTS = {
  /** 一天的毫秒数 */
  ONE_DAY_MS: 24 * 60 * 60 * 1000,
  /** 一周的毫秒数 */
  ONE_WEEK_MS: 7 * 24 * 60 * 60 * 1000,
  /** 一小时的毫秒数 */
  ONE_HOUR_MS: 60 * 60 * 1000,
  /** 一分钟的毫秒数 */
  ONE_MINUTE_MS: 60 * 1000,
} as const;
