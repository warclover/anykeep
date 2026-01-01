/**
 * Notion 同步适配器
 *
 * @module distribution/adapters
 * @description 将书签同步到 Notion Database
 */

import type { IDistributionAdapter } from "../interfaces";
import type {
  DistributionTarget,
  DistributionBookmark,
  DistributionResult,
  DistributionRecord,
  NotionTargetConfig,
  SupportedPlatform,
  ValidationResult,
  TestConnectionResult,
} from "../types";
import { decryptToken } from "../utils/token-crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Notion API 基础 URL
 */
const NOTION_API_URL = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

/**
 * 从 targetConfig 提取 NotionTargetConfig
 */
function getNotionConfig(config: DistributionTarget): NotionTargetConfig {
  const targetConfig = config.targetConfig as unknown as NotionTargetConfig;
  return {
    databaseId: targetConfig?.databaseId || "",
    propertyMapping: targetConfig?.propertyMapping || {},
    workspaceName: targetConfig?.workspaceName,
  };
}

/**
 * Notion Database 属性类型
 */
interface NotionProperty {
  id: string;
  name: string;
  type: string;
}

/**
 * Notion 同步适配器
 */
export class NotionAdapter implements IDistributionAdapter {
  readonly type = "notion" as const;
  readonly displayName = "Notion";
  readonly supportedPlatforms: readonly SupportedPlatform[] = [
    "web",
    "mobile",
    "desktop",
  ];

  private accessToken: string | null = null;

  constructor(private readonly supabase?: SupabaseClient) {}

  /**
   * 初始化适配器，获取解密后的 Token
   */
  async initialize(config: DistributionTarget): Promise<void> {
    if (!this.supabase) {
      throw new Error("Supabase client is required for NotionAdapter");
    }

    // 获取加密的 Token
    const { data: tokenRecord, error } = await this.supabase
      .from("distribution_oauth_tokens")
      .select("access_token")
      .eq("user_id", config.userId)
      .eq("provider", "notion")
      .single();

    if (error || !tokenRecord) {
      throw new Error("Notion 未授权，请先连接 Notion");
    }

    // 解密 Token
    this.accessToken = await decryptToken(tokenRecord.access_token);
  }

