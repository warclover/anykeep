/**
 * i18n 请求配置
 *
 * 用于 next-intl 的服务端请求处理
 */

import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from "./config";

/** 从请求头或 cookie 获取语言偏好 */
async function getLocaleFromHeaders(): Promise<Locale> {
  // 1. 优先从 cookie 获取用户设置的语言
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("NEXT_LOCALE")?.value;
  if (localeCookie && SUPPORTED_LOCALES.includes(localeCookie as Locale)) {
    return localeCookie as Locale;
  }

  // 2. 从 Accept-Language 请求头获取
  const headerStore = await headers();
  const acceptLanguage = headerStore.get("accept-language");
  if (acceptLanguage) {
    // 解析 Accept-Language: zh-CN,zh;q=0.9,en;q=0.8
    const languages = acceptLanguage
      .split(",")
      .map((lang) => lang.split(";")[0].trim().toLowerCase());

    for (const lang of languages) {
      // 精确匹配
      if (SUPPORTED_LOCALES.includes(lang as Locale)) {
        return lang as Locale;
      }
      // 语言代码匹配 (zh-CN -> zh)
      const shortLang = lang.split("-")[0];
      if (SUPPORTED_LOCALES.includes(shortLang as Locale)) {
        return shortLang as Locale;
      }
    }
  }

  // 3. 返回默认语言
  return DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = await getLocaleFromHeaders();

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
