/**
 * Metadata Consumer
 *
 * 元数据获取消费者 - 获取 URL 的 Open Graph 元数据
 *
 * @module jobs/consumers
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { BaseConsumer } from "./base-consumer";
import type { JobContext, JobResult, FetchMetadataPayload } from "../types";

// 本地类型定义
interface BookmarkMetadataRow {
  id: number;
  title: string | null;
  description: string | null;
  cover_url: string | null;
}

/**
 * 元数据获取消费者
 *
 * 职责：
 * - 获取 URL 的 Open Graph / Twitter Card 元数据
 * - 提取页面标题、描述、封面图
 * - 检测平台类型
 * - 更新书签记录
 */
export class MetadataConsumer extends BaseConsumer {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, {
      name: "MetadataConsumer",
      jobTypes: ["FETCH_METADATA"],
      pollIntervalMs: 5000,
      batchSize: 5,
      concurrency: 3,
    });
  }

  protected async execute(context: JobContext): Promise<JobResult> {
    const payload = context.payload as unknown as FetchMetadataPayload;
    const { bookmarkId, url, force = false } = payload;

    if (!bookmarkId || !url) {
      return {
        success: false,
        error: "Missing bookmarkId or url in payload",
      };
    }

    try {
      // 检查书签是否存在
       
      const { data: bookmark, error: fetchError } = (await (
        context.supabase.from("bookmarks") as any
      )
        .select("id, title, description, cover_url")
        .eq("id", bookmarkId)
        .single()) as { data: BookmarkMetadataRow | null; error: Error | null };

      if (fetchError || !bookmark) {
        return {
          success: false,
          error: `Bookmark ${bookmarkId} not found`,
        };
      }

      // 如果已有元数据且非强制刷新，跳过
      if (!force && bookmark.description && bookmark.cover_url) {
        this.logger.info({ bookmarkId }, "Metadata already exists, skipping");
        return {
          success: true,
          data: { skipped: true, reason: "Metadata already exists" },
        };
      }

      // 获取元数据
      const metadata = await this.fetchMetadata(url, context.abortSignal);

      // 更新书签（不包含 metadata 字段，因为表中没有该列）
       
      const { error: updateError } = await (
        context.supabase.from("bookmarks") as any
      )
        .update({
          title: metadata.title || bookmark.title,
          description: metadata.description || bookmark.description,
          cover_url: metadata.image || bookmark.cover_url,
          author: metadata.author,
          platform: metadata.platform || "web",
          status: "METADATA_DONE",
          updated_at: new Date().toISOString(),
        })
        .eq("id", bookmarkId);

      if (updateError) {
        return {
          success: false,
          error: `Failed to update bookmark: ${updateError.message}`,
        };
      }

      this.logger.info(
        { bookmarkId, title: metadata.title },
        "Metadata fetched",
      );

      return {
        success: true,
        data: {
          title: metadata.title,
          description: metadata.description?.slice(0, 100),
          hasImage: !!metadata.image,
          platform: metadata.platform,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * 获取 URL 元数据
   */
  private async fetchMetadata(
    url: string,
    abortSignal?: AbortSignal,
  ): Promise<MetadataResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s 超时

    // 合并信号
    const signal = abortSignal
      ? this.combineAbortSignals([abortSignal, controller.signal])
      : controller.signal;

    try {
      const response = await fetch(url, {
        signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; AnyKeep/1.0; +https://anykeep.app)",
          Accept: "text/html,application/xhtml+xml",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      return this.parseMetadata(html, url);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 解析 HTML 元数据
   */
  private parseMetadata(html: string, url: string): MetadataResult {
    const result: MetadataResult = {
      platform: this.detectPlatform(url),
    };

    // 提取 <title>
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      result.title = this.decodeHtml(titleMatch[1].trim());
    }

    // 提取 meta 标签
    const metaRegex = /<meta\s+([^>]+)>/gi;
    let match;

    while ((match = metaRegex.exec(html)) !== null) {
      const attrs = match[1];
      const name =
        this.extractAttr(attrs, "name") || this.extractAttr(attrs, "property");
      const content = this.extractAttr(attrs, "content");

      if (!name || !content) continue;

      const lowerName = name.toLowerCase();

      // Open Graph
      if (lowerName === "og:title") {
        result.og = result.og || {};
        result.og.title = this.decodeHtml(content);
        result.title = result.title || result.og.title;
      } else if (lowerName === "og:description") {
        result.og = result.og || {};
        result.og.description = this.decodeHtml(content);
        result.description = result.description || result.og.description;
      } else if (lowerName === "og:image") {
        result.og = result.og || {};
        result.og.image = this.resolveUrl(content, url);
        result.image = result.image || result.og.image;
      }

      // Twitter Card
      else if (lowerName === "twitter:title") {
        result.twitter = result.twitter || {};
        result.twitter.title = this.decodeHtml(content);
        result.title = result.title || result.twitter.title;
      } else if (lowerName === "twitter:description") {
        result.twitter = result.twitter || {};
        result.twitter.description = this.decodeHtml(content);
        result.description = result.description || result.twitter.description;
      } else if (lowerName === "twitter:image") {
        result.twitter = result.twitter || {};
        result.twitter.image = this.resolveUrl(content, url);
        result.image = result.image || result.twitter.image;
      }

      // 标准 meta
      else if (lowerName === "description") {
        result.description = result.description || this.decodeHtml(content);
      } else if (lowerName === "author") {
        result.author = this.decodeHtml(content);
      }
    }

    // 提取 favicon
    const faviconMatch = html.match(
      /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i,
    );
    if (faviconMatch) {
      result.favicon = this.resolveUrl(faviconMatch[1], url);
    } else {
      // 默认 favicon
      try {
        const urlObj = new URL(url);
        result.favicon = `${urlObj.protocol}//${urlObj.host}/favicon.ico`;
      } catch {
        // ignore
      }
    }

    return result;
  }

  /**
   * 检测平台
   */
  private detectPlatform(url: string): string {
    try {
      const hostname = new URL(url).hostname.toLowerCase();

      const platformMap: Record<string, string> = {
        "mp.weixin.qq.com": "wechat",
        "weixin.qq.com": "wechat",
        "bilibili.com": "bilibili",
        "www.bilibili.com": "bilibili",
        "b23.tv": "bilibili",
        "xiaohongshu.com": "xiaohongshu",
        "www.xiaohongshu.com": "xiaohongshu",
        "xhslink.com": "xiaohongshu",
        "zhihu.com": "zhihu",
        "www.zhihu.com": "zhihu",
        "zhuanlan.zhihu.com": "zhihu",
        "juejin.cn": "juejin",
        "github.com": "github",
        "twitter.com": "twitter",
        "x.com": "twitter",
        "youtube.com": "youtube",
        "www.youtube.com": "youtube",
        "youtu.be": "youtube",
        "medium.com": "medium",
        "dev.to": "devto",
        "stackoverflow.com": "stackoverflow",
      };

      for (const [domain, platform] of Object.entries(platformMap)) {
        if (hostname.includes(domain)) {
          return platform;
        }
      }

      return "web";
    } catch {
      return "web";
    }
  }

  /**
   * 提取属性值
   */
  private extractAttr(attrs: string, name: string): string | null {
    const regex = new RegExp(`${name}=["']([^"']+)["']`, "i");
    const match = attrs.match(regex);
    return match ? match[1] : null;
  }

  /**
   * 解码 HTML 实体
   */
  private decodeHtml(html: string): string {
    return html
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, "/");
  }

  /**
   * 解析相对 URL
   */
  private resolveUrl(path: string, base: string): string {
    try {
      return new URL(path, base).toString();
    } catch {
      return path;
    }
  }

  /**
   * 合并 AbortSignal
   */
  private combineAbortSignals(signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController();

    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort();
        break;
      }
      signal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }

    return controller.signal;
  }
}

/**
 * 元数据结果
 */
interface MetadataResult {
  title?: string;
  description?: string;
  image?: string;
  author?: string;
  platform?: string;
  favicon?: string;
  og?: {
    title?: string;
    description?: string;
    image?: string;
  };
  twitter?: {
    title?: string;
    description?: string;
    image?: string;
  };
}
