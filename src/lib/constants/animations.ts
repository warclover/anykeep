/**
 * 动画配置
 * 统一全局动画效果，提升微交互体验
 *
 * V4.2.25: UI 全局优化 - 微交互增强
 *
 * @version 1.0.0
 * @since 2025-12-17
 */

/**
 * 过渡动画时长
 */
export const DURATIONS = {
  /** 超快 - 100ms */
  instant: "duration-100",
  /** 快速 - 150ms */
  fast: "duration-150",
  /** 标准 - 200ms */
  default: "duration-200",
  /** 慢速 - 300ms */
  slow: "duration-300",
  /** 很慢 - 500ms */
  slower: "duration-500",
} as const;

/**
 * 缓动函数
 */
export const EASINGS = {
  /** 标准缓出 */
  out: "ease-out",
  /** 标准缓入缓出 */
  inOut: "ease-in-out",
  /** 弹性效果 */
  bounce: "cubic-bezier(0.34, 1.56, 0.64, 1)",
} as const;

/**
 * 组合动画类
 */
export const ANIMATIONS = {
  /** 快速过渡 */
  fast: "transition-all duration-150 ease-out",
  /** 标准过渡 */
  default: "transition-all duration-200 ease-out",
  /** 慢速过渡 */
  slow: "transition-all duration-300 ease-out",

  /** 卡片悬停上浮 */
  cardHover:
    "hover:shadow-md hover:-translate-y-0.5 transition-all duration-200",
  /** 卡片上浮（CSS 类名） */
  cardLift: "card-lift",

  /** 按钮按压反馈 */
  buttonPress: "active:scale-[0.98] transition-transform duration-100",
  /** 按钮按压（CSS 类名） */
  btnPress: "btn-press",

  /** 标签弹性选中（CSS 类名） */
  tagBounce: "tag-bounce",

  /** 淡入动画 */
  fadeIn: "animate-in fade-in duration-200",
  /** 内容淡入（CSS 类名） */
  contentIn: "animate-content-in",

  /** 骨架屏闪烁（CSS 类名） */
  skeletonShimmer: "skeleton-shimmer",
} as const;

/**
 * 悬停效果
 */
export const HOVER_EFFECTS = {
  /** 轻微放大 */
  scale: "hover:scale-105 transition-transform duration-200",
  /** 亮度变化 */
  brightness: "hover:brightness-110 transition-all duration-200",
  /** 背景色变化 */
  bgDarken:
    "hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-200",
  /** 阴影加深 */
  shadowDeepen: "hover:shadow-md transition-shadow duration-200",
  /** 综合上浮效果 */
  lift: "hover:-translate-y-1 hover:shadow-lg transition-all duration-200",
} as const;

/**
 * 焦点效果
 */
export const FOCUS_EFFECTS = {
  /** 标准聚焦环 */
  ring: "focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none",
  /** 紧凑聚焦环 */
  ringSmall: "focus:ring-1 focus:ring-primary focus:outline-none",
  /** 无聚焦环（用于特殊场景） */
  none: "focus:outline-none focus:ring-0",
} as const;

/**
 * 加载状态动画
 */
export const LOADING_ANIMATIONS = {
  /** 脉冲动画 */
  pulse: "animate-pulse",
  /** 旋转动画 */
  spin: "animate-spin",
  /** 弹跳动画 */
  bounce: "animate-bounce",
} as const;
