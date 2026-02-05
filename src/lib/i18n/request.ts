/**
 * i18n 请求配置
 *
 * 用于 next-intl 的服务端请求处理
 */

import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, type Locale } from "./config";

/** 从请求头��取语言偏好 */
function getLocaleFromHeaders(): Locale {
  // TODO: 从 cookie 或请求头中获取用户语言偏好
  // 当前返回默认语言
  return DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = getLocaleFromHeaders();

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
