/**
 * 内容爬虫工具函数
 * 从微信公众号、B站、小红书等平台爬取元数据
 */

import { logger } from "@/lib/logger";
import { decodeHtmlEntities } from "./html-utils";
import { extractWordCount, extractImageCount } from "./content-extractor";
import {
  extractWechatSourceAndAuthor,
  extractWechatPublishTime,
} from "./wechat-parser";

export interface CrawlResult {
  title: string;
  sourceName?: string; // 来源名称（公众号名称、UP主频道名等）
  author?: string; // 内容作者（文章撰写者、视频创作者等）
  coverUrl?: string;
  description?: string;
  platform: "WECHAT_OFFICIAL_ACCOUNT" | "BILIBILI" | "XIAOHONGSHU" | "UNKNOWN";
  wordCount?: number;
  imageCount?: number;
  publishTime?: string; // 原文发布时间（ISO 8601 格式）
}

/**
 * 识别 URL 所属平台
 */
function detectPlatform(url: string): CrawlResult["platform"] {
  try {
    const hostname = new URL(url).hostname.toLowerCase();

    if (
      hostname.includes("weixin.qq.com") ||
      hostname.includes("mp.weixin.qq.com")
    ) {
      return "WECHAT_OFFICIAL_ACCOUNT";
    }
    if (hostname.includes("bilibili.com") || hostname.includes("b23.tv")) {
      return "BILIBILI";
    }
    if (
      hostname.includes("xiaohongshu.com") ||
      hostname.includes("xhslink.com")
    ) {
      return "XIAOHONGSHU";
    }

    return "UNKNOWN";
  } catch {
    return "UNKNOWN";
  }
}

/**
 * 从 HTML 中提取 meta 标签内容
 */
function extractMetaTag(html: string, name: string): string | undefined {
  // 匹配 <meta property="og:title" content="..." /> 或 <meta name="title" content="..." />
  const propertyRegex = new RegExp(
    `<meta\\s+property=["']${name}["']\\s+content=["']([^"']+)["']`,
    "i",
  );
  const nameRegex = new RegExp(
    `<meta\\s+name=["']${name}["']\\s+content=["']([^"']+)["']`,
    "i",
  );

  const match = html.match(propertyRegex) || html.match(nameRegex);
  // 解码 HTML 实体
  return match ? decodeHtmlEntities(match[1]) : undefined;
}

/**
 * 从 HTML 中提取 <title> 标签
 */
function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  // 解码 HTML 实体
  return match ? decodeHtmlEntities(match[1].trim()) : undefined;
}

/**
 * 爬取网页内容
 */
async function fetchPage(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
      // 设置超时
      signal: AbortSignal.timeout(10000), // 10秒超时
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`网页访问失败: ${error.message}`);
    }
    throw new Error("网页访问失败");
  }
}

/**
 * 爬取微信公众号文章
 */
async function crawlWechat(url: string): Promise<Partial<CrawlResult>> {
  const html = await fetchPage(url);

  // 提取标题
  const title =
    extractMetaTag(html, "og:title") ||
    extractMetaTag(html, "twitter:title") ||
    extractTitle(html) ||
    "未知标题";

  // 分别提取公众号名称和文章作者
  const { sourceName, author } = extractWechatSourceAndAuthor(html);

  // 提取发布时间
  const publishTime = extractWechatPublishTime(html);

  // 提取封面
  const coverUrl =
    extractMetaTag(html, "og:image") || extractMetaTag(html, "twitter:image");

  // 提取描述
  const description =
    extractMetaTag(html, "og:description") ||
    extractMetaTag(html, "description");

  // 提取字数和图片数
  const wordCount = extractWordCount(html);
  const imageCount = extractImageCount(html);

  return {
    title,
    sourceName,
    author,
    publishTime,
    coverUrl,
    description,
    wordCount,
    imageCount,
  };
}

/**
 * 爬取 B 站视频
 */
