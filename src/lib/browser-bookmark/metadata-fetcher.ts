/**
 * 网页元数据抓取服务
 * 支持 Open Graph、Twitter Card 和基础 HTML meta 标签解析
 */

// ============================================
// 类型定义
// ============================================

/** 网页元数据 */
export interface PageMetadata {
  /** 标题 */
  title?: string;
  /** 描述 */
  description?: string;
  /** 封面图 URL */
  image?: string;
  /** 作者 */
  author?: string;
  /** 网站名称 */
  siteName?: string;
  /** 内容类型 */
  type?: string;
  /** 发布时间 */
  publishedTime?: string;
  /** 图标 URL */
  favicon?: string;
}

/** 抓取结果 */
export interface FetchMetadataResult {
  url: string;
  success: boolean;
  metadata?: PageMetadata;
  error?: string;
}

/** 批量抓取结果 */
export interface BatchFetchResult {
  total: number;
  successful: number;
  failed: number;
  results: FetchMetadataResult[];
}

/** 抓取配置 */
export interface FetchConfig {
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 并发数量 */
  concurrency?: number;
  /** 是否抓取图标 */
  fetchFavicon?: boolean;
}

// ============================================
// 常量
// ============================================

const DEFAULT_TIMEOUT = 10000; // 10秒
const DEFAULT_CONCURRENCY = 5;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

// ============================================
// HTML 解析工具
// ============================================

/**
 * 从 HTML 中提取 meta 标签值
 */
function extractMetaTag(html: string, property: string): string | undefined {
  // Open Graph
  const ogRegex = new RegExp(
    `<meta\\s+property=["']${property}["']\\s+content=["']([^"']+)["']`,
    "i",
  );
  const ogMatch = html.match(ogRegex);
  if (ogMatch) return ogMatch[1];

  // Twitter Card
  const twitterRegex = new RegExp(
    `<meta\\s+name=["']${property}["']\\s+content=["']([^"']+)["']`,
    "i",
  );
  const twitterMatch = html.match(twitterRegex);
  if (twitterMatch) return twitterMatch[1];

  // 反向顺序（content 在前）
  const reverseRegex = new RegExp(
    `<meta\\s+content=["']([^"']+)["']\\s+(?:property|name)=["']${property}["']`,
    "i",
  );
  const reverseMatch = html.match(reverseRegex);
  if (reverseMatch) return reverseMatch[1];

  return undefined;
}

/**
 * 提取 title 标签
 */
function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : undefined;
}

/**
 * 提取 favicon
 */
function extractFavicon(html: string, baseUrl: string): string | undefined {
  // Link rel="icon"
  const iconMatch = html.match(
    /<link[^>]+rel=["'](?:icon|shortcut icon)["'][^>]+href=["']([^"']+)["']/i,
  );
  if (iconMatch) {
    return resolveUrl(iconMatch[1], baseUrl);
  }

  // Apple touch icon
  const appleMatch = html.match(
    /<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i,
  );
  if (appleMatch) {
    return resolveUrl(appleMatch[1], baseUrl);
  }

  // 默认 /favicon.ico
  const url = new URL(baseUrl);
  return `${url.origin}/favicon.ico`;
}

/**
 * 解析相对 URL
 */
function resolveUrl(url: string, baseUrl: string): string {
  try {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    const base = new URL(baseUrl);
    if (url.startsWith("//")) {
      return `${base.protocol}${url}`;
    }
    if (url.startsWith("/")) {
      return `${base.origin}${url}`;
    }
    return new URL(url, baseUrl).href;
  } catch {
    return url;
  }
}

// ============================================
// 核心抓取函数
// ============================================

/**
 * 抓取单个 URL 的元数据
 */
export async function fetchMetadata(
  url: string,
  config: FetchConfig = {},
): Promise<FetchMetadataResult> {
  const { timeout = DEFAULT_TIMEOUT, fetchFavicon = true } = config;

  try {
    // 验证 URL
    new URL(url);

    // 创建 AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // 抓取页面
      const response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html",
        },
        signal: controller.signal,
        redirect: "follow",
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          url,
          success: false,
          error: `HTTP ${response.status}`,
        };
      }

      // 检查 Content-Type
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/html")) {
        return {
          url,
          success: false,
          error: "非 HTML 内容",
        };
      }

      const html = await response.text();

      // 解析元数据
      const metadata: PageMetadata = {
        // Open Graph
        title:
          extractMetaTag(html, "og:title") ||
          extractMetaTag(html, "twitter:title") ||
          extractTitle(html),
        description:
          extractMetaTag(html, "og:description") ||
          extractMetaTag(html, "twitter:description") ||
          extractMetaTag(html, "description"),
        image:
          extractMetaTag(html, "og:image") ||
          extractMetaTag(html, "twitter:image"),
        author:
          extractMetaTag(html, "article:author") ||
          extractMetaTag(html, "author"),
        siteName: extractMetaTag(html, "og:site_name"),
        type: extractMetaTag(html, "og:type"),
        publishedTime: extractMetaTag(html, "article:published_time"),
      };

      // 解析图片 URL
      if (metadata.image) {
        metadata.image = resolveUrl(metadata.image, url);
      }

      // 抓取 favicon
      if (fetchFavicon) {
        metadata.favicon = extractFavicon(html, url);
      }

      return {
        url,
        success: true,
        metadata,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        return {
          url,
          success: false,
          error: "请求超时",
        };
      }
      throw error;
    }
  } catch (error) {
    return {
      url,
      success: false,
      error: error instanceof Error ? error.message : "抓取失败",
    };
  }
}

/**
 * 批量抓取元数据（支持并发控制）
 */
export async function batchFetchMetadata(
  urls: string[],
  config: FetchConfig = {},
  onProgress?: (completed: number, total: number) => void,
): Promise<BatchFetchResult> {
  const { concurrency = DEFAULT_CONCURRENCY } = config;

  const results: FetchMetadataResult[] = [];
  let completed = 0;

  // 分批处理
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, Math.min(i + concurrency, urls.length));
    const batchResults = await Promise.all(
      batch.map((url) => fetchMetadata(url, config)),
    );

    results.push(...batchResults);
    completed += batch.length;
    onProgress?.(completed, urls.length);
  }

  // 统计
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return {
    total: urls.length,
    successful,
    failed,
    results,
  };
}

// ============================================
// 工具函数
// ============================================

/**
 * 验证元数据完整性
 */
export function validateMetadata(metadata: PageMetadata): {
  isComplete: boolean;
  missingFields: string[];
} {
  const requiredFields = ["title", "description", "image"];
  const missingFields = requiredFields.filter(
    (field) => !metadata[field as keyof PageMetadata],
  );

  return {
    isComplete: missingFields.length === 0,
    missingFields,
  };
}

/**
 * 合并元数据（优先使用已有数据）
 */
export function mergeMetadata(
  existing: Partial<PageMetadata>,
  fetched: PageMetadata,
): PageMetadata {
  return {
    title: existing.title || fetched.title,
    description: existing.description || fetched.description,
    image: existing.image || fetched.image,
    author: existing.author || fetched.author,
    siteName: existing.siteName || fetched.siteName,
    type: existing.type || fetched.type,
    publishedTime: existing.publishedTime || fetched.publishedTime,
    favicon: existing.favicon || fetched.favicon,
  };
}

/**
 * 从元数据中提取简要信息
 */
export function extractSummary(metadata: PageMetadata): {
  title: string;
  description: string;
  hasImage: boolean;
} {
  return {
    title: metadata.title || "无标题",
    description: metadata.description || "暂无描述",
    hasImage: !!metadata.image,
  };
}
