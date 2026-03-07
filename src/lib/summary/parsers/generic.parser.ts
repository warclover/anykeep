/**
 * 增强通用解析器（兜底）
 *
 * 当没有匹配的平台解析器时使用，基于内容密度分析选择最优正文区块
 * 复用 extractMainContent 逻辑，并增加密度评分机制
 *
 * @version 1.0.0
 * @since 2026-03-07
 */

import { logger } from "@/lib/logger";
import { extractMainContent } from "@/lib/utils/content-extractor";
import {
  removeScriptsAndStyles,
  stripHtmlTags,
  decodeHtmlEntities,
} from "@/lib/utils/html-utils";
import type { IPlatformParser, ParsedContent } from "./parser.interface";

/** 正文候选选择器（按语义优先级排序） */
const CANDIDATE_SELECTORS = [
  "article",
  "main",
  '[role="main"]',
  ".post-content",
  ".entry-content",
  '[itemprop="articleBody"]',
  "#content",
  ".content",
  ".article-content",
  ".post-body",
] as const;

/**
 * 候选区块信息
 */
interface CandidateBlock {
  /** 选择器名称 */
  selector: string;
  /** HTML 内容 */
  html: string;
  /** 纯文本内容 */
  text: string;
  /** 文本/HTML 比率 */
  textDensity: number;
  /** 链接密度（链接文本占比） */
  linkDensity: number;
  /** 综合密度得分 */
  score: number;
}

/**
 * 通过选择器提取元素内容（正则模拟嵌套匹配）
 */
function extractElement(html: string, selector: string): string | null {
  let pattern: RegExp;
  let tagName: string;

  if (selector.startsWith("[")) {
    // 属性选择器: [role="main"] -> <... role="main" ...>
    const attrMatch = selector.match(/\[(\w+)=["']?([^"'\]]+)["']?\]/);
    if (!attrMatch) return null;
    const [, attr, value] = attrMatch;
    pattern = new RegExp(`<(\\w+)[^>]*${attr}=["']?${value}["']?[^>]*>`, "i");
    const match = html.match(pattern);
    if (!match || match.index === undefined) return null;
    tagName = match[1];
    return extractNestedContent(html, match.index + match[0].length, tagName);
  }

  if (selector.startsWith("#")) {
    // id 选择器
    const id = selector.slice(1);
    pattern = new RegExp(`<(\\w+)[^>]*id=["']?${id}["']?[^>]*>`, "i");
    const match = html.match(pattern);
    if (!match || match.index === undefined) return null;
    tagName = match[1];
    return extractNestedContent(html, match.index + match[0].length, tagName);
  }

  if (selector.startsWith(".")) {
    // class 选择器
    const cls = selector.slice(1);
    pattern = new RegExp(
      `<(\\w+)[^>]*class=["'][^"']*${cls}[^"']*["'][^>]*>`,
      "i",
    );
    const match = html.match(pattern);
    if (!match || match.index === undefined) return null;
    tagName = match[1];
    return extractNestedContent(html, match.index + match[0].length, tagName);
  }

  // 标签选择器: article, main
  tagName = selector;
  pattern = new RegExp(`<${tagName}[^>]*>`, "i");
  const match = html.match(pattern);
  if (!match || match.index === undefined) return null;
  return extractNestedContent(html, match.index + match[0].length, tagName);
}

/**
 * 嵌套标签内容提取
 */
