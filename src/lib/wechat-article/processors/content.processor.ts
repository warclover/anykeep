/**
 * 微信文章内容处理器
 *
 * @module wechat-article/processors
 * @description 处理微信公众号文章正文内容
 */

import {
  extractMainContent,
  extractWordCount,
} from "@/lib/utils/content-extractor";
import { logger } from "@/lib/logger";
import {
  removeScriptsAndStyles,
  stripHtmlTags,
  decodeHtmlEntities,
} from "@/lib/utils/html-utils";
import type {
  WechatArticleContent,
  WechatArticleImage,
  CrawlOptions,
} from "../wechat-article.types";
import {
  ALLOWED_HTML_TAGS,
  ALLOWED_HTML_ATTRS,
  DEFAULT_CRAWL_CONFIG,
  DEFAULT_STYLE_PRESERVE_LEVEL,
  getStylePropertiesByLevel,
  getDangerousValuesByLevel,
  type StylePreserveLevel,
} from "../wechat-article.config";
import { extractImages } from "./image.processor";
import { processMediaElements } from "./media.processor";

// =============================================================================
// HTML 清理
// =============================================================================

/**
 * 清理单个 style 属性值
 *
 * 保留安全的样式属性，移除危险内容
 * Phase 1 升级：样式保留功能
 * 样式选项升级：支持 text-only / full-snapshot 两种级别
 *
 * @param styleValue - 原始 style 属性值
 * @param styleLevel - 样式保留级别
 * @returns 清理后的安全样式字符串
 */
function sanitizeStyleAttribute(
  styleValue: string,
  styleLevel: StylePreserveLevel = DEFAULT_STYLE_PRESERVE_LEVEL,
): string {
  if (!styleValue) return "";

  // 根据级别获取属性白名单和危险值黑名单
  const allowedProperties = getStylePropertiesByLevel(styleLevel);
  const dangerousValues = getDangerousValuesByLevel(styleLevel);

  // 解析 style 为键值对
  const styles = styleValue.split(";").filter(Boolean);
  const safeStyles: string[] = [];

  for (const style of styles) {
    const colonIndex = style.indexOf(":");
    if (colonIndex === -1) continue;

    const prop = style.substring(0, colonIndex).trim().toLowerCase();
    const value = style.substring(colonIndex + 1).trim();

    if (!prop || !value) continue;

    // 检查属性是否在白名单中
    if (!allowedProperties.includes(prop)) continue;

    // 检查值是否包含危险内容
    const isDangerous = dangerousValues.some((pattern) => pattern.test(value));
    if (isDangerous) continue;

    // full-snapshot 模式下，额外检查 background 属性的 url()
    // （基础危险值已经包含 url() 过滤，但这里做双重保护）
    if (
      styleLevel === "full-snapshot" &&
      (prop === "background" || prop === "background-image")
    ) {
      if (/url\s*\(/i.test(value)) continue;
    }

    safeStyles.push(`${prop}: ${value}`);
  }

  return safeStyles.join("; ");
}

/**
 * 清理 HTML 并保留安全的样式
 *
 * 样式选项升级：支持 text-only / full-snapshot 两种级别
 *
 * @param html - 原始 HTML
 * @param styleLevel - 样式保留级别
 * @returns 清理后的 HTML（保留对应级别的样式）
 */
function sanitizeHtmlWithStyles(
  html: string,
  styleLevel: StylePreserveLevel = DEFAULT_STYLE_PRESERVE_LEVEL,
): string {
  if (!html) return "";

  let result = html;

  // 清理所有 style 属性，只保留安全的样式
  result = result.replace(/style="([^"]*)"/gi, (_match, styleValue) => {
    const safeStyle = sanitizeStyleAttribute(styleValue, styleLevel);
    return safeStyle ? `style="${safeStyle}"` : "";
  });

  // 清理 style='...' 单引号格式
  result = result.replace(/style='([^']*)'/gi, (_match, styleValue) => {
    const safeStyle = sanitizeStyleAttribute(styleValue, styleLevel);
    return safeStyle ? `style="${safeStyle}"` : "";
  });

  return result;
}

/**
 * 清理微信文章 HTML
 *
 * 保留正文结构，移除：
 * - 脚本和样式标签（<style>/<script>）
 * - 追踪代码
 * - 空白节点
 * - 危险属性
 *
 * 注意：inline style 属性通过 sanitizeHtmlWithStyles 单独处理
 *
 * @param html - 原始 HTML
 * @param styleLevel - 样式保留级别
 */
