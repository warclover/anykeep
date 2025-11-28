/**
 * HTML 工具函数
 * 统一的 HTML 实体解码、文本清理等功能
 */

/**
 * HTML 实体解码
 * 将 &#x2F; -> / 等 HTML 实体转换为实际字符
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) return text;

  return (
    text
      // 十六进制数字实体 &#x2F; -> /
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16)),
      )
      // 十进制数字实体 &#47; -> /
      .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
      // 命名实体
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&mdash;/g, "—")
      .replace(/&ndash;/g, "–")
      .replace(/&hellip;/g, "…")
      .replace(/&copy;/g, "©")
      .replace(/&reg;/g, "®")
      .replace(/&trade;/g, "™")
  );
}

/**
 * 清理文本：HTML 实体解码 + 去除多余空白
 */
export function cleanText(text: string): string {
  return decodeHtmlEntities(text).replace(/\s+/g, " ").trim();
}

/**
 * 转义正则表达式特殊字符
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 从 HTML 中移除脚本和样式标签
 */
export function removeScriptsAndStyles(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "");
}

/**
 * 移除所有 HTML 标签，保留纯文本
 */
export function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]+>/g, "");
}
