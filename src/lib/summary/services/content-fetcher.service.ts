/**
 * Content Fetcher Service
 *
 * 内容提取服务 - 从 URL 获取和解析网页内容
 *
 * 功能：
 * - URL 内容抓取
 * - HTML 解析和正文提取
 * - 元数据提取（Open Graph / Twitter Card）
 * - 内容类型检测
 * - 缓存管理
 *
 * @version 2.0.0
 * @since 2025-12-12
 */

import { logger } from "@/lib/logger";
import type { ContentType } from "@/lib/summary/content-type-detector";
import { detectContentType } from "@/lib/summary/content-type-detector";
import {
  isEnhancedExtractionEnabled,
  isContentCleaningEnabled,
} from "@/lib/summary/config/ai-summary-config";
import { getParserRegistry } from "../parsers";
import { ContentCleanerService } from "./content-cleaner.service";

// ============================================================================
// Types
// ============================================================================

/**
 * 内容提取结果
 */
export interface FetchedContent {
  /** 页面标题 */
  title: string;
  /** 页面描述 */
  description?: string;
  /** 正文内容 */
  content?: string;
  /** 作者 */
  author?: string;
  /** 发布时间 */
  publishedAt?: string;
  /** 封面图 URL */
  imageUrl?: string;
  /** 站点名称 */
  siteName?: string;
  /** 检测到的内容类型 */
  contentType: ContentType;
  /** 内容类型置信度 */
  contentTypeConfidence: number;
  /** 内容长度（字符数） */
  contentLength: number;
  /** 抓取耗时 (ms) */
  fetchTimeMs: number;
  /** 是否从缓存获取 */
  fromCache: boolean;
}

/**
 * 内容提取选项
 */
export interface FetchOptions {
  /** 超时时间 (ms) */
  timeoutMs?: number;
  /** 是否提取正文 */
  extractContent?: boolean;
  /** 最大内容长度 */
  maxContentLength?: number;
  /** 是否使用缓存 */
  useCache?: boolean;
  /** 缓存过期时间 (ms) */
  cacheTtlMs?: number;
  /** User-Agent */
  userAgent?: string;
}

/**
 * Open Graph 元数据
 */
interface OpenGraphData {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  type?: string;
  url?: string;
  author?: string;
  publishedTime?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_OPTIONS: Required<FetchOptions> = {
  timeoutMs: 10000,
  extractContent: true,
  maxContentLength: 50000,
  useCache: true,
  cacheTtlMs: 5 * 60 * 1000, // 5 分钟
  userAgent: "Mozilla/5.0 (compatible; AnyKeep/1.0; +https://anykeep.app/bot)",
};

// 简单内存缓存
const contentCache = new Map<
  string,
  { content: FetchedContent; expiresAt: number }
>();

// ============================================================================
// Content Fetcher Service
// ============================================================================

/**
 * 内容提取服务
 *
 * @example
 * ```typescript
 * const fetcher = new ContentFetcherService();
 *
 * // 提取内容
 * const content = await fetcher.fetch('https://example.com/article');
 *
 * // 仅提取元数据（不提取正文）
 * const metadata = await fetcher.fetchMetadata('https://example.com/article');
 * ```
 */
export class ContentFetcherService {
  private options: Required<FetchOptions>;

  constructor(options?: FetchOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * 提取 URL 内容
   *
   * @param url - 目标 URL
   * @param options - 提取选项
   * @returns 提取的内容
   */
  async fetch(url: string, options?: FetchOptions): Promise<FetchedContent> {
    const opts = { ...this.options, ...options };
    const startTime = Date.now();

    // 检查缓存
    if (opts.useCache) {
      const cached = this.getFromCache(url);
      if (cached) {
        return { ...cached, fromCache: true };
      }
    }

    try {
      // 抓取 HTML
      const html = await this.fetchHtml(url, opts);

      // 解析内容
      const result = await this.parseHtml(html, url, opts);

      // 添加性能数据
      result.fetchTimeMs = Date.now() - startTime;
      result.fromCache = false;

      // 缓存结果
      if (opts.useCache) {
        this.setCache(url, result, opts.cacheTtlMs);
      }

      logger.debug(
        {
          url,
          title: result.title,
          contentLength: result.contentLength,
          fetchTimeMs: result.fetchTimeMs,
        },
        "ContentFetcherService: Content fetched successfully",
      );

      return result;
    } catch (error) {
      logger.error(
        {
          url,
          error: error instanceof Error ? error.message : String(error),
        },
        "ContentFetcherService: Fetch failed",
      );
      throw error;
    }
  }

  /**
   * 仅提取元数据（不提取正文）
   *
   * @param url - 目标 URL
   * @returns 元数据
   */
  async fetchMetadata(url: string): Promise<Omit<FetchedContent, "content">> {
    const result = await this.fetch(url, { extractContent: false });
    const { content: _content, ...metadata } = result;
    return metadata;
  }

  /**
   * 批量提取内容
   *
   * @param urls - URL 数组
   * @param options - 提取选项
   * @returns 内容数组（包含错误）
   */
  async fetchBatch(
    urls: string[],
    options?: FetchOptions,
  ): Promise<Array<FetchedContent | Error>> {
    const results: Array<FetchedContent | Error> = [];

    // 限制并发数
    const concurrencyLimit = 3;
    const chunks: string[][] = [];

    for (let i = 0; i < urls.length; i += concurrencyLimit) {
      chunks.push(urls.slice(i, i + concurrencyLimit));
    }

    for (const chunk of chunks) {
      const chunkResults = await Promise.allSettled(
        chunk.map((url) => this.fetch(url, options)),
      );

      for (const result of chunkResults) {
        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          results.push(
            result.reason instanceof Error
              ? result.reason
              : new Error(String(result.reason)),
          );
        }
      }
    }

    return results;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    contentCache.clear();
  }