function sanitizeWechatHtml(
  html: string,
  styleLevel: StylePreserveLevel = DEFAULT_STYLE_PRESERVE_LEVEL,
): string {
  if (!html) return "";

  let result = html;

  // 1. 移除脚本和样式标签
  result = removeScriptsAndStyles(result);

  // 2. 移除微信追踪元素
  result = result.replace(/<mpvoice[^>]*>[\s\S]*?<\/mpvoice>/gi, "");
  result = result.replace(/<mpvideosnap[^>]*>[\s\S]*?<\/mpvideosnap>/gi, "");
  result = result.replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, "");

  // 3. 移除空的 section/div
  result = result.replace(/<(section|div)[^>]*>\s*<\/\1>/gi, "");

  // 4. 移除 data-* 属性（保留 data-src）
  result = result.replace(/\s+data-(?!src)[a-z-]+="[^"]*"/gi, "");

  // 5. 清理 inline style（根据级别保留样式）- 样式选项升级
  result = sanitizeHtmlWithStyles(result, styleLevel);

  // 6. 移除事件处理器
  result = result.replace(/\s+on\w+="[^"]*"/gi, "");

  // 7. 清理连续空白
  result = result.replace(/\n{3,}/g, "\n\n");

  return result.trim();
}

/**
 * 使用 DOMPurify 清理 HTML（如果可用）
 *
 * Phase 1 升级：在 DOMPurify 处理后，额外清理 style 属性保留安全样式
 * 样式选项升级：支持 text-only / full-snapshot 两种级别
 *
 * 注意：此函数需要在 Node.js 环境中使用 isomorphic-dompurify
 *
 * @param html - 原始 HTML
 * @param styleLevel - 样式保留级别
 */
async function purifyHtml(
  html: string,
  styleLevel: StylePreserveLevel = DEFAULT_STYLE_PRESERVE_LEVEL,
): Promise<string> {
  try {
    // 动态导入以支持服务端渲染
    const DOMPurify = (await import("isomorphic-dompurify")).default;

    // 使用 DOMPurify 清理 HTML
    let purified = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ALLOWED_HTML_TAGS,
      ALLOWED_ATTR: ALLOWED_HTML_ATTRS,
      ALLOW_DATA_ATTR: true,
      KEEP_CONTENT: true,
    });

    // 样式选项升级：根据级别清理 style 属性
    purified = sanitizeHtmlWithStyles(purified, styleLevel);

    return purified;
  } catch {
    // DOMPurify 不可用时使用基础清理
    logger.error(
      {},
      "[ContentProcessor] DOMPurify not available, using basic sanitization",
    );
    return sanitizeWechatHtml(html, styleLevel);
  }
}

// =============================================================================
// 图片 URL 替换
// =============================================================================

/**
 * 将 data-src 转换为 src
 *
 * 微信使用 data-src 懒加载图片
 */
function convertDataSrcToSrc(html: string): string {
  return html.replace(
    /<img([^>]*)data-src="([^"]+)"([^>]*)>/gi,
    (match, before, src, after) => {
      // 如果已有 src 属性，替换它
      if (/src="[^"]*"/.test(before + after)) {
        return match.replace(/src="[^"]*"/, `src="${src}"`);
      }
      // 否则添加 src 属性
      return `<img${before}src="${src}"${after}>`;
    },
  );
}

/**
 * 为所有 img 标签添加防盗链属性
 *
 * 添加 referrerPolicy="no-referrer" 绕过微信防盗链检测
 * 注意：不使用 crossOrigin="anonymous"，因为它会触发 CORS 检查导致失败
 */
function addImageReferrerPolicy(html: string): string {
  return html.replace(/<img([^>]*)>/gi, (match, attrs) => {
    // 如果已有 referrerpolicy 属性，跳过
    if (/referrerpolicy/i.test(attrs)) {
      return match;
    }
    // 只添加 referrerPolicy 属性
    return `<img${attrs} referrerpolicy="no-referrer">`;
  });
}

/**
 * 替换图片 URL 为持久化 URL
 *
 * 优先使用已持久化的 Supabase Storage URL
 * 未持久化的图片保持原 URL（配合 referrerPolicy="no-referrer" 解决防盗链）
 */
