/**
 * RSS Feed 分发适配器
 *
 * @description 生成用户专属 RSS Feed，支持 RSS 2.0 和 Atom 格式
 */

import type { IDistributionAdapter } from "../interfaces/adapter.interface";
import type {
  DistributionTarget,
  DistributionResult,
  DistributionRecord,
  ValidationResult,
  TestConnectionResult,
  DistributionBookmark,
  RssTargetConfig,
} from "../types";

/**
 * RssFeedAdapter 实现
 */
export class RssFeedAdapter implements IDistributionAdapter {
  readonly type = "rss" as const;
  readonly displayName = "RSS Feed";
  readonly description = "生成可订阅的 RSS Feed";
  readonly supportedPlatforms = ["web", "mobile", "desktop"] as const;

  /**
   * 初始化适配器
   */
  async initialize(_config: DistributionTarget): Promise<void> {
    // RSS Feed 无需初始化
  }

  /**
   * 执行分发 - 生成 Feed 内容
   *
   * 注意：RSS 是被动拉取模式，distribute 主要用于更新缓存
   */
  async distribute(
    bookmarks: DistributionBookmark[],
    config: DistributionTarget,
  ): Promise<DistributionResult> {
    const rssConfig = config.targetConfig as unknown as RssTargetConfig;
    const records: DistributionRecord[] = [];

    // 限制书签数量
    const limitedBookmarks = bookmarks.slice(0, rssConfig.itemCount || 50);

    // 生成 Feed 内容
    const feedContent =
      rssConfig.feedFormat === "atom"
        ? this.generateAtomFeed(limitedBookmarks, config)
        : this.generateRss2Feed(limitedBookmarks, config);

    // 为每个书签创建记录
    for (const bookmark of limitedBookmarks) {
      records.push({
        id: crypto.randomUUID(),
        targetId: config.id,
        bookmarkId: bookmark.id,
        status: "success",
        distributedAt: new Date(),
        createdAt: new Date(),
        retryCount: 0,
      });
    }

    return {
      success: true,
      distributedCount: limitedBookmarks.length,
      failedCount: 0,
      records,
      deliverable: {
        type: "content",
        content: feedContent,
        mimeType:
          rssConfig.feedFormat === "atom"
            ? "application/atom+xml"
            : "application/rss+xml",
        filename: `feed.${rssConfig.feedFormat === "atom" ? "atom" : "rss"}.xml`,
      },
    };
  }

  /**
   * 验证配置
   */
  async validateConfig(config: DistributionTarget): Promise<ValidationResult> {
    const rssConfig = config.targetConfig as unknown as RssTargetConfig;
    const errors: string[] = [];
    const warnings: string[] = [];

    // 检查 Feed Token
    if (!rssConfig.feedToken) {
      errors.push("Feed Token 不能为空");
    } else if (rssConfig.feedToken.length < 16) {
      warnings.push("Feed Token 过短，建议使用更长的随机字符串");
    }

    // 检查条目数量
    if (rssConfig.itemCount !== undefined) {
      if (rssConfig.itemCount < 1) {
        errors.push("Feed 条目数必须至少为 1");
      } else if (rssConfig.itemCount > 100) {
        warnings.push("Feed 条目数过多可能影响加载速度");
      }
    }

    // 检查格式
    if (
      rssConfig.feedFormat &&
      !["rss2", "atom"].includes(rssConfig.feedFormat)
    ) {
      errors.push("不支持的 Feed 格式");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 测试连接
   */
  async testConnection(
    config: DistributionTarget,
  ): Promise<TestConnectionResult> {
    const validation = await this.validateConfig(config);

    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors.join("; "),
      };
    }

    const rssConfig = config.targetConfig as unknown as RssTargetConfig;

    return {
      success: true,
      details: {
        feedUrl: this.getFeedUrl(rssConfig.feedToken),
        format: rssConfig.feedFormat || "rss2",
        itemCount: rssConfig.itemCount || 50,
      },
    };
  }

