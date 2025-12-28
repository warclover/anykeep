/**
 * Wayback Machine 归档查找服务
 *
 * 使用 Archive.org Availability API 查找网页归档版本
 * API 文档: https://archive.org/help/wayback_api.php
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { logger } from "@/lib/logger";
import type { LinkCheckResult, WaybackResult } from "../types";
import { LINK_HEALTH_CONFIG } from "../types";

/**
 * Wayback API 响应结构
 */
interface WaybackApiResponse {
  url: string;
  archived_snapshots: {
    closest?: {
      status: string;
      available: boolean;
      url: string;
      timestamp: string;
    };
  };
}

/**
 * Wayback Machine 归档查找服务
 */
export class WaybackFinder {
  /**
   * 批量查找归档版本
   *
   * @param failedResults - 失效链接检测结果列表
   * @returns 归档查找结果列表
   */
  async findArchives(
    failedResults: LinkCheckResult[],
  ): Promise<WaybackResult[]> {
    const results: WaybackResult[] = [];

    // 限制查找数量
    const toCheck = failedResults.slice(
      0,
      LINK_HEALTH_CONFIG.WAYBACK_MAX_LOOKUP,
    );

    logger.debug(
      {
        requestCount: toCheck.length,
        originalCount: failedResults.length,
      },
      "WaybackFinder: Starting archive lookup",
    );

    // 并发限制，避免被 Archive.org 限流
    const concurrency = LINK_HEALTH_CONFIG.WAYBACK_CONCURRENCY;

    for (let i = 0; i < toCheck.length; i += concurrency) {
      const batch = toCheck.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map((r) => this.findSingle(r)),
      );
      results.push(...batchResults);

      // 添加延迟，避免被限流
      if (i + concurrency < toCheck.length) {
        await this.delay(LINK_HEALTH_CONFIG.WAYBACK_DELAY_MS);
      }
    }

    const foundCount = results.filter((r) => r.waybackUrl).length;
    logger.debug(
      {
        totalChecked: results.length,
        foundCount,
      },
      "WaybackFinder: Archive lookup completed",
    );

    return results;
  }

  /**
   * 查找单个 URL 的归档版本
   *
   * @param result - 链接检测结果
   * @returns 归档查找结果
   */
  async findSingle(result: LinkCheckResult): Promise<WaybackResult> {
    const baseResult: WaybackResult = {
      bookmarkId: result.bookmarkId,
      originalUrl: result.url,
    };

    try {
      const apiUrl = `${LINK_HEALTH_CONFIG.WAYBACK_API}?url=${encodeURIComponent(result.url)}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        LINK_HEALTH_CONFIG.DEFAULT_TIMEOUT_MS,
      );

      const response = await fetch(apiUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": LINK_HEALTH_CONFIG.USER_AGENT,
          Accept: "application/json",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.debug(
          {
            url: result.url.slice(0, 100),
            status: response.status,
          },
          "WaybackFinder: API request failed",
        );
        return baseResult;
      }

      const data = (await response.json()) as WaybackApiResponse;

      // 检查是否有可用的归档
      if (data.archived_snapshots?.closest?.available) {
        const snapshot = data.archived_snapshots.closest;

        logger.debug(
          {
            originalUrl: result.url.slice(0, 100),
            waybackUrl: snapshot.url.slice(0, 100),
            timestamp: snapshot.timestamp,
          },
          "WaybackFinder: Archive found",
        );

        return {
          ...baseResult,
          waybackUrl: snapshot.url,
          timestamp: snapshot.timestamp,
        };
      }

      return baseResult;
    } catch (error) {
      logger.warn(
        {
          url: result.url.slice(0, 100),
          error: error instanceof Error ? error.message : String(error),
        },
        "WaybackFinder: Failed to find archive",
      );

      return baseResult;
    }
  }

  /**
   * 格式化 Wayback 时间戳为可读日期
   *
   * Wayback 时间戳格式: YYYYMMDDHHmmss
   * 例如: 20231015123456 -> 2023-10-15 12:34:56
   *
   * @param timestamp - Wayback 时间戳
   * @returns 格式化的日期字符串
   */
  formatTimestamp(timestamp: string): string {
    if (!timestamp || timestamp.length < 8) {
      return "";
    }

    try {
      const year = timestamp.slice(0, 4);
      const month = timestamp.slice(4, 6);
      const day = timestamp.slice(6, 8);
      const hour = timestamp.slice(8, 10) || "00";
      const minute = timestamp.slice(10, 12) || "00";

      return `${year}-${month}-${day} ${hour}:${minute}`;
    } catch {
      // 静默失败：时间戳格式无效时返回原始字符串
      return timestamp;
    }
  }

  /**
   * 构建 Wayback Machine 查看链接
   *
   * @param originalUrl - 原始 URL
   * @param timestamp - 可选的时间戳，不提供则使用最新版本
   * @returns Wayback Machine URL
   */
  buildWaybackUrl(originalUrl: string, timestamp?: string): string {
    // Note: encodedUrl is reserved for future URL encoding if needed
    const _encodedUrl = encodeURIComponent(originalUrl);

    if (timestamp) {
      return `https://web.archive.org/web/${timestamp}/${originalUrl}`;
    }

    return `https://web.archive.org/web/*/${originalUrl}`;
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * 默认导出单例
 */
export const waybackFinder = new WaybackFinder();
