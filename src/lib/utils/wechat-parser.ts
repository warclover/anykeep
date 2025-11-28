/**
 * 微信公众号内容解析工具
 * 统一的公众号名称、作者、发布时间提取功能
 */

import { cleanText, decodeHtmlEntities } from "./html-utils";

/**
 * 从 HTML 中提取 meta 标签内容
 */
function extractMetaTag(html: string, name: string): string | undefined {
  const propertyRegex = new RegExp(
    `<meta\\s+property=["']${name}["']\\s+content=["']([^"']+)["']`,
    "i",
  );
  const nameRegex = new RegExp(
    `<meta\\s+name=["']${name}["']\\s+content=["']([^"']+)["']`,
    "i",
  );

  const match = html.match(propertyRegex) || html.match(nameRegex);
  return match ? decodeHtmlEntities(match[1]) : undefined;
}

/**
 * 解析中文日期字符串为 ISO 8601 格式
 * 支持格式：
 * - 2024年1月1日 12:00
 * - 2024年1月1日
 * - 2024-01-01 12:00:00
 * - 2024-01-01
 */
export function parseChineseDateString(dateStr: string): string | undefined {
  if (!dateStr) return undefined;

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

  return undefined;
}

/**
 * 微信公众号：分别提取公众号名称和文章作者
 * @returns { sourceName: 公众号名称, author: 文章作者 }
 */
export function extractWechatSourceAndAuthor(html: string): {
  sourceName: string;
  author: string;
} {
  let sourceName = "";
  let author = "";

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
    const metaAuthor = extractMetaTag(html, "author");
    if (metaAuthor && metaAuthor !== sourceName) {
      author = metaAuthor;
    }
  }

  // 兜底：如果作者为空但公众号名称存在，将公众号名称作为作者
  if (!author && sourceName) {
    author = sourceName;
  }

  return { sourceName, author };
}

/**
 * 微信公众号：提取文章发布时间
 * 支持多种时间格式：Unix 时间戳、中文日期、ISO 8601
 * @returns ISO 8601 格式的时间字符串，或 undefined
 */
export function extractWechatPublishTime(html: string): string | undefined {
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
    const dateStr = decodeHtmlEntities(publishTimeElementMatch[1]).trim();
    const parsed = parseChineseDateString(dateStr);
    if (parsed) {
      return parsed;
    }
  }

  // 方法5: <meta property="article:published_time" content="..." />
  const articlePublishedTime = extractMetaTag(html, "article:published_time");
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
    const text = decodeHtmlEntities(match[1]).trim();
    // 匹配日期格式：2024-01-01 或 2024年1月1日
    if (/^\d{4}[-年]\d{1,2}[-月]\d{1,2}/.test(text)) {
      const parsed = parseChineseDateString(text);
      if (parsed) {
        return parsed;
      }
    }
  }

  return undefined;
}
