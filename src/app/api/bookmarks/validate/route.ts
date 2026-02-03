/**
 * POST /api/bookmarks/validate
 * 批量检测收藏链接有效性
 */

import type { NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  successResponse,
  unauthorizedError,
  databaseError,
  badRequestError,
} from "@/lib/utils/api-response";
import { isUrlValidatable, getSkipReason } from "@/lib/validation/url-filter";
import type { Platform } from "@/types/supabase";

interface ValidationResult {
  bookmarkId: number;
  url: string;
  status: "valid" | "invalid" | "error" | "skipped";
  statusCode?: number;
  error?: string;
  skipReason?: string;
}

/**
 * 检测单个 URL 的有效性
 */
async function validateUrl(
  url: string,
  timeout = 5000,
): Promise<{ valid: boolean; statusCode?: number; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AnyKeep/1.0; +https://anykeep.app)",
      },
    });

    clearTimeout(timeoutId);

    // 2xx 和 3xx 状态码视为有效
    const valid = response.status >= 200 && response.status < 400;

    return {
      valid,
      statusCode: response.status,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        valid: false,
        error: "请求超时",
      };
    }

    return {
      valid: false,
      error: error instanceof Error ? error.message : "网络错误",
    };
  }
}

/**
 * POST /api/bookmarks/validate
 * 批量检测收藏链接有效性（用户手动触发）
 */
