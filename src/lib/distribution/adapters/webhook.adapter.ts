/**
 * Webhook 分发适配器
 *
 * @description 将书签数据 POST 到用户配置的 Webhook URL
 * 支持 HMAC 签名验证和指数退避重试
 */

import type { IDistributionAdapter } from "../interfaces/adapter.interface";
import type {
  DistributionTarget,
  DistributionResult,
  DistributionRecord,
  ValidationResult,
  TestConnectionResult,
  DistributionBookmark,
  WebhookTargetConfig,
} from "../types";
import { logger } from "@/lib/logger";

/**
 * Webhook 请求体格式
 */
interface WebhookPayload {
  /** 事件类型 */
  event: "bookmark_sync";
  /** 时间戳 */
  timestamp: string;
  /** 书签数据 */
  bookmarks: WebhookBookmarkData[];
  /** 元数据 */
  metadata: {
    targetId: string;
    targetName: string;
    totalCount: number;
  };
}

/**
 * 书签数据格式（Webhook 输出）
 */
interface WebhookBookmarkData {
  id: string;
  title: string;
  url: string;
  platform?: string;
  description?: string;
  aiSummary?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * WebhookAdapter 实现
 */
export class WebhookAdapter implements IDistributionAdapter {
  readonly type = "webhook" as const;
  readonly displayName = "Webhook 推送";
  readonly description = "将书签数据推送到自定义 URL";
  readonly supportedPlatforms = ["web", "mobile", "desktop"] as const;

  /**
   * 初始化适配器
   */
  async initialize(_config: DistributionTarget): Promise<void> {
    // Webhook 无需初始化
  }

  /**
   * 执行分发 - 发送 Webhook 请求
   */
  async distribute(
    bookmarks: DistributionBookmark[],
    config: DistributionTarget,
  ): Promise<DistributionResult> {
    const webhookConfig = config.targetConfig as unknown as WebhookTargetConfig;

    if (!webhookConfig.url) {
      throw new Error("未配置 Webhook URL");
    }

    // 构建请求体
    const payload: WebhookPayload = {
      event: "bookmark_sync",
      timestamp: new Date().toISOString(),
      bookmarks: bookmarks.map((b) => ({
        id: b.id,
        title: b.title,
        url: b.url,
        platform: b.platform,
        description: b.description,
        aiSummary: b.aiSummary,
        tags: b.tags,
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
      })),
      metadata: {
        targetId: config.id,
        targetName: config.name,
        totalCount: bookmarks.length,
      },
    };

    const body = JSON.stringify(payload);
    const records: DistributionRecord[] = [];
    const maxRetries = webhookConfig.retryCount || 3;

    // 尝试发送请求（带重试）
    let lastError: Error | null = null;
    let success = false;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.sendRequest(
          webhookConfig,
          body,
          payload.timestamp,
        );

        if (response.ok) {
          success = true;

          // 为每个书签创建成功记录
          for (const bookmark of bookmarks) {
            records.push({
              id: crypto.randomUUID(),
              targetId: config.id,
              bookmarkId: bookmark.id,
              status: "success",
              distributedAt: new Date(),
              createdAt: new Date(),
              retryCount: attempt,
            });
          }
          break;
        } else {
          const errorText = await response.text();
          lastError = new Error(
            `HTTP ${response.status}: ${errorText.substring(0, 200)}`,
          );
          logger.warn(
            {
              attempt,
              status: response.status,
              url: webhookConfig.url,
            },
            "Webhook request failed",
          );
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown error");
        logger.warn(
          {
            attempt,
            error: lastError.message,
            url: webhookConfig.url,
          },
          "Webhook request error",
        );
      }

      // 指数退避等待
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s...
        await this.sleep(delay);
      }
    }

    // 如果所有重试都失败
    if (!success) {
      for (const bookmark of bookmarks) {
        records.push({
          id: crypto.randomUUID(),
          targetId: config.id,
          bookmarkId: bookmark.id,
          status: "failed",
          errorMessage: lastError?.message || "Webhook 请求失败",
          createdAt: new Date(),
          retryCount: maxRetries,
        });
      }

      return {
        success: false,
        distributedCount: 0,
        failedCount: bookmarks.length,
        records,
        errors: [
          {
            bookmarkId: "batch",
            code: "WEBHOOK_ERROR",
            message: lastError?.message || "Webhook 请求失败",
          },
        ],
      };
    }

    return {
      success: true,
      distributedCount: bookmarks.length,
      failedCount: 0,
      records,
    };
  }

  /**
   * 验证配置
   */
  async validateConfig(config: DistributionTarget): Promise<ValidationResult> {
    const webhookConfig = config.targetConfig as unknown as WebhookTargetConfig;
    const errors: string[] = [];
    const warnings: string[] = [];

    // 检查 URL
    if (!webhookConfig.url) {
      errors.push("Webhook URL 不能为空");
    } else {
      try {
        const url = new URL(webhookConfig.url);
        if (!["http:", "https:"].includes(url.protocol)) {
          errors.push("URL 必须使用 http 或 https 协议");
        }
        if (url.protocol === "http:") {
          warnings.push("建议使用 HTTPS 以确保数据安全");
        }
      } catch {
        errors.push("无效的 URL 格式");
      }
    }

    // 检查重试次数
    if (
      webhookConfig.retryCount !== undefined &&
      (webhookConfig.retryCount < 0 || webhookConfig.retryCount > 5)
    ) {
      errors.push("重试次数必须在 0-5 之间");
    }

    // 警告：未配置签名密钥
    if (!webhookConfig.secretKey) {
      warnings.push("未配置签名密钥，无法验证请求来源");
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
    const webhookConfig = config.targetConfig as unknown as WebhookTargetConfig;

    if (!webhookConfig.url) {
      return {
        success: false,
        error: "未配置 Webhook URL",
      };
    }

    // 发送测试请求
    const testPayload = {
      event: "test",
      timestamp: new Date().toISOString(),
      message: "AnyKeep Webhook 连接测试",
    };

    const body = JSON.stringify(testPayload);

    try {
      const response = await this.sendRequest(
        webhookConfig,
        body,
        testPayload.timestamp,
      );

      if (response.ok) {
        return {
          success: true,
          details: {
            statusCode: response.status,
            message: "连接测试成功",
          },
        };
      } else {
        const errorText = await response.text();
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText.substring(0, 100)}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "连接测试失败",
      };
    }
  }

  /**
   * 获取默认配置
   */
  getDefaultConfig(): Record<string, unknown> {
    return {
      url: "",
      method: "POST",
      headers: {},
      secretKey: "",
      retryCount: 3,
    };
  }

  // ==================== 私有方法 ====================

  /**
   * 发送 HTTP 请求
   */
  private async sendRequest(
    config: WebhookTargetConfig,
    body: string,
    timestamp: string,
  ): Promise<Response> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "AnyKeep/1.0",
      "X-AnyKeep-Timestamp": timestamp,
      ...config.headers,
    };

    // 如果配置了密钥，生成签名
    if (config.secretKey) {
      const signature = await this.generateSignature(body, config.secretKey);
      headers["X-AnyKeep-Signature"] = signature;
    }

    return fetch(config.url, {
      method: config.method || "POST",
      headers,
      body,
      signal: AbortSignal.timeout(30000), // 30 秒超时
    });
  }

  /**
   * 生成 HMAC-SHA256 签名
   */
  private async generateSignature(
    payload: string,
    secret: string,
  ): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(payload);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
    const hashArray = Array.from(new Uint8Array(signature));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return `sha256=${hashHex}`;
  }

  /**
   * 等待指定时间
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