  /**
   * 执行同步分发
   */
  async distribute(
    bookmarks: DistributionBookmark[],
    config: DistributionTarget,
  ): Promise<DistributionResult> {
    if (!this.accessToken) {
      throw new Error("NotionAdapter not initialized");
    }

    const notionConfig = getNotionConfig(config);

    if (!notionConfig.databaseId) {
      throw new Error("未配置 Notion Database");
    }

    const records: DistributionRecord[] = [];
    let distributedCount = 0;
    let failedCount = 0;
    const errors: { bookmarkId: string; code: string; message: string }[] = [];

    // 逐个同步书签（Notion API 不支持批量创建）
    for (const bookmark of bookmarks) {
      try {
        // 检查是否已存在（幂等性）
        const existingPage = await this.findExistingPage(
          notionConfig.databaseId,
          bookmark.url,
        );

        let externalId: string;

        if (existingPage) {
          // 更新现有页面
          await this.updatePage(existingPage.id, bookmark, notionConfig);
          externalId = existingPage.id;
        } else {
          // 创建新页面
          const newPage = await this.createPage(
            notionConfig.databaseId,
            bookmark,
            notionConfig,
          );
          externalId = newPage.id;
        }

        records.push({
          id: `${config.id}-${bookmark.id}-${Date.now()}`,
          targetId: config.id,
          bookmarkId: bookmark.id,
          status: "success",
          distributedAt: new Date(),
          externalId,
          retryCount: 0,
          createdAt: new Date(),
        });
        distributedCount++;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "未知错误";
        records.push({
          id: `${config.id}-${bookmark.id}-${Date.now()}`,
          targetId: config.id,
          bookmarkId: bookmark.id,
          status: "failed",
          errorMessage,
          retryCount: 0,
          createdAt: new Date(),
        });
        errors.push({
          bookmarkId: bookmark.id,
          code: "NOTION_API_ERROR",
          message: errorMessage,
        });
        failedCount++;
      }
    }

    return {
      success: failedCount === 0,
      distributedCount,
      failedCount,
      records,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * 验证配置
   */
  async validateConfig(config: DistributionTarget): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const notionConfig = getNotionConfig(config);

    if (!notionConfig.databaseId) {
      errors.push("请选择目标 Database");
    }

    if (
      !notionConfig.propertyMapping ||
      Object.keys(notionConfig.propertyMapping).length === 0
    ) {
      warnings.push("未配置属性映射，将使用默认映射");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * 测试连接
   */
  async testConnection(
    config: DistributionTarget,
  ): Promise<TestConnectionResult> {
    if (!this.accessToken) {
      return {
        success: false,
        error: "Notion 未授权",
      };
    }

    const notionConfig = getNotionConfig(config);

    if (!notionConfig.databaseId) {
      return {
        success: false,
        error: "请先选择 Database",
      };
    }

    try {
      // 获取 Database 信息
      const response = await this.notionRequest(
        `/databases/${notionConfig.databaseId}`,
      );

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: error.message || "无法访问 Database",
        };
      }

      const database = await response.json();

      return {
        success: true,
        details: {
          databaseTitle: database.title?.[0]?.plain_text || "Untitled Database",
          propertyCount: Object.keys(database.properties || {}).length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "连接测试失败",
      };
    }
  }

  /**
   * 获取用户可访问的 Database 列表
   */
  async getDatabases(): Promise<
    { id: string; title: string; icon: string | null }[]
  > {
    if (!this.accessToken) {
      throw new Error("Notion 未授权");
    }

    const response = await this.notionRequest("/search", {
      method: "POST",
      body: JSON.stringify({
        filter: {
          value: "database",
          property: "object",
        },
        sort: {
          direction: "descending",
          timestamp: "last_edited_time",
        },
      }),
    });

    if (!response.ok) {
      throw new Error("获取 Database 列表失败");
    }

    const data = await response.json();

    return data.results.map(
      (db: {
        id: string;
        title: { plain_text: string }[];
        icon: { emoji?: string; external?: { url: string } } | null;
      }) => ({
        id: db.id,
        title: db.title?.[0]?.plain_text || "Untitled",
        icon: db.icon?.emoji || db.icon?.external?.url || null,
      }),
    );
  }

  /**
   * 获取 Database 属性
   */
  async getDatabaseProperties(databaseId: string): Promise<NotionProperty[]> {
    if (!this.accessToken) {
      throw new Error("Notion 未授权");
    }

    const response = await this.notionRequest(`/databases/${databaseId}`);

    if (!response.ok) {
      throw new Error("获取 Database 属性失败");
    }

    const database = await response.json();
    const rawProperties = database.properties as
      | Record<string, { id: string; type: string }>
      | undefined;

    return Object.entries(rawProperties || {}).map(([name, prop]) => ({
      id: prop.id,
      name,
      type: prop.type,
    }));
  }

  // ==================== 私有方法 ====================

  /**
   * 发送 Notion API 请求
   */
  private async notionRequest(
    path: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    return fetch(`${NOTION_API_URL}${path}`, {
      ...options,
      headers,
    });
  }

  /**
   * 查找已存在的页面（通过 URL）
   */
  private async findExistingPage(
    databaseId: string,
    url: string,
  ): Promise<{ id: string } | null> {
    const response = await this.notionRequest(
      `/databases/${databaseId}/query`,
      {
        method: "POST",
        body: JSON.stringify({
          filter: {
            property: "URL",
            url: {
              equals: url,
            },
          },
          page_size: 1,
        }),
      },
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.results?.[0] || null;
  }

  /**
   * 创建新页面
   */
  private async createPage(
    databaseId: string,
    bookmark: DistributionBookmark,
    config: NotionTargetConfig,
  ): Promise<{ id: string }> {
    const properties = this.buildProperties(bookmark, config);

    const response = await this.notionRequest("/pages", {
      method: "POST",
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties,
        children: this.buildContent(bookmark),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "创建页面失败");
    }

    return response.json();
  }

  /**
   * 更新现有页面
   */
  private async updatePage(
    pageId: string,
    bookmark: DistributionBookmark,
    config: NotionTargetConfig,
  ): Promise<void> {
    const properties = this.buildProperties(bookmark, config);

    const response = await this.notionRequest(`/pages/${pageId}`, {
      method: "PATCH",
      body: JSON.stringify({ properties }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "更新页面失败");
    }
  }

  /**
   * 构建 Notion 属性
   */
  private buildProperties(
    bookmark: DistributionBookmark,
    _config: NotionTargetConfig,
  ): Record<string, unknown> {
    // 使用默认映射
    const properties: Record<string, unknown> = {
      // 标题（必需）
      Name: {
        title: [
          {
            text: { content: bookmark.title || "Untitled" },
          },
        ],
      },
      // URL
      URL: {
        url: bookmark.url,
      },
    };

    // 可选属性
    if (bookmark.platform) {
      properties["Platform"] = {
        select: { name: bookmark.platform },
      };
    }

    if (bookmark.description) {
      properties["Description"] = {
        rich_text: [
          {
            text: { content: bookmark.description.slice(0, 2000) },
          },
        ],
      };
    }

    if (bookmark.tags && bookmark.tags.length > 0) {
      properties["Tags"] = {
        multi_select: bookmark.tags.map((tag) => ({ name: tag })),
      };
    }

    if (bookmark.createdAt) {
      properties["Created"] = {
        date: { start: bookmark.createdAt.toISOString() },
      };
    }

    return properties;
  }

  /**
   * 构建页面内容
   */
  private buildContent(bookmark: DistributionBookmark): unknown[] {
    const blocks: unknown[] = [];

    // 添加 AI 摘要
    if (bookmark.aiSummary) {
      blocks.push({
        object: "block",
        type: "callout",
        callout: {
          icon: { emoji: "🤖" },
          rich_text: [
            {
              type: "text",
              text: { content: "AI 摘要" },
              annotations: { bold: true },
            },
          ],
          color: "blue_background",
        },
      });
      blocks.push({
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "text",
              text: { content: bookmark.aiSummary },
            },
          ],
        },
      });
    }

    // 添加原始链接
    blocks.push({
      object: "block",
      type: "bookmark",
      bookmark: {
        url: bookmark.url,
      },
    });

    return blocks;
  }
}