  /**
   * 清除过期缓存
   */
  cleanupExpiredCache(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, value] of contentCache) {
      if (value.expiresAt < now) {
        contentCache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * 抓取 HTML
   */
  private async fetchHtml(
    url: string,
    opts: Required<FetchOptions>,
  ): Promise<string> {
    const response = await fetch(url, {
      headers: {
        "User-Agent": opts.userAgent,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(opts.timeoutMs),
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml")
    ) {
      throw new Error(`Unsupported content type: ${contentType}`);
    }

    return response.text();
  }

  /**
   * 解析 HTML
   */
  private async parseHtml(
    html: string,
    url: string,
    opts: Required<FetchOptions>,
  ): Promise<FetchedContent> {
    // 提取 Open Graph 数据
    const og = this.extractOpenGraph(html);

    // 提取标题
    const title = og.title || this.extractTitle(html) || new URL(url).hostname;

    // 提取描述
    const description = og.description || this.extractMetaDescription(html);

    // 提取正文
    let content: string | undefined;
    if (opts.extractContent) {
      if (isEnhancedExtractionEnabled()) {
        // V4: 平台定制解析器 + 去噪
        content = this.extractWithEnhancedPipeline(
          html,
          url,
          opts.maxContentLength,
        );
      } else {
        content = this.extractMainContent(html, opts.maxContentLength);
      }
    }

    // 检测内容类型
    const contentTypeResult = detectContentType({
      url,
      title,
      description,
      content,
    });

    return {
      title,
      description,
      content,
      author: og.author,
      publishedAt: og.publishedTime,
      imageUrl: og.image,
      siteName: og.siteName,
      contentType: contentTypeResult.type,
      contentTypeConfidence: contentTypeResult.confidence,
      contentLength:
        (title?.length || 0) +
        (description?.length || 0) +
        (content?.length || 0),
      fetchTimeMs: 0,
      fromCache: false,
    };
  }

  /**
   * 提取 Open Graph 数据
   */
  private extractOpenGraph(html: string): OpenGraphData {
    const og: OpenGraphData = {};

    // og:title
    const titleMatch = html.match(
      /<meta\s+(?:property|name)="og:title"\s+content="([^"]+)"/i,
    );
    if (titleMatch) og.title = this.decodeHtmlEntities(titleMatch[1]);

    // og:description
    const descMatch = html.match(
      /<meta\s+(?:property|name)="og:description"\s+content="([^"]+)"/i,
    );
    if (descMatch) og.description = this.decodeHtmlEntities(descMatch[1]);

    // og:image
    const imageMatch = html.match(
      /<meta\s+(?:property|name)="og:image"\s+content="([^"]+)"/i,
    );
    if (imageMatch) og.image = imageMatch[1];

    // og:site_name
    const siteMatch = html.match(
      /<meta\s+(?:property|name)="og:site_name"\s+content="([^"]+)"/i,
    );
    if (siteMatch) og.siteName = this.decodeHtmlEntities(siteMatch[1]);

    // article:author
    const authorMatch = html.match(
      /<meta\s+(?:property|name)="(?:article:author|author)"\s+content="([^"]+)"/i,
    );
    if (authorMatch) og.author = this.decodeHtmlEntities(authorMatch[1]);

    // article:published_time
    const timeMatch = html.match(
      /<meta\s+(?:property|name)="article:published_time"\s+content="([^"]+)"/i,
    );
    if (timeMatch) og.publishedTime = timeMatch[1];

    // Twitter Card 备选
    if (!og.title) {
      const twitterTitle = html.match(
        /<meta\s+(?:property|name)="twitter:title"\s+content="([^"]+)"/i,
      );
      if (twitterTitle) og.title = this.decodeHtmlEntities(twitterTitle[1]);
    }

    if (!og.description) {
      const twitterDesc = html.match(
        /<meta\s+(?:property|name)="twitter:description"\s+content="([^"]+)"/i,
      );
      if (twitterDesc) og.description = this.decodeHtmlEntities(twitterDesc[1]);
    }

    if (!og.image) {
      const twitterImage = html.match(
        /<meta\s+(?:property|name)="twitter:image"\s+content="([^"]+)"/i,
      );
      if (twitterImage) og.image = twitterImage[1];
    }

    return og;
  }

  /**
   * 提取标题
   */
  private extractTitle(html: string): string | undefined {
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return match ? this.decodeHtmlEntities(match[1].trim()) : undefined;
  }

  /**
   * 提取 meta description
   */
  private extractMetaDescription(html: string): string | undefined {
    const match = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
    return match ? this.decodeHtmlEntities(match[1]) : undefined;
  }

  /**
   * V4 增强内容提取管线
   *
   * 1. 平台定制解析器按 URL 匹配提取正文
   * 2. ContentCleaner 去噪（广告/导航/推荐移除）
   * 3. 回退到通用 extractMainContent
   */
  private extractWithEnhancedPipeline(
    html: string,
    url: string,
    maxLength: number,
  ): string {
    try {
      const registry = getParserRegistry();
      const parser = registry.findParser(url);
      const parsed = parser.parse(html, url);

      // 解析器置信度过低时回退
      if (parsed.confidence < 0.3 || parsed.content.length < 50) {
        logger.debug(
          { url, parser: parser.name, confidence: parsed.confidence },
          "增强提取: 置信度过低，回退到通用提取",
        );
        return this.extractMainContent(html, maxLength);
      }

      let content = parsed.content;

      // 去噪
      if (isContentCleaningEnabled()) {
        const cleaner = new ContentCleanerService();
        content = cleaner.clean(content);
      }

      // 截断
      if (content.length > maxLength) {
        content = content.slice(0, maxLength) + "...";
      }

      logger.info(
        {
          url,
          parser: parser.name,
          confidence: parsed.confidence,
          wordCount: parsed.wordCount,
          resultLength: content.length,
        },
        "增强提取: 完成",
      );

      return content;
    } catch (error) {
      logger.warn(
        {
          url,
          error: error instanceof Error ? error.message : String(error),
        },
        "增强提取: 失败，回退到通用提取",
      );
      return this.extractMainContent(html, maxLength);
    }
  }

  /**
   * 提取正文内容
   *
   * 使用启发式算法识别主要内容区域
   */
  private extractMainContent(html: string, maxLength: number): string {
    // 移除脚本和样式
    const cleaned = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "");

    // 尝试找到 article 或 main 标签
    let mainContent = "";

    // 优先提取 article 标签内容
    const articleMatch = cleaned.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch) {
      mainContent = articleMatch[1];
    }

    // 其次尝试 main 标签
    if (!mainContent) {
      const mainMatch = cleaned.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
      if (mainMatch) {
        mainContent = mainMatch[1];
      }
    }

    // 尝试 .content, .article, .post 等常见类名
    if (!mainContent) {
      const contentDivMatch = cleaned.match(
        /<div[^>]*class="[^"]*(?:content|article|post|entry)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      );
      if (contentDivMatch) {
        mainContent = contentDivMatch[1];
      }
    }

    // 如果都没找到，使用 body
    if (!mainContent) {
      const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      mainContent = bodyMatch ? bodyMatch[1] : cleaned;
    }

    // 移除 HTML 标签，保留文本
    const text = mainContent
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // 解码 HTML 实体
    const decoded = this.decodeHtmlEntities(text);

    // 截断到最大长度
    if (decoded.length > maxLength) {
      return decoded.slice(0, maxLength) + "...";
    }

    return decoded;
  }

  /**
   * 解码 HTML 实体
   */
  private decodeHtmlEntities(text: string): string {
    const entities: Record<string, string> = {
      "&amp;": "&",
      "&lt;": "<",
      "&gt;": ">",
      "&quot;": '"',
      "&#39;": "'",
      "&apos;": "'",
      "&nbsp;": " ",
      "&mdash;": "\u2014", // —
      "&ndash;": "\u2013", // –
      "&hellip;": "\u2026", // …
      "&ldquo;": "\u201C", // "
      "&rdquo;": "\u201D", // "
      "&lsquo;": "\u2018", // '
      "&rsquo;": "\u2019", // '
    };

    let decoded = text;
    for (const [entity, char] of Object.entries(entities)) {
      decoded = decoded.replace(new RegExp(entity, "g"), char);
    }

    // 处理数字实体
    decoded = decoded.replace(/&#(\d+);/g, (_, code) =>
      String.fromCharCode(parseInt(code, 10)),
    );

    return decoded;
  }

  /**
   * 从缓存获取
   */
  private getFromCache(url: string): FetchedContent | null {
    const cached = contentCache.get(url);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.content;
    }
    return null;
  }

  /**
   * 设置缓存
   */
  private setCache(url: string, content: FetchedContent, ttlMs: number): void {
    contentCache.set(url, {
      content,
      expiresAt: Date.now() + ttlMs,
    });
  }
}

// ============================================================================
// Factory Function
// ============================================================================

let serviceInstance: ContentFetcherService | null = null;

/**
 * 获取 ContentFetcherService 单例
 */
export function getContentFetcherService(
  options?: FetchOptions,
): ContentFetcherService {
  if (!serviceInstance) {
    serviceInstance = new ContentFetcherService(options);
  }
  return serviceInstance;
}

/**
 * 重置 ContentFetcherService 实例（主要用于测试）
 */
export function resetContentFetcherService(): void {
  if (serviceInstance) {
    serviceInstance.clearCache();
  }
  serviceInstance = null;
}
