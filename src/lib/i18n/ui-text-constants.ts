/**
 * UI 文本常量管理
 *
 * 集中管理所有 UI 显示文本，支持国际化
 *
 * 使用方式：
 * ```tsx
 * import { uiText } from "@/lib/i18n/ui-text-constants";
 *
 * <Button>{uiText.common.confirm}</Button>
 * ```
 *
 * 或使用 Hook（组件内推荐）：
 * ```tsx
 * import { useUiText } from "@/lib/i18n/hooks";
 *
 * const t = useUiText();
 * <Button>{t.common.confirm}</Button>
 * ```
 */

import messagesZhCN from "../messages/zh-CN.json";
import messagesEnUS from "../messages/en-US.json";
import type { Locale } from "./config";

/** 导出 Locale 类型供外部使用 */
export type { Locale } from "./config";

/** 所有语言消息类型 */
type Messages = typeof messagesZhCN;

/** 获取指定语言的消息 */
export function getMessages(locale: Locale): Messages {
  switch (locale) {
    case "zh-CN":
      return messagesZhCN as Messages;
    case "en-US":
      return messagesEnUS as Messages;
    default:
      return messagesZhCN as Messages;
  }
}

/** 当前语言（从 localStorage 或默认值） */
export function getCurrentLocale(): Locale {
  if (typeof window === "undefined") return "zh-CN";

  try {
    const stored = localStorage.getItem("anykeep-locale");
    if (stored && (stored === "zh-CN" || stored === "en-US")) {
      return stored as Locale;
    }
  } catch {
    // Ignore localStorage errors
  }
  return "zh-CN";
}

/** 设置语言 */
export function setLocale(locale: Locale): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem("anykeep-locale", locale);
    // 触发自定义事件，让其他组件知道语言已更改
    window.dispatchEvent(new CustomEvent("locale-changed", { detail: locale }));
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * UI 文本常量（服务端/默认中文）
 *
 * 这是静态导出，用于不支持 Hook 的场景
 */
export const uiText = getMessages("zh-CN");

/**
 * 获取当前语言的 UI 文本
 *
 * @returns 当前语言的 UI 文本对象
 */
export function getCurrentUiText(): Messages {
  return getMessages(getCurrentLocale());
}

/** 导出消息类型供类型推导使用 */
export type { Messages };
