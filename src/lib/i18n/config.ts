/**
 * 国际化配置
 *
 * 使用 next-intl 进行多语言支持
 *
 * @see https://next-intl-docs.vercel.app/
 */

/** 支持的语言列表 */
export const SUPPORTED_LOCALES = ["zh-CN", "en-US"] as const;

/** 默认语言 */
export const DEFAULT_LOCALE =
  "zh-CN" satisfies (typeof SUPPORTED_LOCALES)[number];

/** 语言类型 */
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** 语言显示名称映射 */
export const LOCALE_NAMES: Record<Locale, string> = {
  "zh-CN": "简体中文",
  "en-US": "English",
} as const;

/** 语言区域代码映射（用于日期格式化等） */
export const LOCALE_TERRITORY: Record<Locale, string> = {
  "zh-CN": "CN",
  "en-US": "US",
} as const;
