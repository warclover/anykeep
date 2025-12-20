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
import {
  removeScriptsAndStyles,
  stripHtmlTags,
  decodeHtmlEntities,
} from "@/lib/utils/html-utils";
import type {
  WechatArticleContent,
  WechatArticleImage,
} from "../wechat-article.types";
import {
  ALLOWED_HTML_TAGS,
  ALLOWED_HTML_ATTRS,
  DEFAULT_CRAWL_CONFIG,
} from "../wechat-article.config";
import { extractImages } from "./image.processor";

// =============================================================================
// HTML 清理
// =============================================================================

/**
 * 清理微信文章 HTML
 *
 * 保留正文结构，移除：
 * - 脚本和样式
 * - 追踪代码
 * - 空白节点
 * - 危险属性
 */
function sanitizeWechatHtml(html: string): string {
  if (!html) return "";

  let result = html;

  // 1. 移除脚本和样式
  result = removeScriptsAndStyles(result);

  // 2. 移除微信追踪元素
  result = result.replace(/<mpvoice[^>]*>[\s\S]*?<\/mpvoice>/gi, "");
  result = result.replace(/<mpvideosnap[^>]*>[\s\S]*?<\/mpvideosnap>/gi, "");
  result = result.replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, "");

  // 3. 移除空的 section/div
  result = result.replace(/<(section|div)[^>]*>\s*<\/\1>/gi, "");

  // 4. 移除 data-* 属性（保留 data-src）
  result = result.replace(/\s+data-(?!src)[a-z-]+="[^"]*"/gi, "");

  // 5. 移除 style 属性中的危险内容
  result = result.replace(
    /style="[^"]*(?:javascript|expression|url\s*\()[^"]*"/gi,
    'style=""',
  );

  // 6. 移除事件处理器
  result = result.replace(/\s+on\w+="[^"]*"/gi, "");

  // 7. 清理连续空白
  result = result.replace(/\n{3,}/g, "\n\n");

  return result.trim();
}

/**
 * 使用 DOMPurify 清理 HTML（如果可用）
 *
 * 注意：此函数需要在 Node.js 环境中使用 isomorphic-dompurify
 */
async function purifyHtml(html: string): Promise<string> {
  try {
    // 动态导入以支持服务端渲染
    const DOMPurify = (await import("isomorphic-dompurify")).default;

    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ALLOWED_HTML_TAGS,
      ALLOWED_ATTR: ALLOWED_HTML_ATTRS,
      ALLOW_DATA_ATTR: true,
      KEEP_CONTENT: true,
    });
  } catch {
    // DOMPurify 不可用时使用基础清理
    // Note: Using error level because ESLint rules restrict console methods
    console.error(
      "[ContentProcessor] DOMPurify not available, using basic sanitization",
    );
    return sanitizeWechatHtml(html);
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
 * 替换图片 URL 为持久化 URL
 */
export function replaceImageUrls(
  html: string,
  images: WechatArticleImage[],
): string {
  let result = html;

  for (const img of images) {
    if (img.persistedUrl && img.status !== "failed") {
      // 替换 src 和 data-src
      result = result.replace(
        new RegExp(`(src|data-src)="${escapeRegExp(img.originalUrl)}"`, "g"),
        `$1="${img.persistedUrl}"`,
      );
    }
  }

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
 * @param html - 原始 HTML（通常来自 readable_content）
 * @param originalUrl - 原始 URL（用于解析相对路径）
 * @returns 处理后的文章内容
 */
export async function processWechatContent(
  html: string,
  _originalUrl: string,
): Promise<WechatArticleContent> {
  if (!html) {
    return {
      html: "",
      text: "",
      markdown: null,
      images: [],
      wordCount: 0,
    };
  }

  // 1. 提取正文区域
  const mainContent = extractMainContent(html);

  // 2. 转换 data-src 为 src
  const withSrc = convertDataSrcToSrc(mainContent);

  // 3. 清理 HTML（使用 DOMPurify 如果可用）
  const cleanedHtml = await purifyHtml(withSrc);

  // 4. 提取图片列表
  const images = extractImages(cleanedHtml);

  // 5. 提取纯文本
  let text = stripHtmlTags(cleanedHtml);
  text = decodeHtmlEntities(text);
  text = text.replace(/\s+/g, " ").trim();

  // 6. 计算字数
  const wordCount = extractWordCount(html);

  // 7. 转换为 Markdown（如果启用）
  let markdown: string | null = null;
  if (DEFAULT_CRAWL_CONFIG.enableMarkdown) {
    markdown = htmlToMarkdown(cleanedHtml);
  }

  return {
    html: cleanedHtml,
    text,
    markdown,
    images,
    wordCount,
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
