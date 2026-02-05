/**
 * i18n React Hooks
 *
 * 提供国际化相关的 React Hooks
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getCurrentLocale,
  setLocale,
  getCurrentUiText,
} from "./ui-text-constants";
import type { Locale, Messages } from "./ui-text-constants";

/** 获取当前语言的 UI 文本 Hook */
export function useUiText(): Messages {
  const [messages, setMessages] = useState<Messages>(getCurrentUiText());

  useEffect(() => {
    // 监听语言变化事件
    const handleLocaleChange = () => {
      setMessages(getCurrentUiText());
    };

    window.addEventListener(
      "locale-changed",
      handleLocaleChange as EventListener,
    );
    return () => {
      window.removeEventListener(
        "locale-changed",
        handleLocaleChange as EventListener,
      );
    };
  }, []);

  return messages;
}

/** 获取当前语言 Hook */
export function useLocale(): Locale {
  const [locale, setLocaleState] = useState<Locale>(getCurrentLocale);

  useEffect(() => {
    const handleLocaleChange = (e: CustomEvent) => {
      setLocaleState(e.detail as Locale);
    };

    window.addEventListener(
      "locale-changed",
      handleLocaleChange as EventListener,
    );
    return () => {
      window.removeEventListener(
        "locale-changed",
        handleLocaleChange as EventListener,
      );
    };
  }, []);

  return locale;
}

/** 设置语言 Hook */
export function useSetLocale(): (locale: Locale) => void {
  return useCallback((locale: Locale) => {
    setLocale(locale);
  }, []);
}

/** 语言切换 Hook */
export function useLanguageSwitch() {
  const locale = useLocale();
  const setLocaleFn = useSetLocale();

  return {
    locale,
    setLocale: setLocaleFn,
    toggleLanguage: () => {
      setLocaleFn(locale === "zh-CN" ? "en-US" : "zh-CN");
    },
  };
}

/** 辅助函数：根据语言获取消息（供服务端组件使用） */
export async function getMessages(locale: Locale): Promise<Messages> {
  // 动态导入语言文件
  switch (locale) {
    case "zh-CN":
      return (await import("@/lib/messages/zh-CN.json")).default as Messages;
    case "en-US":
      return (await import("@/lib/messages/en-US.json")).default as Messages;
    default:
      return (await import("@/lib/messages/zh-CN.json")).default as Messages;
  }
}
