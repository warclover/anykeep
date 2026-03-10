/**
 * 批量导入收藏 API
 * POST /api/bookmarks/batch-import - 批量创建收藏
 */

import { createClient } from "@/lib/supabase/server";
import { detectPlatformFromUrl } from "@/lib/constants/platforms";
import {
  successResponse,
  quotaExceededError,
  databaseError,
  badRequestError,
  safeParseBody,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import type { BookmarkInsert, Platform } from "@/types/supabase";
import type { ImportError } from "@/lib/browser-bookmark/types";
import { BOOKMARK } from "@/lib/constants/messages";
import { withAuthMiddleware } from "@/lib/api/middleware";

interface BatchImportResult {
  success: number;
  failed: number;
  skipped: number; // 重复跳过的数量
  errors: ImportError[];
}

/**
 * POST /api/bookmarks/batch-import
 * 批量导入收藏
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  // 2. 安全解析请求体
  const { data: body, error: parseError } = await safeParseBody<{
    bookmarks: unknown;
  }>(request);
  if (parseError) return parseError;

  const bookmarks = body.bookmarks;

  if (!Array.isArray(bookmarks) || bookmarks.length === 0) {
    return badRequestError("bookmarks 必须是非空数组");
  }

  if (bookmarks.length > 100) {
    return badRequestError("单次最多导入 100 条书签");
  }

  // 3. 检查存储配额
  const supabase = await createClient();
  // 类型断言: 手动维护类型文件时需要此断言
  const { data: profile, error: profileError } = (await supabase
    .from("profiles")
    .select("storage_quota, storage_used")
    .eq("id", userId)
    .single()) as unknown as {
    data: {
      storage_quota: number | null;
      storage_used: number | null;
    } | null;
    error: { message: string } | null;
  };

  if (profileError) {
    return databaseError(BOOKMARK.LOAD_ERROR, profileError);
  }

  if (!profile) {
    return databaseError(BOOKMARK.LOAD_ERROR, { message: "用户信息不存在" });
  }

  const remainingQuota =
    (profile.storage_quota ?? 0) - (profile.storage_used ?? 0);
  if (remainingQuota < bookmarks.length) {
    return quotaExceededError(
      `存储配额不足，剩余 ${remainingQuota} 条，需要 ${bookmarks.length} 条`,
    );
  }

  // 4. 批量创建收藏
  const result: BatchImportResult = {
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  const bookmarkInserts: BookmarkInsert[] = [];

  // ✅ 性能优化：批量查询所有 URL 是否已存在（避免 N+1 查询）
  const urls = bookmarks.map((b) => b.url).filter(Boolean);
  const { data: existingBookmarks } = (await supabase
    .from("bookmarks")
    .select("url")
    .eq("user_id", userId)
    .in("url", urls)
    .is("deleted_at", null)) as unknown as {
    data: { url: string }[] | null;
    error: unknown;
  };

  // 构建 URL 去重 Set（O(1) 查找复杂度）
  const existingUrls = new Set(existingBookmarks?.map((b) => b.url) || []);

  for (const bookmark of bookmarks) {
    try {
      // 验证必填字段
      if (!bookmark.url || !bookmark.title) {
        result.failed++;
        result.errors.push({
          url: bookmark.url || "未知",
          title: bookmark.title || "未知",
          reason: "URL 和标题是必填项",
        });
        continue;
      }

      // ✅ 检查 URL 是否已存在（从 Set 中查找，O(1) 复杂度）
      if (existingUrls.has(bookmark.url)) {
        // 重复的 URL 记为跳过而非失败
        result.skipped++;
        continue;
      }

      // 准备插入数据：优先使用传入的 platform，否则从 URL 检测
      const platform =
        (bookmark.platform as Platform) || detectPlatformFromUrl(bookmark.url);

      // 截断过长的字段，避免数据库约束错误
      const truncatedTitle =
        bookmark.title.length > 500
          ? bookmark.title.slice(0, 497) + "..."
          : bookmark.title;

      // 构建插入数据
      const insertData: BookmarkInsert = {
        user_id: userId,
        url: bookmark.url,
        title: truncatedTitle,
        description: bookmark.description || null,
        platform,
        folder_id: bookmark.folderId || null,
        user_tags: bookmark.userTags || null,
        notes: bookmark.notes || null,
        status: "COMPLETED", // 批量导入时跳过 AI 处理
        ai_summary: null,
        ai_tags: null,
        cover_url: null,
        author: null,
      };

      // 如果提供了原始添加时间，使用它作为 created_at
      if (bookmark.originalAddDate) {
        insertData.created_at = bookmark.originalAddDate;
      }

      // 添加导入元数据
      if (bookmark.importSource) {
        insertData.import_source = bookmark.importSource;
      }
      if (bookmark.importBatchId) {
        insertData.import_batch_id = bookmark.importBatchId;
      }

      bookmarkInserts.push(insertData);
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          url: bookmark.url,
        },
        "Batch import: Failed to prepare bookmark",
      );
      result.failed++;
      result.errors.push({
        url: bookmark.url || "未知",
        title: bookmark.title || "未知",
        reason: "处理失败",
      });
    }
  }

  // 5. 批量插入数据库
  if (bookmarkInserts.length > 0) {
    const { data: inserted, error: insertError } = (await (
      supabase.from(
        "bookmarks",
      ) /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any
    )
      .insert(bookmarkInserts)
      .select()) as {
      data: unknown[] | null;
      error: { message?: string; code?: string } | null;
    };

    if (insertError) {
      // 提取详细错误信息
      const errorDetail =
        insertError.message || insertError.code || String(insertError);
      logger.error(
        {
          error: insertError,
          errorMessage: errorDetail,
          count: bookmarkInserts.length,
          // 记录第一条数据的 platform 用于调试
          samplePlatform: bookmarkInserts[0]?.platform,
        },
        "Batch import: Database insert failed",
      );
      // 返回详细错误信息帮助调试
      return databaseError(
        `${BOOKMARK.CREATE_ERROR}: ${errorDetail}`,
        insertError,
      );
    }

    result.success = inserted?.length ?? 0;

    logger.info(
      {
        success: result.success,
        failed: result.failed,
        total: bookmarks.length,
      },
      "Batch import: Completed",
    );
  }

  return successResponse({
    ...result,
    message: BOOKMARK.BATCH_IMPORT_SUCCESS,
  });
});
