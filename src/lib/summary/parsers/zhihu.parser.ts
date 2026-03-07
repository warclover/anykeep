/**
 * 知乎解析器
 *
 * 从知乎专栏文章和回答页面提取正文内容
 * 支持域名: zhihu.com, zhuanlan.zhihu.com
 *
 * @version 1.0.0
 * @since 2026-03-07
 */

import { logger } from "@/lib/logger";
import {
  removeScriptsAndStyles,
  stripHtmlTags,
  decodeHtmlEntities,
} from "@/lib/utils/html-utils";
import type { IPlatformParser, ParsedContent } from "./parser.interface";

/** 知乎专栏正文选择器（按优先级排序） */
const ZHIHU_ARTICLE_SELECTORS = [
  "Post-RichTextContainer",
  "Post-RichText",
  "RichText",
] as const;

/** 知乎回答正文选择器（按优先级排序） */
const ZHIHU_ANSWER_SELECTORS = [
  "RichContent-inner",
  "AnswerItem",
  "RichText",
] as const;

/** 知乎去噪选择器 */
const ZHIHU_NOISE_PATTERNS = [
  // 关注按钮区域
  /<button[^>]*class=["'][^"']*FollowButton[^"']*["'][^>]*>[\s\S]*?<\/button>/gi,
  // 赞同区域
  /<div[^>]*class=["'][^"']*VoteButton[^"']*["'][^>]*>[\s\S]*?<\/div>/gi,
  /<button[^>]*class=["'][^"']*VoteButton[^"']*["'][^>]*>[\s\S]*?<\/button>/gi,
  // 推荐阅读
  /<div[^>]*class=["'][^"']*Recommendations?[^"']*["'][^>]*>[\s\S]*?<\/div>/gi,
  // 评论区
  /<div[^>]*class=["'][^"']*Comments?-container[^"']*["'][^>]*>[\s\S]*?<\/div>/gi,
  // 相关问题
  /<div[^>]*class=["'][^"']*RelatedReadings?[^"']*["'][^>]*>[\s\S]*?<\/div>/gi,
  // 广告
  /<div[^>]*class=["'][^"']*Pc-word[^"']*["'][^>]*>[\s\S]*?<\/div>/gi,
];

/**
 * 通过 class 名提取元素内容（支持嵌套）
 */
function extractByClass(html: string, className: string): string | null {
  const pattern = new RegExp(
    `<div[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>`,
    "i",
  );
  const match = html.match(pattern);
  if (!match || match.index === undefined) return null;

  const startIndex = match.index + match[0].length;
  let depth = 1;
  let currentIndex = startIndex;

  const openTag = /<div[\s>]/gi;
  const closeTag = /<\/div>/gi;

  while (depth > 0 && currentIndex < html.length) {
    openTag.lastIndex = currentIndex;
    closeTag.lastIndex = currentIndex;

    const openMatch = openTag.exec(html);
    const closeMatch = closeTag.exec(html);

    const openIndex = openMatch ? openMatch.index : Infinity;
    const closeIndex = closeMatch ? closeMatch.index : Infinity;

    if (closeIndex === Infinity) break;

    if (openIndex < closeIndex) {
      depth++;
      currentIndex = openIndex + (openMatch?.length ?? 0);
    } else {
      depth--;
      if (depth === 0) {
        return html.substring(startIndex, closeIndex);
      }
      currentIndex = closeIndex + (closeMatch?.length ?? 0);
    }
  }

  return html.substring(startIndex);
}

/**
 * 判断 URL 是否为知乎专栏文章
 */
function isZhuanlanArticle(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return (
      urlObj.hostname === "zhuanlan.zhihu.com" ||
      urlObj.pathname.startsWith("/p/")
    );
  } catch {
    return false;
  }
}

/**
 * 提取标题层级
 */
function extractHeadings(html: string): Array<{ level: number; text: string }> {
  const headings: Array<{ level: number; text: string }> = [];
  const headingRegex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let match;

  while ((match = headingRegex.exec(html)) !== null) {
    const level = parseInt(match[1], 10);
    const text = stripHtmlTags(match[2]).trim();
    if (text) {
      headings.push({ level, text });
    }
  }

  return headings;
}

/**
 * 从 meta 标签提取内容
 */
function extractMetaContent(html: string, name: string): string | null {
  const patterns = [
    new RegExp(
      `<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']*)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${name}["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]*property=["']${name}["'][^>]*content=["']([^"']*)["']`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtmlEntities(match[1].trim());
  }
  return null;
}

/**
 * 将知乎 HTML 转为纯文本，保留段落分隔
 */
function htmlToPlainText(html: string): string {
  let text = html;

  // 知乎特有: 将 figure 标签中的 figcaption 保留为描述
  text = text.replace(
    /<figure[^>]*>[\s\S]*?<figcaption[^>]*>([\s\S]*?)<\/figcaption>[\s\S]*?<\/figure>/gi,
    "\n[图片: $1]\n",
  );
  // 移除无 caption 的 figure
  text = text.replace(/<figure[^>]*>[\s\S]*?<\/figure>/gi, "");

  // 块级标签转换为换行
  text = text.replace(/<\/(?:p|div|section|br|h[1-6]|li|blockquote)>/gi, "\n");
  text = text.replace(/<br\s*\/?>/gi, "\n");

  // 移除所有 HTML 标签
  text = stripHtmlTags(text);

  // 解码实体
  text = decodeHtmlEntities(text);

  // 清理多余空白
  text = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n\n");

  return text.trim();
}

export const ZhihuParser: IPlatformParser = {
  name: "zhihu",
  supportedDomains: ["zhihu.com", "zhuanlan.zhihu.com"],

  canParse(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return this.supportedDomains.some(
        (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
      );
    } catch {
      return false;
    }
  },

  parse(html: string, url: string): ParsedContent {
    logger.debug({ url }, "知乎解析器: 开始解析");

    try {
      let cleanedHtml = removeScriptsAndStyles(html);

      // 去噪: 移除关注按钮、赞同区块、推荐阅读等
      for (const pattern of ZHIHU_NOISE_PATTERNS) {
        cleanedHtml = cleanedHtml.replace(pattern, "");
      }

      let contentHtml: string | null = null;
      let confidence = 0.5;
      const isArticle = isZhuanlanArticle(url);

      if (isArticle) {
        // 专栏文章: 按优先级尝试选择器
        for (const selector of ZHIHU_ARTICLE_SELECTORS) {
          contentHtml = extractByClass(cleanedHtml, selector);
          if (contentHtml) {
            confidence = 0.9;
            break;
          }
        }
      } else {
        // 问答页面: 按优先级尝试选择器
        for (const selector of ZHIHU_ANSWER_SELECTORS) {
          contentHtml = extractByClass(cleanedHtml, selector);
          if (contentHtml) {
            confidence = 0.85;
            break;
          }
        }
      }

      // 降级: 尝试通用 RichText
      if (!contentHtml) {
        contentHtml = extractByClass(cleanedHtml, "RichText");
        if (contentHtml) confidence = 0.7;
      }

      // 最终降级: 使用 meta 描述
      if (!contentHtml) {
        logger.warn({ url }, "知乎解析器: 未找到正文区域，降级为 meta 提取");

        const title = extractMetaContent(html, "og:title") || "";
        const description =
          extractMetaContent(html, "og:description") ||
          extractMetaContent(html, "description") ||
          "";

        const fallbackContent = [title, description]
          .filter(Boolean)
          .join("\n\n");

        return {
          content: decodeHtmlEntities(fallbackContent),
          wordCount: fallbackContent.replace(/\s+/g, "").length,
          platform: "zhihu",
          confidence: 0.35,
        };
      }

      // 提取标题层级
      const headings = extractHeadings(contentHtml);

      // 统计图片数量
      const imgMatches = contentHtml.match(/<img[^>]+>/gi) || [];
      const imageCount = imgMatches.filter((img) => {
        if (
          /class=["'][^"']*(?:emoji|icon|avatar|logo|origin_image)[^"']*["']/i.test(
            img,
          )
        ) {
          return false;
        }
        // 知乎公式图片通常带有 data-formula 属性
        if (/data-formula/i.test(img)) return false;
        return true;
      }).length;

      // HTML 转纯文本
      const content = htmlToPlainText(contentHtml);

      // 字数统计
      const wordCount = content.replace(/\s+/g, "").length;

      // 提取文章标题
      const pageTitle = extractMetaContent(html, "og:title") || "";
      if (pageTitle && headings.length === 0) {
        headings.unshift({ level: 1, text: pageTitle });
      }

      logger.debug(
        {
          url,
          wordCount,
          confidence,
          isArticle,
          headingCount: headings.length,
        },
        "知乎解析器: 解析完成",
      );

      return {
        content,
        headings,
        imageCount,
        wordCount,
        platform: "zhihu",
        confidence,
        metadata: {
          type: isArticle ? "article" : "answer",
        },
      };
    } catch (error) {
      logger.error({ error, url }, "知乎解析器: 解析失败，降级为原始文本");

      const fallbackText = htmlToPlainText(removeScriptsAndStyles(html));
      return {
        content: fallbackText,
        wordCount: fallbackText.replace(/\s+/g, "").length,
        platform: "zhihu",
        confidence: 0.2,
      };
    }
  },
};
