/**
 * MD 阅读器高亮颜色配置
 * Spec: md-reader-upgrade / REQ-10
 */

import type { HighlightColor, HighlightColorConfig } from "../../types/reader";

/**
 * 高亮颜色配置
 * 5 种颜色：黄色、绿色、蓝色、粉色、紫色
 */
export const HIGHLIGHT_COLORS: Record<HighlightColor, HighlightColorConfig> = {
  yellow: {
    id: "yellow",
    bg: "#fef08a", // Tailwind yellow-200
    label: "重点",
  },
  green: {
    id: "green",
    bg: "#bbf7d0", // Tailwind green-200
    label: "已掌握",
  },
  blue: {
    id: "blue",
    bg: "#bfdbfe", // Tailwind blue-200
    label: "待深入",
  },
  pink: {
    id: "pink",
    bg: "#fbcfe8", // Tailwind pink-200
    label: "感悟",
  },
  purple: {
    id: "purple",
    bg: "#ddd6fe", // Tailwind violet-200
    label: "引用",
  },
} as const;

/**
 * 高亮颜色列表（用于 UI 渲染）
 */
export const HIGHLIGHT_COLOR_LIST: HighlightColorConfig[] =
  Object.values(HIGHLIGHT_COLORS);

/**
 * 默认高亮颜色
 */
export const DEFAULT_HIGHLIGHT_COLOR: HighlightColor = "yellow";

/**
 * 高亮工具栏配置
 */
export const HIGHLIGHT_TOOLBAR_CONFIG = {
  /** 工具栏距选区的间距（像素） */
  gap: 8,
  /** 出现动画时长（毫秒） */
  fadeInDuration: 150,
  /** 颜色圆点大小（像素） */
  colorDotSize: 20,
  /** hover 时的缩放比例 */
  hoverScale: 1.1,
} as const;

/**
 * 获取高亮背景色 CSS
 */
export function getHighlightBgColor(color: HighlightColor): string {
  return HIGHLIGHT_COLORS[color].bg;
}

/**
 * 生成高亮 CSS 类名
 */
export function getHighlightClassName(color: HighlightColor): string {
  return `highlight-${color}`;
}

/**
 * 生成高亮 mark 元素的样式
 */
export function getHighlightStyle(color: HighlightColor): React.CSSProperties {
  return {
    backgroundColor: HIGHLIGHT_COLORS[color].bg,
    borderRadius: "2px",
    padding: "0 2px",
    cursor: "pointer",
  };
}