async function crawlBilibili(url: string): Promise<Partial<CrawlResult>> {
  const html = await fetchPage(url);

  // 提取标题
  const title =
    extractMetaTag(html, "og:title") ||
    extractMetaTag(html, "title") ||
    extractTitle(html) ||
    "未知视频";

  // 提取作者（UP主）
  const author = extractMetaTag(html, "author");

  // 提取封面
  const coverUrl = extractMetaTag(html, "og:image");

  // 提取描述
  const description =
    extractMetaTag(html, "og:description") ||
    extractMetaTag(html, "description");

  // 提取字数和图片数
  const wordCount = extractWordCount(html);
  const imageCount = extractImageCount(html);

  return {
    title,
    author,
    coverUrl,
    description,
    wordCount,
    imageCount,
  };
}

/**
 * 爬取小红书笔记
 */
async function crawlXiaohongshu(url: string): Promise<Partial<CrawlResult>> {
  const html = await fetchPage(url);

  // 提取标题
  const title =
    extractMetaTag(html, "og:title") || extractTitle(html) || "未知笔记";

  // 提取作者
  const author = extractMetaTag(html, "og:article:author");

  // 提取封面
  const coverUrl = extractMetaTag(html, "og:image");

  // 提取描述
  const description =
    extractMetaTag(html, "og:description") ||
    extractMetaTag(html, "description");

  // 提取字数和图片数
  const wordCount = extractWordCount(html);
  const imageCount = extractImageCount(html);

  return {
    title,
    author,
    coverUrl,
    description,
    wordCount,
    imageCount,
  };
}

/**
 * 通用爬取函数（兜底方案）
 */
async function crawlGeneric(url: string): Promise<Partial<CrawlResult>> {
  const html = await fetchPage(url);

  const title =
    extractMetaTag(html, "og:title") ||
    extractMetaTag(html, "twitter:title") ||
    extractTitle(html) ||
    "未知标题";

  const author = extractMetaTag(html, "author");
  const coverUrl =
    extractMetaTag(html, "og:image") || extractMetaTag(html, "twitter:image");
  const description =
    extractMetaTag(html, "og:description") ||
    extractMetaTag(html, "description");

  // 提取字数和图片数
  const wordCount = extractWordCount(html);
  const imageCount = extractImageCount(html);

  return {
    title,
    author,
    coverUrl,
    description,
    wordCount,
    imageCount,
  };
}

/**
 * 主爬取函数
 * @param url 要爬取的 URL
 * @returns 爬取结果
 */
export async function crawlContent(url: string): Promise<CrawlResult> {
  // 验证 URL 格式
  try {
    new URL(url);
  } catch {
    throw new Error("无效的 URL 格式");
  }

  // 识别平台
  const platform = detectPlatform(url);

  // 根据平台选择爬取策略
  let result: Partial<CrawlResult>;

  try {
    switch (platform) {
      case "WECHAT_OFFICIAL_ACCOUNT":
        result = await crawlWechat(url);
        break;
      case "BILIBILI":
        result = await crawlBilibili(url);
        break;
      case "XIAOHONGSHU":
        result = await crawlXiaohongshu(url);
        break;
      default:
        result = await crawlGeneric(url);
    }
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        platform,
        url,
        action: "crawl_failed",
      },
      `Crawl ${platform} error`,
    );
    // 如果特定平台爬取失败，尝试通用爬取
    if (platform !== "UNKNOWN") {
      try {
        result = await crawlGeneric(url);
      } catch {
        // 通用爬取也失败，使用默认值
        result = { title: "无法获取标题" };
      }
    } else {
      result = { title: "无法获取标题" };
    }
  }

  return {
    platform,
    title: result.title || "未知标题",
    sourceName: result.sourceName, // 来源名称（公众号名称等）
    author: result.author, // 文章作者
    publishTime: result.publishTime, // 原文发布时间
    coverUrl: result.coverUrl,
    description: result.description,
    wordCount: result.wordCount,
    imageCount: result.imageCount,
  };
}
