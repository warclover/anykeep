/**
 * 国际化 (i18n) 模块
 *
 * 提供 UI 文本多语言支持
 *
 * @example 在组件中使用
 * ```tsx
 * import { useUiText } from "@/lib/i18n";
 *
 * function MyComponent() {
 *   const t = useUiText();
 *   return <Button>{t.common.confirm}</Button>;
 * }
 * ```
 *
 * @example 语言切换
 * ```tsx
 * import { useLanguageSwitch } from "@/lib/i18n";
 *
 * function LanguageSwitcher() {
 *   const { locale, toggleLanguage } = useLanguageSwitch();
 *   return (
 *     <Button onClick={toggleLanguage}>
 *       {locale === "zh-CN" ? "English" : "中文"}
 *     </Button>
 *   );
 * }
 * ```
 */

// 配置
export { SUPPORTED_LOCALES, DEFAULT_LOCALE, type Locale } from "./config";
export { LOCALE_NAMES, LOCALE_TERRITORY } from "./config";

// Hooks
export { useUiText, useLocale, useSetLocale, useLanguageSwitch } from "./hooks";

// 工具函数
export {
  setLocale,
  uiText,
  getCurrentUiText,
  getMessages,
} from "./ui-text-constants";
export type { Messages } from "./ui-text-constants";
