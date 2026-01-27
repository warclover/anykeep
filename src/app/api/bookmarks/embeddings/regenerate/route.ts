/**
 * 向量嵌入重新生成 API
 * POST /api/bookmarks/embeddings/regenerate - 批量重新生成向量嵌入
 *
 * 用于 embedding 模型迁移时，使用新模型重新生成所有书签的向量
 *
 * @version 1.0.0
 * @since 2026-01-24
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  databaseError,
  internalError,
} from "@/lib/utils/api-response";
import {
  generateEmbedding,
  buildEmbeddingText,
  isValidEmbedding,
  getCurrentEmbeddingVersion,
} from "@/lib/utils/embedding-generator";
import { logger } from "@/lib/logger";

// 批量处理配置
const BATCH_SIZE = 5; // 每批处理数量（降低以避免超时）
const DELAY_BETWEEN_BATCHES = 1000; // 批次间延迟(ms)
const MAX_LIMIT = 500; // 单次请求最大处理数量

/**
 * POST /api/bookmarks/embeddings/regenerate
 * 重新生成书签的向量嵌入（即使已有向量也会重新���成）
 *
 * Body:
 * - bookmarkIds?: number[] - 指定书签ID列表（可选）
 * - limit?: number - 处理数量限制（默认100，最大500）
 * - dryRun?: boolean - 仅统计，不实际执行（默认false）
 * - olderThan?: string - 只处理指定日期之前创建的书签（ISO 格式）
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 2. 解析请求参数
    let bookmarkIds: number[] | undefined;
    let limit = 100;
    let dryRun = false;
    let olderThan: string | undefined;

    try {
      const body = await request.json();
      bookmarkIds = body.bookmarkIds;
      limit = Math.min(body.limit || 100, MAX_LIMIT);
      dryRun = body.dryRun === true;
      olderThan = body.olderThan;
    } catch {
      // 空body，使用默认值
    }

    // 3. 构建查询
    type BookmarkForRegenerate = {
      id: number;
      title: string | null;
      ai_summary: string | null;
      ai_tags: string[] | null;
      embedding_version: string | null;
      created_at: string;
    };

    let query = supabase
      .from("bookmarks")
      .select("id, title, ai_summary, ai_tags, embedding_version, created_at")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .not("embedding", "is", null) // 只处理已有向量的书签
      .order("created_at", { ascending: true }); // 从旧到新处理

    if (bookmarkIds && bookmarkIds.length > 0) {
      query = query.in("id", bookmarkIds);
    }

    if (olderThan) {
      query = query.lt("created_at", olderThan);
    }

    query = query.limit(limit);

    const { data: bookmarks, error: queryError } = (await query) as {
      data: BookmarkForRegenerate[] | null;
      error: { message: string } | null;
    };

    if (queryError) {
      return databaseError("查询书签失败", queryError);
    }

    if (!bookmarks || bookmarks.length === 0) {
      return successResponse({
        processed: 0,
        success: 0,
        failed: 0,
        message: "没有需要重新生成的书签",
        dryRun,
      });
    }

    // 4. Dry run 模式：仅返回统计
    if (dryRun) {
      const currentVersion = getCurrentEmbeddingVersion();
      const needsRegenerate = bookmarks.filter(
        (b) => b.embedding_version !== String(currentVersion),
      ).length;

      return successResponse({
        dryRun: true,
        total: bookmarks.length,
        needsRegenerate,
        alreadyCurrent: bookmarks.length - needsRegenerate,
        currentVersion,
        message: `找到 ${bookmarks.length} 条书签，其中 ${needsRegenerate} 条需要重新生成`,
        oldestBookmark: bookmarks[0]?.created_at,
        newestBookmark: bookmarks[bookmarks.length - 1]?.created_at,
      });
    }

    logger.info(
      {
        userId: user.id,
        count: bookmarks.length,
        action: "embedding_regenerate_start",
      },
      "Embedding Regenerate: Starting batch regeneration",
    );

    // 5. 批量重新生成向量
    const results = {
      processed: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [] as { id: number; error: string }[],
    };

    const currentVersion = getCurrentEmbeddingVersion();

    // 分批处理
    for (let i = 0; i < bookmarks.length; i += BATCH_SIZE) {
      const batch = bookmarks.slice(i, i + BATCH_SIZE);

      // 并行处理当前批次
      const batchPromises = batch.map(async (bookmark) => {
        try {
          // 构建向量文本
          const text = buildEmbeddingText(
            bookmark.title ?? "",
            bookmark.ai_summary ?? "",
            bookmark.ai_tags ?? [],
          );

          if (!text || text.trim().length < 5) {
            results.skipped++;
            return;
          }

          // 生成向量
          const embedding = await generateEmbedding(text);

          if (!isValidEmbedding(embedding)) {
            throw new Error("生成的向量无效");
          }

          // 更新数据库
          const { error: updateError } = await supabase
            .from("bookmarks")
            .update({
              embedding: embedding as unknown as string,
              embedding_version: currentVersion,
            })
            .eq("id", bookmark.id)
            .eq("user_id", user.id);

          if (updateError) {
            throw new Error(updateError.message);
          }

          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            id: bookmark.id,
            error: error instanceof Error ? error.message : "未知错误",
          });
          logger.error(
            {
              bookmarkId: bookmark.id,
              error: error instanceof Error ? error.message : String(error),
              action: "embedding_regenerate_single_failed",
            },
            "Embedding Regenerate: Single bookmark failed",
          );
        }
        results.processed++;
      });

      await Promise.all(batchPromises);

      // 批次间延迟，避免 API 限流
      if (i + BATCH_SIZE < bookmarks.length) {
        await new Promise((resolve) =>
          setTimeout(resolve, DELAY_BETWEEN_BATCHES),
        );
      }

      // 每 50 条输出进度
      if (results.processed % 50 === 0) {
        logger.info(
          {
            userId: user.id,
            processed: results.processed,
            total: bookmarks.length,
            success: results.success,
            failed: results.failed,
          },
          "Embedding Regenerate: Progress",
        );
      }
    }

    logger.info(
      {
        userId: user.id,
        processed: results.processed,
        success: results.success,
        failed: results.failed,
        skipped: results.skipped,
        action: "embedding_regenerate_complete",
      },
      "Embedding Regenerate: Batch regeneration complete",
    );

    return successResponse({
      processed: results.processed,
      success: results.success,
      failed: results.failed,
      skipped: results.skipped,
      newVersion: currentVersion,
      errors:
        results.errors.length > 0 ? results.errors.slice(0, 10) : undefined,
      message:
        results.failed === 0
          ? `成功为 ${results.success} 条书签重新生成向量`
          : `处理完成：${results.success} 成功，${results.failed} 失败，${results.skipped} 跳过`,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "embedding_regenerate",
      },
      "POST /api/bookmarks/embeddings/regenerate error",
    );
    return internalError("批量重新生成向量失败");
  }
}

/**
 * GET /api/bookmarks/embeddings/regenerate
 * 获取需要重新生成的书签统计
 */
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 查询所有有向量的书签的版本分布
    const { data: bookmarks, error: queryError } = await supabase
      .from("bookmarks")
      .select("id, embedding_version")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .not("embedding", "is", null);

    if (queryError) {
      return databaseError("查询书签失败", queryError);
    }

    const currentVersion = getCurrentEmbeddingVersion();
    const total = bookmarks?.length || 0;

    // 统计版本分布
    const versionCounts: Record<string, number> = {};
    let needsRegenerate = 0;

    for (const bookmark of bookmarks || []) {
      const version = bookmark.embedding_version || "unknown";
      versionCounts[version] = (versionCounts[version] || 0) + 1;

      if (version !== String(currentVersion)) {
        needsRegenerate++;
      }
    }

    return successResponse({
      total,
      needsRegenerate,
      alreadyCurrent: total - needsRegenerate,
      currentVersion,
      versionDistribution: versionCounts,
      message:
        needsRegenerate > 0
          ? `有 ${needsRegenerate} 条书签需要重新生成向量（当前版本: ${currentVersion}）`
          : "所有书签向量已是最新版本",
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        operation: "get_regenerate_stats",
      },
      "GET /api/bookmarks/embeddings/regenerate error",
    );
    return internalError("获取统计失败");
  }
}
