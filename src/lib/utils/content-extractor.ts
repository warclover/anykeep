/**
 * 内容提取工具函数
 * 统一的字数统计、图片计数等功能
 */

import {
  removeScriptsAndStyles,
  stripHtmlTags,
  decodeHtmlEntities,
} from "./html-utils";

/**
 * 提取正文内容区域
 * 优先提取微信公众号正文、article、main 等语义化标签
 */
export function extractMainContent(html: string): string {
  // 移除脚本和样式
  const text = removeScriptsAndStyles(html);

  // 微信公众号正文
  const wechatContent = text.match(
    /<div[^>]*id="js_content"[^>]*>([\s\S]*?)<\/div>/i,
  );
  if (wechatContent) {
    return wechatContent[1];
  }

  // article 标签
  const articleContent = text.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (articleContent) {
    return articleContent[1];
  }

  // main 标签
  const mainContent = text.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainContent) {
    return mainContent[1];
  }

  // 无法识别，返回清理后的全文
  return text;
}

/**
 * 提取正文字数
 * 从 HTML 中提取纯文本并计算字数（中文按字符计算）
 */
export function extractWordCount(html: string): number {
  // 提取正文区域
  const content = extractMainContent(html);

  // 移除 HTML 标签并解码实体
  let text = stripHtmlTags(content);
  text = decodeHtmlEntities(text);

  // 移除所有空白字符
  text = text.replace(/\s+/g, "");

  return text.length;
}

/**
 * 提取图片数量
 * 统计 HTML 中的有效 img 标签数量（排除小图标、表情等）
 */
export function extractImageCount(html: string): number {
  // 提取正文区域
  const contentHtml = extractMainContent(html);

  // 匹配所有 img 标签
  const imgMatches = contentHtml.match(/<img[^>]+>/gi) || [];

  // 过滤掉小图片（如表情、图标等）
  const validImages = imgMatches.filter((img) => {
    // 排除带有 emoji、icon、avatar、logo、qr 类名的图片
    if (/class=["'][^"']*(?:emoji|icon|avatar|logo|qr)[^"']*["']/i.test(img)) {
      return false;
    }

    // 排除过小的图片（宽高小于 50px）
    const widthMatch = img.match(/width=["']?(\d+)/i);
    const heightMatch = img.match(/height=["']?(\d+)/i);
    if (widthMatch && parseInt(widthMatch[1]) < 50) return false;
    if (heightMatch && parseInt(heightMatch[1]) < 50) return false;

    return true;
  });

  return validImages.length;
}
