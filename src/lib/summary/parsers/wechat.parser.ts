/**
 * 微信公众号解析器
 *
 * 从微信公众号文章 HTML 中提取正文内容
 * 支持域名: mp.weixin.qq.com, weixin.qq.com
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

/** 微信公众号去噪选择器 */
const WECHAT_NOISE_SELECTORS = [
  "#js_pc_qr_code",
  ".qr_code_pc",
  "#js_profile_qr_code",
  ".rich_media_tool_area",
  ".vote_area",
  "#js_toobar3",
  ".reward_area",
  ".original_area_primary",
] as const;

/** 匹配去噪区域的正则 */
const NOISE_PATTERNS = WECHAT_NOISE_SELECTORS.map((selector) => {
  // id 选择器: #js_pc_qr_code -> id="js_pc_qr_code"
  if (selector.startsWith("#")) {
    const id = selector.slice(1);
    return new RegExp(
      `<div[^>]*id=["']?${id}["']?[^>]*>[\\s\\S]*?</div>`,
      "gi",
    );
  }
  // class 选择器: .qr_code_pc -> class="...qr_code_pc..."
  const cls = selector.slice(1);
  return new RegExp(
    `<div[^>]*class=["'][^"']*${cls}[^"']*["'][^>]*>[\\s\\S]*?</div>`,
    "gi",
  );
});

/** 阅读原文链接模式 */
const READ_ORIGINAL_PATTERN =
  /<a[^>]*id=["']?js_view_source["']?[^>]*>[\s\S]*?<\/a>/gi;

/**
 * 从 HTML 中嵌套匹配提取指定 id 的 div 内容
 */
function extractDivById(html: string, id: string): string | null {
  const pattern = new RegExp(`<div[^>]*id=["']?${id}["']?[^>]*>`, "i");
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

  // 微信文章有时用加粗 section 代替标题
  if (headings.length === 0) {
    const strongRegex = /<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi;
    let strongMatch;
    while ((strongMatch = strongRegex.exec(html)) !== null) {
      const text = stripHtmlTags(strongMatch[1]).trim();
      // 仅将较短的加粗文本作为标题（避免误判）
      if (text && text.length >= 2 && text.length <= 50) {
        headings.push({ level: 3, text });
      }
    }
  }

  return headings;
}

/**
 * 将 HTML 转为纯文本，保留段落分隔
 */
function htmlToPlainText(html: string): string {
  let text = html;

  // 将块级标签转换为换行
  text = text.replace(/<\/(?:p|div|section|br|h[1-6]|li|blockquote)>/gi, "\n");
  text = text.replace(/<br\s*\/?>/gi, "\n");

  // 移除所有 HTML 标签
  text = stripHtmlTags(text);

  // 解码 HTML 实体
  text = decodeHtmlEntities(text);

  // 清理多余空白，保留段落分隔
  text = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n\n");

  return text.trim();
}

export const WechatParser: IPlatformParser = {
  name: "wechat",
  supportedDomains: ["mp.weixin.qq.com", "weixin.qq.com"],

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
    logger.debug({ url }, "微信公众号解析器: 开始解析");

    try {
      // 移除脚本和样式
      const cleanedHtml = removeScriptsAndStyles(html);

      // 提取 #js_content 正文区域
      let contentHtml = extractDivById(cleanedHtml, "js_content");

      if (!contentHtml) {
        // 降级: 尝试 #js_article
        contentHtml = extractDivById(cleanedHtml, "js_article");
      }

      if (!contentHtml) {
        logger.warn({ url }, "微信公众号解析器: 未找到正文区域，降级为全文");
        contentHtml = cleanedHtml;
      }

      // 去噪: 移除二维码、投票、打赏等区域
      for (const pattern of NOISE_PATTERNS) {
        contentHtml = contentHtml.replace(pattern, "");
      }

      // 去噪: 移除阅读原文链接
      contentHtml = contentHtml.replace(READ_ORIGINAL_PATTERN, "");

      // 提取标题层级
      const headings = extractHeadings(contentHtml);

      // 统计图片数量（去噪后）
      const imgMatches = contentHtml.match(/<img[^>]+>/gi) || [];
      const imageCount = imgMatches.filter((img) => {
        // 排除表情、图标、二维码
        if (/class=["'][^"']*(?:emoji|icon|qr)[^"']*["']/i.test(img)) {
          return false;
        }
        const widthMatch = img.match(/width=["']?(\d+)/i);
        if (widthMatch && parseInt(widthMatch[1]) < 50) return false;
        return true;
      }).length;

      // HTML 转纯文本
      const content = htmlToPlainText(contentHtml);

      // 计算字数
      const wordCount = content.replace(/\s+/g, "").length;

      // 计算置信度
      const confidence = contentHtml !== cleanedHtml ? 0.95 : 0.6;

      logger.debug(
        { url, wordCount, imageCount, headingCount: headings.length },
        "微信公众号解析器: 解析完成",
      );

      return {
        content,
        headings,
        imageCount,
        wordCount,
        platform: "wechat",
        confidence,
        metadata: {
          hasQrCode: html.includes("js_pc_qr_code"),
        },
      };
    } catch (error) {
      logger.error(
        { error, url },
        "微信公众号解析器: 解析失败，降级为原始文本",
      );

      const fallbackText = htmlToPlainText(removeScriptsAndStyles(html));
      return {
        content: fallbackText,
        wordCount: fallbackText.replace(/\s+/g, "").length,
        platform: "wechat",
        confidence: 0.3,
      };
    }
  },
};