export async function POST(request: NextRequest) {
  try {
    logger.debug(
      {
        action: "validate_start",
      },
      "POST: Validate bookmarks",
    );

    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    logger.debug(
      {
        userId: user?.id,
        authError: authError?.message,
        action: "auth_check",
      },
      "POST: User authentication",
    );

    if (authError || !user) {
      return unauthorizedError();
    }

    // 2. 解析请求参数（可选：限制检测范围）
    const body = await request.json().catch(() => ({}));
    const { bookmarkIds, limit = 100 } = body;

    logger.debug(
      {
        bookmarkIds: bookmarkIds?.length,
        limit,
        action: "parse_params",
      },
      "POST: Parse validation parameters",
    );

    // 3. 获取要检测的收藏
    // 类型断言: 手动维护类型文件时需要此断言
    let query = (supabase.from("bookmarks") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .select("id, url, platform")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .eq("is_in_trash", false); // 不检测垃圾箱中的收藏

    if (bookmarkIds && Array.isArray(bookmarkIds)) {
      query = query.in("id", bookmarkIds);
    }

    query = query.limit(limit);

    type BookmarkToValidate = {
      id: number;
      url: string;
      platform: string | null;
    };
    const { data: bookmarks, error: fetchError } = (await query) as {
      data: BookmarkToValidate[] | null;
      error: { message: string } | null;
    };

    logger.debug(
      {
        bookmarksCount: bookmarks?.length,
        fetchError: fetchError?.message,
        action: "fetch_bookmarks",
      },
      "POST: Fetch bookmarks",
    );

    if (fetchError) {
      return databaseError("获取收藏失败", fetchError);
    }

    if (!bookmarks || bookmarks.length === 0) {
      return badRequestError("没有找到需要检测的收藏");
    }

    // 4. 智能过滤：分离可检测和不可检测的链接
    const validatableBookmarks: typeof bookmarks = [];
    const skippedBookmarks: Array<{
      bookmarkId: number;
      url: string;
      skipReason: string;
    }> = [];

    for (const bookmark of bookmarks) {
      const platform = bookmark.platform as Platform | null | undefined;
      if (isUrlValidatable(bookmark.url, platform)) {
        validatableBookmarks.push(bookmark);
      } else {
        skippedBookmarks.push({
          bookmarkId: bookmark.id,
          url: bookmark.url,
          skipReason: getSkipReason(bookmark.url, platform),
        });
      }
    }

    logger.info(
      {
        totalBookmarks: bookmarks.length,
        validatableCount: validatableBookmarks.length,
        skippedCount: skippedBookmarks.length,
        action: "filter_bookmarks",
      },
      "POST: Filter validatable bookmarks",
    );

    // 5. 批量检测（并发控制）
    const CONCURRENCY = 10;
    const results: ValidationResult[] = [];
    const startTime = Date.now();

    for (let i = 0; i < validatableBookmarks.length; i += CONCURRENCY) {
      const batch = validatableBookmarks.slice(i, i + CONCURRENCY);

      const batchResults = await Promise.allSettled(
        batch.map(async (bookmark) => {
          const result = await validateUrl(bookmark.url);

          return {
            bookmarkId: bookmark.id,
            url: bookmark.url,
            status: result.valid ? ("valid" as const) : ("invalid" as const),
            statusCode: result.statusCode,
            error: result.error,
          };
        }),
      );

      for (const promiseResult of batchResults) {
        if (promiseResult.status === "fulfilled") {
          results.push(promiseResult.value);
        } else {
          logger.error(
            {
              error: promiseResult.reason,
              action: "validate_batch_error",
            },
            "POST: Batch validation error",
          );
        }
      }
    }

    const duration = Date.now() - startTime;

    // 6. 添加跳过的书签到结果
    for (const skipped of skippedBookmarks) {
      results.push({
        bookmarkId: skipped.bookmarkId,
        url: skipped.url,
        status: "skipped",
        skipReason: skipped.skipReason,
      });
    }

    // 7. 更新失效状态到数据库
    const serviceClient = await createServiceClient();
    const invalidBookmarks = results.filter((r) => r.status === "invalid");

    if (invalidBookmarks.length > 0) {
      const invalidIds = invalidBookmarks.map((b) => b.bookmarkId);

      const { error: updateError } = (await (
        serviceClient.from("bookmarks") as any
      ) // eslint-disable-line @typescript-eslint/no-explicit-any
        .update({
          is_invalid: true,
          invalidated_at: new Date().toISOString(),
          last_validation_at: new Date().toISOString(),
        })
        .in("id", invalidIds)) as { error: { message: string } | null };

      if (updateError) {
        logger.error(
          {
            error: updateError,
            count: invalidIds.length,
            action: "update_invalid_status",
          },
          "POST: Failed to update invalid status",
        );
      }
    }

    // 8. 更新有效状态（清除失效标记）
    const validBookmarks = results.filter((r) => r.status === "valid");

    if (validBookmarks.length > 0) {
      const validIds = validBookmarks.map((b) => b.bookmarkId);

      const { error: updateError } = (await (
        serviceClient.from("bookmarks") as any
      ) // eslint-disable-line @typescript-eslint/no-explicit-any
        .update({
          is_invalid: false,
          invalidated_at: null,
          last_validation_at: new Date().toISOString(),
        })
        .in("id", validIds)) as { error: { message: string } | null };

      if (updateError) {
        logger.error(
          {
            error: updateError,
            count: validIds.length,
            action: "update_valid_status",
          },
          "POST: Failed to update valid status",
        );
      }
    }

    // 9. 记录验证历史
    const endTime = new Date();
    const { error: historyError } = (await (
      serviceClient.from("validation_history") as any
    ) // eslint-disable-line @typescript-eslint/no-explicit-any
      .insert({
        user_id: user.id,
        total_bookmarks: bookmarks.length,
        total_checked: validatableBookmarks.length,
        skipped_count: skippedBookmarks.length,
        valid_count: validBookmarks.length,
        invalid_count: invalidBookmarks.length,
        error_count: 0, // 当前实现中没有单独追踪错误
        duration_ms: duration,
        average_response_time_ms:
          validatableBookmarks.length > 0
            ? Math.round(duration / validatableBookmarks.length)
            : 0,
        invalid_bookmarks: invalidBookmarks.map((b) => ({
          id: b.bookmarkId,
          url: b.url,
          error: b.error,
          statusCode: b.statusCode,
        })),
        skipped_reasons: skippedBookmarks.reduce(
          (acc, item) => {
            const reason = item.skipReason;
            acc[reason] = (acc[reason] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        ),
        started_at: new Date(startTime).toISOString(),
        completed_at: endTime.toISOString(),
      })) as { error: { message: string } | null };

    if (historyError) {
      logger.error(
        {
          error: historyError,
          action: "insert_validation_history",
        },
        "POST: Failed to insert validation history",
      );
      // 不中断流程，仅记录错误
    }

    // 10. 返回检测结果
    logger.info(
      {
        totalBookmarks: bookmarks.length,
        validatableCount: validatableBookmarks.length,
        skippedCount: skippedBookmarks.length,
        validCount: validBookmarks.length,
        invalidCount: invalidBookmarks.length,
        duration,
        action: "validate_success",
      },
      "POST: Validation completed",
    );

    return successResponse({
      total: bookmarks.length,
      checked: validatableBookmarks.length,
      skipped: skippedBookmarks.length,
      valid: validBookmarks.length,
      invalid: invalidBookmarks.length,
      duration,
      results,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "validate_bookmarks",
      },
      "POST /api/bookmarks/validate error",
    );
    return databaseError("检测失败", error);
  }
}
