/**
 * 网页元数据解析工具
 * 从 HTML 中提取 Open Graph、meta 标签等元数据
 */

import { logger } from "@/lib/logger";
import { detectPlatformFromUrl } from "@/lib/platform-utils";
import { cleanText, escapeRegex } from "./html-utils";
import { extractWordCount, extractImageCount } from "./content-extractor";
import {
  extractWechatSourceAndAuthor,
  extractWechatPublishTime,
} from "./wechat-parser";

export interface WebMetadata {
  title: string;
  description: string;
  coverUrl: string;
  sourceName: string; // 来源名称（公众号名称、UP主频道名等）
  author: string; // 内容作者（文章撰写者、视频创作者等）
  publishTime: string; // 原文发布时间（ISO 8601 格式）
  platform: string;
  siteName: string;
  wordCount: number;
  imageCount: number;
}

/**
 * 从 HTML 字符串中提取元数据
 */
export function parseHTMLMetadata(html: string, url: string): WebMetadata {
  const platform = detectPlatformFromUrl(url);

  // 提取各种元数据
  const title = extractTitle(html);
  const description = extractDescription(html);
  const coverUrl = extractCoverImage(html, url);
  const { sourceName, author } = extractSourceAndAuthor(html, platform);
  const publishTime = extractPublishTime(html, platform);
  const siteName = extractSiteName(html);
  const wordCount = extractWordCount(html);
  const imageCount = extractImageCount(html);

  return {
    title,
    description,
    coverUrl,
    sourceName,
    author,
    publishTime,
    platform,
    siteName,
    wordCount,
    imageCount,
  };
}

/**
 * 提取页面标题
 * 优先级：og:title > twitter:title > <title>
 */
function extractTitle(html: string): string {
  // 1. Open Graph title
  const ogTitle = extractMetaContent(html, "og:title", "property");
  if (ogTitle) return cleanText(ogTitle);

  // 2. Twitter title
  const twitterTitle = extractMetaContent(html, "twitter:title", "name");
  if (twitterTitle) return cleanText(twitterTitle);

  // 3. HTML <title>
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) return cleanText(titleMatch[1]);

  return "";
}

/**
 * 提取页面描述
 * 优先级：og:description > twitter:description > meta description
 */
function extractDescription(html: string): string {
  // 1. Open Graph description
  const ogDesc = extractMetaContent(html, "og:description", "property");
  if (ogDesc) return cleanText(ogDesc);

  // 2. Twitter description
  const twitterDesc = extractMetaContent(html, "twitter:description", "name");
  if (twitterDesc) return cleanText(twitterDesc);

  // 3. Meta description
  const metaDesc = extractMetaContent(html, "description", "name");
  if (metaDesc) return cleanText(metaDesc);

  return "";
}

/**
 * 提取封面图片
 * 优先级：og:image > twitter:image > 页面内第一张大图
 */
function extractCoverImage(html: string, baseUrl: string): string {
  // 1. Open Graph image
  const ogImage = extractMetaContent(html, "og:image", "property");
  if (ogImage) return resolveUrl(ogImage, baseUrl);

  // 2. Twitter image
  const twitterImage = extractMetaContent(html, "twitter:image", "name");
  if (twitterImage) return resolveUrl(twitterImage, baseUrl);

  // 3. Twitter image:src (备用)
  const twitterImageSrc = extractMetaContent(html, "twitter:image:src", "name");
  if (twitterImageSrc) return resolveUrl(twitterImageSrc, baseUrl);

  return "";
}

/**
 * 提取来源名称和作者信息
 * 根据不同平台有不同的提取策略
 * 返回 { sourceName, author } 对象
 */
function extractSourceAndAuthor(
  html: string,
  platform: string,
): { sourceName: string; author: string } {
  // 1. 微信公众号：分别提取公众号名称和文章作者
  if (platform === "wechat" || platform === "WECHAT_OFFICIAL_ACCOUNT") {
    return extractWechatSourceAndAuthor(html);
  }

  // 2. B站：分别提取频道名称和 UP 主
  if (platform === "bilibili" || platform === "BILIBILI") {
    const author = extractBilibiliAuthor(html);
    return { sourceName: "", author };
  }

  // 3. 通用提取
  const ogAuthor = extractMetaContent(html, "article:author", "property");
  if (ogAuthor) return { sourceName: "", author: cleanText(ogAuthor) };

  const metaAuthor = extractMetaContent(html, "author", "name");
  if (metaAuthor) return { sourceName: "", author: cleanText(metaAuthor) };

  return { sourceName: "", author: "" };
}