function extractNestedContent(
  html: string,
  startIndex: number,
  tagName: string,
): string {
  let depth = 1;
  let currentIndex = startIndex;
  const tagLower = tagName.toLowerCase();

  const openTag = new RegExp(`<${tagLower}[\\s>]`, "gi");
  const closeTag = new RegExp(`</${tagLower}>`, "gi");

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
 * 计算文本密度（纯文本长度 / HTML 长度）
 */
function calculateTextDensity(html: string): number {
  if (!html || html.length === 0) return 0;
  const text = stripHtmlTags(html).replace(/\s+/g, "");
  return text.length / html.length;
}

/**
 * 计算链接密度（链接文本长度 / 总文本长度）
 */
function calculateLinkDensity(html: string): number {
  const text = stripHtmlTags(html).replace(/\s+/g, "");
  if (text.length === 0) return 1;

  // 提取所有链接文本
  const linkMatches = html.match(/<a[^>]*>([\s\S]*?)<\/a>/gi) || [];
  let linkTextLength = 0;
  for (const link of linkMatches) {
    const linkText = stripHtmlTags(link).replace(/\s+/g, "");
    linkTextLength += linkText.length;
  }

  return linkTextLength / text.length;
}

/**
 * 评估候选区块的综合得分
 * 高文本密度、低链接密度的区块得分更高
 */
function scoreCandidate(html: string, selector: string): CandidateBlock | null {
  const text = stripHtmlTags(html).replace(/\s+/g, "");

  // 文本过短，不是有效正文区域
  if (text.length < 50) return null;

  const textDensity = calculateTextDensity(html);
  const linkDensity = calculateLinkDensity(html);

  // 综合得分 = 文本密度 * (1 - 链接密度) * 文本长度权重
  const lengthFactor = Math.min(text.length / 500, 1);
  const score = textDensity * (1 - linkDensity) * (0.5 + 0.5 * lengthFactor);

  return {
    selector,
    html,
    text,
    textDensity,
    linkDensity,
    score,
  };
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
 * 将 HTML 转为纯文本，保留段落分隔
 */
function htmlToPlainText(html: string): string {
  let text = html;

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

export const GenericParser: IPlatformParser = {
  name: "generic",
  supportedDomains: [],

  canParse(): boolean {
    // 通用解析器始终可用（兜底）
    return true;
  },

  parse(html: string, url: string): ParsedContent {
    logger.debug({ url }, "通用解析器: 开始解析");

    try {
      const cleanedHtml = removeScriptsAndStyles(html);

      // 收集所有候选区块并评分
      const candidates: CandidateBlock[] = [];

      for (const selector of CANDIDATE_SELECTORS) {
        const elementHtml = extractElement(cleanedHtml, selector);
        if (elementHtml) {
          const candidate = scoreCandidate(elementHtml, selector);
          if (candidate) {
            candidates.push(candidate);
          }
        }
      }

      let contentHtml: string;
      let confidence: number;

      if (candidates.length > 0) {
        // 选择得分最高的候选区块
        candidates.sort((a, b) => b.score - a.score);
        const best = candidates[0];

        logger.debug(
          {
            url,
            selector: best.selector,
            score: best.score.toFixed(3),
            textDensity: best.textDensity.toFixed(3),
            linkDensity: best.linkDensity.toFixed(3),
          },
          "通用解析器: 选中最优区块",
        );

        contentHtml = best.html;
        // 置信度基于得分调整
        confidence = Math.min(0.4 + best.score * 0.5, 0.8);
      } else {
        // 无候选区块，降级到 extractMainContent
        logger.debug(
          { url },
          "通用解析器: 无候选区块，使用 extractMainContent 降级",
        );
        contentHtml = extractMainContent(html);
        confidence = 0.4;
      }

      // 提取标题层级
      const headings = extractHeadings(contentHtml);

      // 从 meta 获取页面标题
      const pageTitle = extractMetaContent(html, "og:title") || "";
      if (pageTitle && headings.length === 0) {
        headings.unshift({ level: 1, text: pageTitle });
      }

      // 统计图片
      const imgMatches = contentHtml.match(/<img[^>]+>/gi) || [];
      const imageCount = imgMatches.filter((img) => {
        if (/class=["'][^"']*(?:emoji|icon|avatar|logo)[^"']*["']/i.test(img)) {
          return false;
        }
        const widthMatch = img.match(/width=["']?(\d+)/i);
        if (widthMatch && parseInt(widthMatch[1]) < 50) return false;
        return true;
      }).length;

      // HTML 转纯文本
      const content = htmlToPlainText(contentHtml);
      const wordCount = content.replace(/\s+/g, "").length;

      // 提取域名作为平台标识
      let platform = "unknown";
      try {
        platform = new URL(url).hostname.replace(/^www\./, "");
      } catch {
        // 忽略 URL 解析错误
      }

      logger.debug(
        {
          url,
          wordCount,
          confidence,
          platform,
          candidateCount: candidates.length,
        },
        "通用解析器: 解析完成",
      );

      return {
        content,
        headings,
        imageCount,
        wordCount,
        platform,
        confidence,
      };
    } catch (error) {
      logger.error({ error, url }, "通用解析器: 解析失败，返回原始文本");

      const fallbackText = htmlToPlainText(removeScriptsAndStyles(html));
      return {
        content: fallbackText,
        wordCount: fallbackText.replace(/\s+/g, "").length,
        platform: "unknown",
        confidence: 0.1,
      };
    }
  },
};
