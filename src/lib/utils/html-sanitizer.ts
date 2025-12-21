/**
 * HTML 清理工具（客户端）
 *
 * 提供防御性的 XSS 防护，作为后端清理的补充层
 *
 * @module utils/html-sanitizer
 */

import DOMPurify from "isomorphic-dompurify";

// 允许的 HTML 标签（与后端保持一致）
const ALLOWED_TAGS = [
  // 结构标签
  "article",
  "section",
  "header",
  "footer",
  "nav",
  "aside",
  "main",
  "div",
  "span",
  "p",
  "br",
  "hr",
  // 标题标签
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  // 文本格式标签
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "del",
  "ins",
  "mark",
  "small",
  "sub",
  "sup",
  "abbr",
  "cite",
  "code",
  "pre",
  "kbd",
  "samp",
  "var",
  // 列表标签
  "ul",
  "ol",
  "li",
  "dl",
  "dt",
  "dd",
  // 引用标签
  "blockquote",
  "q",
  // 链接标签
  "a",
  // 图片标签
  "img",
  "figure",
  "figcaption",
  "picture",
  "source",
  // 表格标签
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "caption",
  "colgroup",
  "col",
  // 其他标签
  "details",
  "summary",
  "ruby",
  "rt",
  "rp",
  "wbr",
  "time",
  "address",
  "audio",
  "video",
];

// 允许的 HTML 属性
const ALLOWED_ATTRS = [
  // 通用属性
  "class",
  "id",
  "style",
  "title",
  "lang",
  "dir",
  "role",
  // 链接属性
  "href",
  "target",
  "rel",
  // 图片属性
  "src",
  "alt",
  "width",
  "height",
  "loading",
  "decoding",
  "referrerpolicy",
  "crossorigin",
  // 表格属性
  "colspan",
  "rowspan",
  "scope",
  "headers",
  // data 属性（用于样式和交互）
  "data-*",
  // 媒体属性
  "controls",
  "autoplay",
  "loop",
  "muted",
  "preload",
  "poster",
];

/**
 * 清理 HTML 内容（客户端使用）
 *
 * 使用 DOMPurify 移除潜在的 XSS 攻击向量
 *
 * @param html - 原始 HTML 内容
 * @param preserveStyles - 是否保留 style 属性（默认 true）
 * @returns 清理后的 HTML
 */
export function sanitizeHtml(html: string, preserveStyles = true): string {
  if (!html) return "";

  const allowedAttrs = preserveStyles
    ? ALLOWED_ATTRS
    : ALLOWED_ATTRS.filter((attr) => attr !== "style");

  const result = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: allowedAttrs,
    ALLOW_DATA_ATTR: true,
    KEEP_CONTENT: true,
    // 移除危险的 URI schemes
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|mailto|tel|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  });

  // 确保返回字符串类型
  return typeof result === "string" ? result : String(result);
}

/**
 * 清理 HTML 内容并移除图片标签
 *
 * 用于处理防盗链问题，在清理 XSS 的同时移除图片
 *
 * @param html - 原始 HTML 内容
 * @returns 清理后的 HTML（不含图片）
 */
export function sanitizeHtmlWithoutImages(html: string): string {
  if (!html) return "";

  const tagsWithoutImg = ALLOWED_TAGS.filter(
    (tag) => !["img", "picture", "source"].includes(tag),
  );

  const result = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: tagsWithoutImg,
    ALLOWED_ATTR: ALLOWED_ATTRS,
    ALLOW_DATA_ATTR: true,
    KEEP_CONTENT: true,
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|mailto|tel|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  });

  // 确保返回字符串类型
  return typeof result === "string" ? result : String(result);
}

/**
 * 检查 HTML 是否包含潜在的 XSS 风险
 *
 * 用于调试和监控
 *
 * @param html - 原始 HTML 内容
 * @returns 是否安全（true = 安全）
 */
export function isHtmlSafe(html: string): boolean {
  if (!html) return true;

  // 检查常见的 XSS 模式
  const xssPatterns = [
    /<script\b/i,
    /javascript:/i,
    /on\w+\s*=/i, // onclick, onerror, etc.
    /data:text\/html/i,
    /<iframe\b/i,
    /<object\b/i,
    /<embed\b/i,
    /<form\b/i,
    /expression\s*\(/i, // CSS expression
    /url\s*\(\s*["']?\s*javascript:/i,
  ];

  return !xssPatterns.some((pattern) => pattern.test(html));
}
