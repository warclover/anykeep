/**
 * URL 健康检测服务
 *
 * 特点：
 * - 并发控制，避免过载
 * - HEAD 请求优先，减少带宽
 * - 超时处理
 * - 错误分类
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { logger } from "@/lib/logger";
import type {
  LinkCheckResult,
  HealthStatus,
  HealthErrorType,
  BookmarkForCheck,
  UrlCheckOptions,
} from "../types";
import { LINK_HEALTH_CONFIG } from "../types";

/**
 * URL 健康检测服务
 */
export class UrlChecker {
  /**
   * 批量检测 URL
   *
   * @param bookmarks - 待检测的书签列表
   * @param options - 检测选项
   * @returns 检测结果列表
   */
  async checkBatch(
    bookmarks: BookmarkForCheck[],
    options: UrlCheckOptions,
  ): Promise<LinkCheckResult[]> {
    const results: LinkCheckResult[] = [];
    const { timeout, concurrency } = options;

    logger.debug(
      {
        count: bookmarks.length,
        concurrency,
        timeout,
      },
      "UrlChecker: Starting batch check",
    );

    // 分批并发执行
    for (let i = 0; i < bookmarks.length; i += concurrency) {
      const batch = bookmarks.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map((b) => this.checkSingle(b, timeout)),
      );
      results.push(...batchResults);
    }

    const stats = {
      total: results.length,
      healthy: results.filter((r) => r.status === "healthy").length,
      failed: results.filter((r) => r.status === "failed").length,
      slow: results.filter((r) => r.status === "slow").length,
      redirect: results.filter((r) => r.status === "redirect").length,
    };

    logger.debug(stats, "UrlChecker: Batch check completed");

    return results;
  }

  /**
   * 检测单个 URL
   *
   * @param bookmark - 待检测的书签
   * @param timeout - 超时时间（毫秒）
   * @returns 检测结果
   */
  async checkSingle(
    bookmark: BookmarkForCheck,
    timeout: number,
  ): Promise<LinkCheckResult> {
    const startTime = Date.now();

    // 验证 URL
    if (!this.isValidUrl(bookmark.url)) {
      return {
        bookmarkId: bookmark.id,
        url: bookmark.url,
        status: "failed",
        errorType: "not_found",
        errorMessage: "无效的 URL 格式",
        checkedAt: new Date(),
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      let response: Response;

      try {
        // 先尝试 HEAD 请求（更快、更省带宽）
        response = await fetch(bookmark.url, {
          method: "HEAD",
          signal: controller.signal,
          redirect: "follow",
          headers: {
            "User-Agent": LINK_HEALTH_CONFIG.USER_AGENT,
            Accept: "*/*",
          },
        });
      } catch {
        // HEAD 失败时尝试 GET（某些服务器不支持 HEAD）
        response = await fetch(bookmark.url, {
          method: "GET",
          signal: controller.signal,
          redirect: "follow",
          headers: {
            "User-Agent": LINK_HEALTH_CONFIG.USER_AGENT,
            Accept: "*/*",
          },
        });
      }

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;
      const status = this.classifyHttpStatus(response.status, responseTime);

      return {
        bookmarkId: bookmark.id,
        url: bookmark.url,
        status,
        httpStatus: response.status,
        responseTimeMs: responseTime,
        redirectUrl: response.redirected ? response.url : undefined,
        checkedAt: new Date(),
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const { status, errorType, errorMessage } = this.classifyError(error);

      logger.debug(
        {
          bookmarkId: bookmark.id,
          url: bookmark.url.slice(0, 100),
          errorType,
          responseTimeMs: responseTime,
        },
        "UrlChecker: Check failed",
      );

      return {
        bookmarkId: bookmark.id,
        url: bookmark.url,
        status,
        errorType,
        errorMessage,
        responseTimeMs: responseTime,
        checkedAt: new Date(),
      };
    }
  }

  /**
   * 验证 URL 是否有效
   */
  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      // 跳过非 HTTP 协议
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return false;
      }
      // 跳过特殊协议
      if (
        LINK_HEALTH_CONFIG.SKIP_PROTOCOLS.some((p) =>
          url.toLowerCase().startsWith(p),
        )
      ) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 根据 HTTP 状态码分类健康状态
   */
  private classifyHttpStatus(
    httpStatus: number,
    responseTime: number,
  ): HealthStatus {
    // 2xx 成功
    if (httpStatus >= 200 && httpStatus < 300) {
      if (responseTime > LINK_HEALTH_CONFIG.SLOW_THRESHOLD_MS) {
        return "slow";
      }
      return "healthy";
    }

    // 3xx 重定向（已被 follow，所以正常情况不会到这里）
    if (httpStatus >= 300 && httpStatus < 400) {
      return "redirect";
    }

    // 4xx 客户端错误（404 等）
    // 5xx 服务器错误
    return "failed";
  }

  /**
   * 分类网络错误类型
   */
  private classifyError(error: unknown): {
    status: HealthStatus;
    errorType: HealthErrorType;
    errorMessage: string;
  } {
    const message = error instanceof Error ? error.message : String(error);
    const lowerMessage = message.toLowerCase();

    // 超时 / 中止
    if (
      lowerMessage.includes("abort") ||
      lowerMessage.includes("timeout") ||
      lowerMessage.includes("timed out")
    ) {
      return {
        status: "failed",
        errorType: "timeout",
        errorMessage: "请求超时",
      };
    }

    // SSL 证书错误
    if (
      lowerMessage.includes("ssl") ||
      lowerMessage.includes("certificate") ||
      lowerMessage.includes("cert")
    ) {
      return {
        status: "failed",
        errorType: "ssl_error",
        errorMessage: "SSL 证书错误",
      };
    }

    // DNS 解析错误
    if (
      lowerMessage.includes("enotfound") ||
      lowerMessage.includes("getaddrinfo") ||
      lowerMessage.includes("dns")
    ) {
      return {
        status: "failed",
        errorType: "dns_error",
        errorMessage: "DNS 解析失败，域名可能已不存在",
      };
    }

    // 连接被拒绝
    if (
      lowerMessage.includes("econnrefused") ||
      lowerMessage.includes("refused") ||
      lowerMessage.includes("econnreset")
    ) {
      return {
        status: "failed",
        errorType: "connection_refused",
        errorMessage: "连接被拒绝，服务器可能已关闭",
      };
    }

    // 网络错误
    if (
      lowerMessage.includes("network") ||
      lowerMessage.includes("fetch failed")
    ) {
      return {
        status: "failed",
        errorType: "connection_refused",
        errorMessage: "网络连接失败",
      };
    }

    // 默认：未知错误归类为 not_found
    return {
      status: "failed",
      errorType: "not_found",
      errorMessage: message.slice(0, 200),
    };
  }
}

/**
 * 默认导出单例
 */
export const urlChecker = new UrlChecker();