export function replaceImageUrls(
  html: string,
  images: WechatArticleImage[],
): string {
  let result = html;

  for (const img of images) {
    // 只替换成功持久化的图片 URL
    if (img.persistedUrl && img.status === "success") {
      result = result.replace(
        new RegExp(`(src|data-src)="${escapeRegExp(img.originalUrl)}"`, "g"),
        `$1="${img.persistedUrl}"`,
      );
    }
  }

  // 为所有图片添加 referrerPolicy（解决防盗链）
  result = addImageReferrerPolicy(result);

  return result;
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// =============================================================================
// Markdown 转换
// =============================================================================

/**
 * 将清理后的 HTML 转换为 Markdown
 *
 * 简化版转换，保留基本格式
 */
function htmlToMarkdown(html: string): string {
  if (!html) return "";

  let md = html;

  // 标题
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n");
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n");
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n");
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n#### $1\n");
  md = md.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, "\n##### $1\n");
  md = md.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, "\n###### $1\n");

  // 强调
  md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**");
  md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**");
  md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*");
  md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, "*$1*");

  // 链接
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");

  // 图片
  md = md.replace(
    /<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi,
    "![$2]($1)",
  );
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, "![]($1)");

  // 代码
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");
  md = md.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, "\n```\n$1\n```\n");

  // 引用
  md = md.replace(
    /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi,
    (_, content) => {
      return content
        .split("\n")
        .map((line: string) => `> ${line.trim()}`)
        .join("\n");
    },
  );

  // 列表
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n");
  md = md.replace(/<\/?[ou]l[^>]*>/gi, "\n");

  // 段落和换行
  md = md.replace(/<br\s*\/?>/gi, "\n");
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n$1\n");

  // 移除剩余标签
  md = stripHtmlTags(md);

  // 解码 HTML 实体
  md = decodeHtmlEntities(md);

  // 清理空白
  md = md.replace(/\n{3,}/g, "\n\n");
  md = md.replace(/^\s+|\s+$/g, "");

  return md;
}

// =============================================================================
// 主处理函数
// =============================================================================

/**
 * 处理微信文章内容
 *
 * Phase 3 升级：增加媒体元素处理
 * 样式选项升级：支持 text-only / full-snapshot 两种级别
 *
 * @param html - 原始 HTML（通常来自 readable_content）
 * @param originalUrl - 原始 URL（用于解析相对路径）
 * @param options - 处理选项
 * @param options.styleLevel - 样式保留级别
 * @returns 处理后的文章内容
 */
export async function processWechatContent(
  html: string,
  _originalUrl: string,
  options: CrawlOptions = {},
): Promise<WechatArticleContent> {
  const { styleLevel = DEFAULT_STYLE_PRESERVE_LEVEL } = options;

  if (!html) {
    return {
      html: "",
      text: "",
      markdown: null,
      images: [],
      media: [],
      wordCount: 0,
      styleLevel,
    };
  }

  // 1. 提取正文区域
  const mainContent = extractMainContent(html);

  // 2. 转换 data-src 为 src
  const withSrc = convertDataSrcToSrc(mainContent);

  // 3. Phase 3 升级：处理媒体元素（在清理 HTML 之前，保留占位卡片）
  const { html: htmlWithMediaPlaceholders, media } =
    processMediaElements(withSrc);

  // 4. 清理 HTML（使用 DOMPurify 如果可用，根据 styleLevel 保留样式）
  const cleanedHtml = await purifyHtml(htmlWithMediaPlaceholders, styleLevel);

  // 5. 提取图片列表
  const images = extractImages(cleanedHtml);

  // 6. 提取纯文本
  let text = stripHtmlTags(cleanedHtml);
  text = decodeHtmlEntities(text);
  text = text.replace(/\s+/g, " ").trim();

  // 7. 计算字数
  const wordCount = extractWordCount(html);

  // 8. 转换为 Markdown（如果启用）
  let markdown: string | null = null;
  if (DEFAULT_CRAWL_CONFIG.enableMarkdown) {
    markdown = htmlToMarkdown(cleanedHtml);
  }

  return {
    html: cleanedHtml,
    text,
    markdown,
    images,
    media,
    wordCount,
    styleLevel,
  };
}

/**
 * 仅提取纯文本内容
 *
 * 用于全文搜索和内容比较
 */
export function extractTextContent(html: string): string {
  const mainContent = extractMainContent(html);
  let text = stripHtmlTags(mainContent);
  text = decodeHtmlEntities(text);
  text = text.replace(/\s+/g, " ").trim();
  return text;
}
