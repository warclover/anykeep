/**
 * 批量分类
 *
 * 将请求分块（chunkSize=20），控制并发（concurrency=5），
 * 使用 classify() 逐个处理，汇总结果。
 *
 * @version 2.0.0
 * @since 2026-03-09
 */

import { logger } from "@/lib/logger";
import { CLASSIFICATION_CONFIG } from "../config";
import { classify } from "../classify";
import type {
  ClassifyResult,
  BatchClassifyRequest,
  BatchClassifyResult,
} from "../types";

/**
 * 批量分类书签
 *
 * @example
 * ```typescript
 * const result = await batchClassify({
 *   requests: bookmarks.map(b => ({
 *     bookmarkId: b.id,
 *     title: b.title,
 *     tags: b.tags,
 *     userId: currentUser.id,
 *   })),
 * });
 * // result.successCount: 18
 * // result.failedCount: 2
 * ```
 */
export async function batchClassify(
  batch: BatchClassifyRequest,
): Promise<BatchClassifyResult> {
  const startTime = Date.now();
  const { chunkSize, concurrency: defaultConcurrency } =
    CLASSIFICATION_CONFIG.batch;
  const concurrency = batch.concurrency ?? defaultConcurrency;

  const allResults: Array<ClassifyResult & { bookmarkId: string }> = [];
  let successCount = 0;
  let failedCount = 0;

  // 分块
  const chunks = chunkArray(batch.requests, chunkSize);

  logger.info(
    {
      total: batch.requests.length,
      chunks: chunks.length,
      chunkSize,
      concurrency,
    },
    "BatchClassify: starting",
  );

  for (const chunk of chunks) {
    // 并发控制：每块内按 concurrency 并发
    const chunkResults = await processWithConcurrency(
      chunk,
      concurrency,
      async (request) => {
        try {
          const result = await classify(request);
          return { ...result, bookmarkId: request.bookmarkId, _ok: true };
        } catch (error) {
          logger.error(
            { bookmarkId: request.bookmarkId, error },
            "BatchClassify: single item failed",
          );
          return {
            bookmarkId: request.bookmarkId,
            _ok: false,
            error,
          };
        }
      },
    );

    for (const r of chunkResults) {
      if ("_ok" in r && r._ok === true) {
        const { _ok, ...result } = r;
        allResults.push(result as ClassifyResult & { bookmarkId: string });
        successCount++;
      } else {
        failedCount++;
      }
    }
  }

  const totalMs = Date.now() - startTime;

  logger.info(
    { successCount, failedCount, totalMs },
    "BatchClassify: complete",
  );

  return {
    results: allResults,
    totalMs,
    successCount,
    failedCount,
  };
}

// ============================================================================
// 工具函数
// ============================================================================

/** 将数组分块 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * 并发控制执行
 *
 * 模拟 p-limit 的行为，不引入外部依赖。
 */
async function processWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const currentIndex = index++;
      results[currentIndex] = await fn(items[currentIndex]);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );

  await Promise.all(workers);
  return results;
}