/**
 * 提取网站名称
 */
function extractSiteName(html: string): string {
  const ogSiteName = extractMetaContent(html, "og:site_name", "property");
  if (ogSiteName) return cleanText(ogSiteName);

  return "";
}

/**
 * 提取发布时间
 * 根据不同平台有不同的提取策略
 * 返回 ISO 8601 格式的时间字符串
 */
function extractPublishTime(html: string, platform: string): string {
  // 1. 微信公众号：专门的提取逻辑
  if (platform === "wechat" || platform === "WECHAT_OFFICIAL_ACCOUNT") {
    return extractWechatPublishTime(html) || "";
  }

  // 2. 通用提取：article:published_time
  const articlePublishedTime = extractMetaContent(
    html,
    "article:published_time",
    "property",
  );
  if (articlePublishedTime) {
    const date = new Date(articlePublishedTime);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  // 3. 通用提取：datePublished (Schema.org)
  const datePublishedMatch = html.match(/"datePublished"\s*:\s*"([^"]+)"/);
  if (datePublishedMatch) {
    const date = new Date(datePublishedMatch[1]);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return "";
}

/**
 * 从 meta 标签中提取内容
 */
function extractMetaContent(
  html: string,
  name: string,
  attribute: "property" | "name",
): string {
  // 匹配两种顺序：attribute在前或content在前
  const patterns = [
    new RegExp(
      `<meta[^>]+${attribute}=["']${escapeRegex(name)}["'][^>]+content=["']([^"']+)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+${attribute}=["']${escapeRegex(name)}["']`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }

  return "";
}

/**
 * B站作者提取
 */
function extractBilibiliAuthor(html: string): string {
  // 方法1：从 __INITIAL_STATE__ 提取
  const stateMatch = html.match(/__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/);
  if (stateMatch) {
    try {
      const state = JSON.parse(stateMatch[1]);
      // 视频页面
      if (state.videoData?.owner?.name) {
        return state.videoData.owner.name;
      }
      // 文章页面
      if (state.readInfo?.author?.name) {
        return state.readInfo.author.name;
      }
    } catch {
      // JSON 解析失败，继续尝试其他方法
    }
  }

  // 方法2：从 meta 标签提取
  const metaAuthor = extractMetaContent(html, "author", "name");
  if (metaAuthor) return cleanText(metaAuthor);

  return "";
}

/**
 * 解析相对 URL 为绝对 URL
 */
function resolveUrl(urlStr: string, baseUrl: string): string {
  if (!urlStr) return "";

  // 已经是绝对 URL
  if (urlStr.startsWith("http://") || urlStr.startsWith("https://")) {
    return urlStr;
  }

  // 协议相对 URL
  if (urlStr.startsWith("//")) {
    try {
      const base = new URL(baseUrl);
      return `${base.protocol}${urlStr}`;
    } catch {
      return `https:${urlStr}`;
    }
  }

  // 相对 URL
  try {
    return new URL(urlStr, baseUrl).href;
  } catch {
    return urlStr;
  }
}

/**
 * 抓取网页内容
 */
export async function fetchWebContent(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
      signal: controller.signal,
      redirect: "follow",
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml")
    ) {
      throw new Error("不是有效的 HTML 页面");
    }

    const html = await response.text();
    return html;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new Error("请求超时，请检查链接是否可访问");
      }
      logger.error(
        { url, error: error.message, action: "fetch_web_content" },
        "Metadata Parser: fetch failed",
      );
      throw error;
    }
    throw new Error("网页抓取失败");
  }
}

/**
 * 完整的元数据获取流程
 */
export async function getWebMetadata(url: string): Promise<WebMetadata> {
  logger.info(
    { url, action: "get_metadata_start" },
    "Metadata Parser: fetching",
  );

  const html = await fetchWebContent(url);
  const metadata = parseHTMLMetadata(html, url);

  logger.info(
    {
      url,
      title: metadata.title.substring(0, 50),
      platform: metadata.platform,
      action: "get_metadata_success",
    },
    "Metadata Parser: success",
  );

  return metadata;
}
