/**
 * 分类系统基础工具函数
 *
 * 将多处重复实现的工具函数统一到此处。
 *
 * @version 1.0.0
 * @since 2026-03-10
 */

/**
 * 从 URL 中提取域名（去掉 www. 前缀，小写化）
 *
 * @returns 域名字符串，解析失败返回空字符串
 */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/**
 * 截断字符串到指定长度
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "…";
}
