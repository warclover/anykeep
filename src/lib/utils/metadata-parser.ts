/**
 * 网页元数据解析工具
 * 从 HTML 中提取 Open Graph、meta 标签等元数据
 */

import { logger } from "@/lib/logger";
import { detectPlatformFromUrl } from "@/lib/platform-utils";

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
    return extractWechatPublishTime(html);
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
 * 微信公众号：提取文章发布时间
 * 支持多种时间格式：Unix 时间戳、中文日期、ISO 8601
 */
function extractWechatPublishTime(html: string): string {
  // 方法1: var publish_time = "1699123456" (Unix 时间戳，秒)
  const publishTimeMatch = html.match(
    /var\s+publish_time\s*=\s*["'](\d{10})["']/,
  );
  if (publishTimeMatch) {
    const timestamp = parseInt(publishTimeMatch[1], 10);
    return new Date(timestamp * 1000).toISOString();
  }

  // 方法2: var ct = "1699123456" (备用时间戳变量)
  const ctMatch = html.match(/var\s+ct\s*=\s*["'](\d{10})["']/);
  if (ctMatch) {
    const timestamp = parseInt(ctMatch[1], 10);
    return new Date(timestamp * 1000).toISOString();
  }

  // 方法3: var create_time = "1699123456" (另一个备用变量)
  const createTimeMatch = html.match(
    /var\s+create_time\s*=\s*["'](\d{10})["']/,
  );
  if (createTimeMatch) {
    const timestamp = parseInt(createTimeMatch[1], 10);
    return new Date(timestamp * 1000).toISOString();
  }

  // 方法4: <em id="publish_time" ...>2024年1月1日 12:00</em>
  const publishTimeElementMatch = html.match(
    /<em[^>]*id=["']publish_time["'][^>]*>([^<]+)<\/em>/i,
  );
  if (publishTimeElementMatch) {
    const dateStr = cleanText(publishTimeElementMatch[1]);
    const parsed = parseChineseDateString(dateStr);
    if (parsed) return parsed;
  }

  // 方法5: <meta property="article:published_time" content="..." />
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

  // 方法6: 从 rich_media_meta 中查找时间信息
  const metaTimeMatches = html.matchAll(
    /<span[^>]*class=["'][^"']*rich_media_meta[^"']*["'][^>]*>([^<]+)<\/span>/gi,
  );
  for (const match of metaTimeMatches) {
    const text = cleanText(match[1]);
    // 匹配日期格式：2024-01-01 或 2024年1月1日
    if (/^\d{4}[-年]\d{1,2}[-月]\d{1,2}/.test(text)) {
      const parsed = parseChineseDateString(text);
      if (parsed) return parsed;
    }
  }

  return "";
}

/**
 * 解析中文日期字符串为 ISO 8601 格式
 * 支持格式：
 * - 2024年1月1日 12:00
 * - 2024年1月1日
 * - 2024-01-01 12:00:00
 * - 2024-01-01
 */
function parseChineseDateString(dateStr: string): string {
  if (!dateStr) return "";

  // 尝试解析 "2024年1月1日 12:00" 格式
  const chineseMatch = dateStr.match(
    /(\d{4})年(\d{1,2})月(\d{1,2})日(?:\s*(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/,
  );
  if (chineseMatch) {
    const [, year, month, day, hour = "0", minute = "0", second = "0"] =
      chineseMatch;
    const date = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second),
    );
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  // 尝试直接解析（标准格式）
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date.toISOString();
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
 * 微信公众号：分别提取公众号名称和文章作者
 * 返回 { sourceName: 公众号名称, author: 文章作者 }
 */
function extractWechatSourceAndAuthor(html: string): {
  sourceName: string;
  author: string;
} {
  let sourceName = ""; // 公众号名称
  let author = ""; // 文章作者

  // === 提取公众号名称 ===

  // 方法1：从 profile_nickname 变量提取（公众号名称，最可靠）
  const profileNicknameMatch = html.match(
    /var\s+profile_nickname\s*=\s*["']([^"']+)["']/,
  );
  if (profileNicknameMatch) {
    const name = cleanText(profileNicknameMatch[1]);
    if (name && name.length > 0) sourceName = name;
  }

  // 方法2：从 js_name 提取（公众号名称元素）
  if (!sourceName) {
    const jsNameMatch = html.match(
      /<(?:a|span)[^>]*id=["']js_name["'][^>]*>([^<]+)</i,
    );
    if (jsNameMatch) {
      const name = cleanText(jsNameMatch[1]);
      if (name && name.length > 0) sourceName = name;
    }
  }

  // 方法3：从 profile_nickname class 提取
  if (!sourceName) {
    const profileContainerMatch = html.match(
      /<strong[^>]*class=["'][^"']*profile_nickname[^"']*["'][^>]*>([^<]+)</i,
    );
    if (profileContainerMatch) {
      const name = cleanText(profileContainerMatch[1]);
      if (name && name.length > 0) sourceName = name;
    }
  }

  // === 提取文章作者 ===

  // 方法1：从 rich_media_meta_nickname 提取（原创文章作者）
  const nicknameMetaMatch = html.match(
    /<(?:span|em|a)[^>]*class=["'][^"']*rich_media_meta_nickname[^"']*["'][^>]*>([^<]+)</i,
  );
  if (nicknameMetaMatch) {
    const authorName = cleanText(nicknameMetaMatch[1]);
    if (authorName && authorName.length > 0) author = authorName;
  }

  // 方法2：从 data-author 属性提取
  if (!author) {
    const dataAuthorMatch = html.match(/data-author=["']([^"']+)["']/i);
    if (dataAuthorMatch) {
      const authorName = cleanText(dataAuthorMatch[1]);
      if (authorName && authorName.length > 0) author = authorName;
    }
  }

  // 方法3：从 rich_media_meta_text 提取（部分文章的作者位置）
  if (!author) {
    const metaTextMatches = html.matchAll(
      /<span[^>]*class=["'][^"']*rich_media_meta_text[^"']*["'][^>]*>([^<]+)<\/span>/gi,
    );
    for (const match of metaTextMatches) {
      const text = cleanText(match[1]);
      // 排除常见的非作者内容，且不等于公众号名称
      if (
        text &&
        text.length > 0 &&
        text.length <= 30 &&
        !["原创", "赞赏", "分享", "收藏", "在看", "喜欢"].includes(text) &&
        !/^\d+$/.test(text) &&
        text !== sourceName
      ) {
        author = text;
        break;
      }
    }
  }

  // 方法4：从 JavaScript 变量 nickname 提取（文章作者变量）
  if (!author) {
    const jsNicknameMatch = html.match(/var\s+nickname\s*=\s*["']([^"']+)["']/);
    if (jsNicknameMatch) {
      const authorName = cleanText(jsNicknameMatch[1]);
      // 确保不等于公众号名称
      if (authorName && authorName.length > 0 && authorName !== sourceName) {
        author = authorName;
      }
    }
  }

  // 方法5：从 meta 标签提取作者
  if (!author) {
    const metaAuthorMatch = html.match(
      /<meta\s+name=["']author["']\s+content=["']([^"']+)["']/i,
    );
    if (metaAuthorMatch) {
      const authorName = cleanText(metaAuthorMatch[1]);
      if (authorName && authorName.length > 0 && authorName !== sourceName) {
        author = authorName;
      }
    }
  }

  // 如果作者为空但公众号名称存在，将公众号名称作为作者兜底
  // 这样确保至少有一个值可以显示
  if (!author && sourceName) {
    author = sourceName;
  }

  return { sourceName, author };
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
 * 清理文本：去除多余空白、HTML 实体解码
 */
function cleanText(text: string): string {
  return (
    text
      // 十六进制数字实体 &#x2F; -> /
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16)),
      )
      // 十进制数字实体 &#47; -> /
      .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
      // 命名实体
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/&mdash;/g, "—")
      .replace(/&ndash;/g, "–")
      .replace(/&hellip;/g, "…")
      .replace(/&copy;/g, "©")
      .replace(/&reg;/g, "®")
      .replace(/&trade;/g, "™")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * 提取正文字数
 * 从 HTML 中提取纯文本并计算字数
 */
function extractWordCount(html: string): number {
  // 移除 script 和 style 标签及其内容
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "");

  // 尝试提取正文区域（微信公众号）
  const wechatContent = text.match(
    /<div[^>]*id="js_content"[^>]*>([\s\S]*?)<\/div>/i,
  );
  if (wechatContent) {
    text = wechatContent[1];
  } else {
    // 尝试提取 article 或 main 标签内容
    const articleContent = text.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    const mainContent = text.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    if (articleContent) {
      text = articleContent[1];
    } else if (mainContent) {
      text = mainContent[1];
    }
  }

  // 移除所有 HTML 标签
  text = text.replace(/<[^>]+>/g, "");

  // 解码 HTML 实体
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // 移除多余空白
  text = text.replace(/\s+/g, "");

  // 返回字符数（中文按字符计算）
  return text.length;
}

/**
 * 提取图片数量
 * 统计 HTML 中的 img 标签数量
 */
function extractImageCount(html: string): number {
  // 尝试提取正文区域（微信公众号）
  let contentHtml = html;
  const wechatContent = html.match(
    /<div[^>]*id="js_content"[^>]*>([\s\S]*?)<\/div>/i,
  );
  if (wechatContent) {
    contentHtml = wechatContent[1];
  } else {
    // 尝试提取 article 或 main 标签内容
    const articleContent = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    const mainContent = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    if (articleContent) {
      contentHtml = articleContent[1];
    } else if (mainContent) {
      contentHtml = mainContent[1];
    }
  }

  // 统计 img 标签数量（排除小图标和头像等）
  const imgMatches = contentHtml.match(/<img[^>]+>/gi) || [];

  // 过滤掉小图片（如表情、图标等）
  const validImages = imgMatches.filter((img) => {
    // 排除带有 emoji、icon、avatar、logo 类名的图片
    if (/class=["'][^"']*(?:emoji|icon|avatar|logo|qr)[^"']*["']/i.test(img)) {
      return false;
    }
    // 排除过小的图片
    const widthMatch = img.match(/width=["']?(\d+)/i);
    const heightMatch = img.match(/height=["']?(\d+)/i);
    if (widthMatch && parseInt(widthMatch[1]) < 50) return false;
    if (heightMatch && parseInt(heightMatch[1]) < 50) return false;
    return true;
  });

  return validImages.length;
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