  /**
   * 获取默认配置
   */
  getDefaultConfig(): Record<string, unknown> {
    return {
      feedFormat: "rss2",
      itemCount: 50,
      includeContent: true,
      feedToken: this.generateFeedToken(),
    };
  }

  // ==================== 公共方法 ====================

  /**
   * 获取 Feed URL
   */
  getFeedUrl(feedToken: string): string {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://anykeep.app";
    return `${baseUrl}/api/distribution/rss/${feedToken}`;
  }

  /**
   * 生成新的 Feed Token
   */
  generateFeedToken(): string {
    const array = new Uint8Array(24);
    crypto.getRandomValues(array);
    return Array.from(array)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  /**
   * 生成 RSS 2.0 Feed
   */
  generateRss2Feed(
    bookmarks: DistributionBookmark[],
    config: DistributionTarget,
  ): string {
    const rssConfig = config.targetConfig as unknown as RssTargetConfig;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://anykeep.app";
    const feedUrl = this.getFeedUrl(rssConfig.feedToken);
    const pubDate = new Date().toUTCString();

    const items = bookmarks
      .map((b) => {
        const description = rssConfig.includeContent
          ? this.escapeXml(b.aiSummary || b.description || "")
          : "";

        const categories = (b.tags || [])
          .map((tag) => `<category>${this.escapeXml(tag)}</category>`)
          .join("\n        ");

        return `    <item>
      <title>${this.escapeXml(b.title)}</title>
      <link>${this.escapeXml(b.url)}</link>
      <guid isPermaLink="false">${b.id}</guid>
      <pubDate>${b.createdAt.toUTCString()}</pubDate>
      <description><![CDATA[${description}]]></description>
      ${categories}
    </item>`;
      })
      .join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${this.escapeXml(config.name)} - AnyKeep</title>
    <link>${baseUrl}</link>
    <description>AnyKeep 书签订阅 - ${this.escapeXml(config.name)}</description>
    <language>zh-CN</language>
    <lastBuildDate>${pubDate}</lastBuildDate>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml"/>
    <generator>AnyKeep RSS Generator</generator>
${items}
  </channel>
</rss>`;
  }

  /**
   * 生成 Atom Feed
   */
  generateAtomFeed(
    bookmarks: DistributionBookmark[],
    config: DistributionTarget,
  ): string {
    const rssConfig = config.targetConfig as unknown as RssTargetConfig;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://anykeep.app";
    const feedUrl = this.getFeedUrl(rssConfig.feedToken);
    const updated = new Date().toISOString();

    const entries = bookmarks
      .map((b) => {
        const content = rssConfig.includeContent
          ? `<content type="html"><![CDATA[${b.aiSummary || b.description || ""}]]></content>`
          : "";

        const categories = (b.tags || [])
          .map((tag) => `<category term="${this.escapeXml(tag)}"/>`)
          .join("\n    ");

        return `  <entry>
    <title>${this.escapeXml(b.title)}</title>
    <link href="${this.escapeXml(b.url)}"/>
    <id>urn:anykeep:bookmark:${b.id}</id>
    <updated>${b.updatedAt.toISOString()}</updated>
    <published>${b.createdAt.toISOString()}</published>
    ${content}
    ${categories}
  </entry>`;
      })
      .join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${this.escapeXml(config.name)} - AnyKeep</title>
  <subtitle>AnyKeep 书签订阅</subtitle>
  <link href="${feedUrl}" rel="self" type="application/atom+xml"/>
  <link href="${baseUrl}" rel="alternate" type="text/html"/>
  <id>urn:anykeep:feed:${config.id}</id>
  <updated>${updated}</updated>
  <generator uri="https://anykeep.app" version="1.0">AnyKeep</generator>
${entries}
</feed>`;
  }

  // ==================== 私有方法 ====================

  /**
   * XML 转义
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }
}
