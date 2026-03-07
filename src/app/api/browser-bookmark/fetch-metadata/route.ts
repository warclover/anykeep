/**
 * 元数据抓取 API
 * POST /api/browser-bookmark/fetch-metadata - 批量抓取网页元数据
 */

import { withAuthMiddleware } from "@/lib/api/middleware";
import { successResponse, badRequestError } from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import {
  batchFetchMetadata,
  type FetchConfig,
  type PageMetadata,
} from "@/lib/browser-bookmark/metadata-fetcher";

// ============================================
// 类型定义
// ============================================

interface FetchMetadataRequest {
  urls: string[];
  timeout?: number;
  concurrency?: number;
  fetchFavicon?: boolean;
}

interface MetadataItem {
  url: string;
  success: boolean;
  metadata?: PageMetadata;
  error?: string;
}

// ============================================
// POST 批量抓取元数据
// ============================================

/**
 * POST /api/browser-bookmark/fetch-metadata
 * 批量抓取网页元数据
 *
 * Request Body:
 * {
 *   urls: string[],           // 要抓取的 URL 列表（最多 50 个）
 *   timeout?: number,         // 单个请求超时（毫秒，默认 10000）
 *   concurrency?: number,     // 并发数（默认 5）
 *   fetchFavicon?: boolean    // 是否抓取 favicon（默认 true）
 * }
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  // 1. 解析请求体
  const body: FetchMetadataRequest = await request.json();
  const { urls, timeout = 10000, concurrency = 5, fetchFavicon = true } = body;

  // 2. 验证参数
  if (!Array.isArray(urls) || urls.length === 0) {
    return badRequestError("urls 必须是非空数组");
  }

  if (urls.length > 50) {
    return badRequestError("单次最多抓取 50 个 URL");
  }

  if (timeout < 1000 || timeout > 30000) {
    return badRequestError("timeout 必须在 1000-30000 毫秒之间");
  }

  if (concurrency < 1 || concurrency > 10) {
    return badRequestError("concurrency 必须在 1-10 之间");
  }

  // 3. 验证 URL 格式
  const invalidUrls: string[] = [];
  for (const url of urls) {
    try {
      new URL(url);
    } catch {
      invalidUrls.push(url);
    }
  }

  if (invalidUrls.length > 0) {
    return badRequestError(
      `无效的 URL: ${invalidUrls.slice(0, 3).join(", ")}${
        invalidUrls.length > 3 ? "..." : ""
      }`,
    );
  }

  // 4. 执行批量抓取
  const config: FetchConfig = {
    timeout,
    concurrency,
    fetchFavicon,
  };

  const startTime = Date.now();
  const result = await batchFetchMetadata(urls, config);
  const duration = Date.now() - startTime;

  // 5. 记录日志
  logger.info(
    {
      userId,
      total: result.total,
      successful: result.successful,
      failed: result.failed,
      durationMs: duration,
    },
    "Metadata fetched",
  );

  // 6. 返回结果
  const items: MetadataItem[] = result.results.map((r) => ({
    url: r.url,
    success: r.success,
    metadata: r.metadata,
    error: r.error,
  }));

  return successResponse({
    total: result.total,
    successful: result.successful,
    failed: result.failed,
    items,
    durationMs: duration,
  });
});
