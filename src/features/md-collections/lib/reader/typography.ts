/**
 * MD 阅读器排版配置
 * Spec: md-reader-upgrade / REQ-2
 */

import type {
  FontSizePreset,
  TypographyConfig,
  FontSizeConfig,
} from "../../types/reader";

/**
 * 基础排版参数
 */
export const TYPOGRAPHY_BASE: TypographyConfig = {
  /** 行高 - 中文长文最优 */
  lineHeight: 1.8,
  /** 段落间距 - 增加呼吸感 */
  paragraphSpacing: "1.5em",
  /** 内容最大宽度 - 中文适当放宽 */
  maxWidth: "70ch",
  /** 基础字体大小（rem） */
  fontSize: 1,
} as const;

/**
 * 字体大小预设配置
 */
export const FONT_SIZE_PRESETS: Record<FontSizePreset, FontSizeConfig> = {
  small: {
    id: "small",
    label: "小",
    fontSize: 0.875, // 14px
  },
  medium: {
    id: "medium",
    label: "中",
    fontSize: 1, // 16px
  },
  large: {
    id: "large",
    label: "大",
    fontSize: 1.125, // 18px
  },
} as const;

/**
 * 字体大小列表（用于 UI 渲染）
 */
export const FONT_SIZE_LIST: FontSizeConfig[] =
  Object.values(FONT_SIZE_PRESETS);

/**
 * 默认字体大小
 */
export const DEFAULT_FONT_SIZE: FontSizePreset = "medium";

/**
 * localStorage 存储键
 */
export const FONT_SIZE_STORAGE_KEY = "md-reader-font-size";

/**
 * 字体栈配置
 */
export const FONT_STACKS = {
  /** 中文阅读字体 */
  readingCn:
    '"LXGW WenKai", "Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif',
  /** 英文阅读字体 */
  readingEn: 'Georgia, "Times New Roman", serif',
  /** 代码字体 */
  code: '"JetBrains Mono", "Fira Code", "SF Mono", Menlo, Consolas, monospace',
} as const;

/**
 * 标题间距配置
 */
export const HEADING_SPACING = {
  /** 标题上间距 */
  marginTop: "2em",
  /** 标题下间距 */
  marginBottom: "1em",
} as const;

/**
 * 列表配置
 */
export const LIST_CONFIG = {
  /** 列表缩进 */
  indent: "1.5em",
  /** 列表项间距 */
  itemSpacing: "0.5em",
} as const;

/**
 * 生成排版 CSS 变量
 */
export function typographyToCssVariables(
  fontSize: FontSizePreset = "medium",
): Record<string, string> {
  const config = FONT_SIZE_PRESETS[fontSize];
  return {
    "--reader-line-height": String(TYPOGRAPHY_BASE.lineHeight),
    "--reader-paragraph-spacing": TYPOGRAPHY_BASE.paragraphSpacing,
    "--reader-max-width": TYPOGRAPHY_BASE.maxWidth,
    "--reader-font-size": `${config.fontSize}rem`,
    "--reader-font-reading-cn": FONT_STACKS.readingCn,
    "--reader-font-reading-en": FONT_STACKS.readingEn,
    "--reader-font-code": FONT_STACKS.code,
    "--reader-heading-margin-top": HEADING_SPACING.marginTop,
    "--reader-heading-margin-bottom": HEADING_SPACING.marginBottom,
    "--reader-list-indent": LIST_CONFIG.indent,
  };
}

/**
 * 从 localStorage 获取保存的字体大小
 */
export function getSavedFontSize(): FontSizePreset | null {
  if (typeof window === "undefined") return null;

  try {
    const saved = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    if (saved && saved in FONT_SIZE_PRESETS) {
      return saved as FontSizePreset;
    }
  } catch {
    // localStorage 不可用
  }
  return null;
}

/**
 * 保存字体大小到 localStorage
 */
export function saveFontSize(fontSize: FontSizePreset): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, fontSize);
  } catch {
    // localStorage 不可用
  }
}
