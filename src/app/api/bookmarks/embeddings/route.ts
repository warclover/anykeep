/**
 * 向量嵌入 API 路由
 * POST /api/bookmarks/embeddings - 批量生成向量嵌入
 * GET /api/bookmarks/embeddings/stats - 获取向量覆盖统计
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
} from "@/lib/utils/embedding-generator";
import { logger } from "@/lib/logger";

// 批量处理配置
const BATCH_SIZE = 10; // 每批处理数量
const DELAY_BETWEEN_BATCHES = 500; // 批次间延迟(ms)

/**
 * POST /api/bookmarks/embeddings
 * 为指定书签批量生成向量嵌入
 *
 * Body:
 * - bookmarkIds?: number[] - 指定书签ID列表（可选，不传则处理所有无向量的书签）
 * - limit?: number - 处理数量限制（默认50，最大100）
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
    let limit = 50;

    try {
      const body = await request.json();
      bookmarkIds = body.bookmarkIds;
      limit = Math.min(body.limit || 50, 100); // 最大100条
    } catch {
      // 空body，使用默认值
    }

    // 3. 查询需要生成向量的书签
    let query = supabase
      .from("bookmarks")
      .select("id, title, ai_summary, ai_tags")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .is("embedding", null) // 只处理没有向量的
      .order("created_at", { ascending: false });

    if (bookmarkIds && bookmarkIds.length > 0) {
      query = query.in("id", bookmarkIds);
    }

    query = query.limit(limit);

    const { data: bookmarks, error: queryError } = await query;

    if (queryError) {
      return databaseError("查询书签失败", queryError);
    }

    if (!bookmarks || bookmarks.length === 0) {
      return successResponse({
        processed: 0,
        success: 0,
        failed: 0,
        message: "没有需要处理的书签",
      });
    }

    logger.info(
      {
        userId: user.id,
        count: bookmarks.length,
        action: "embedding_batch_start",
      },
      "Embedding: Starting batch generation",
    );

    // 4. 批量生成向量
    const results = {
      processed: 0,
      success: 0,
      failed: 0,
      errors: [] as { id: number; error: string }[],
    };

    // 分批处理
    for (let i = 0; i < bookmarks.length; i += BATCH_SIZE) {
      const batch = bookmarks.slice(i, i + BATCH_SIZE);

      // 并行处理当前批次
      const batchPromises = batch.map(async (bookmark) => {
        try {
          // 构建向量文本
          const text = buildEmbeddingText(
            bookmark.title,
            bookmark.ai_summary,
            bookmark.ai_tags,
          );

          if (!text || text.trim().length < 5) {
            throw new Error("文本内容不足");
          }

          // 生成向量
          const embedding = await generateEmbedding(text);

          if (!isValidEmbedding(embedding)) {
            throw new Error("生成的向量无效");
          }

          // 更新数据库（pgvector 接受 number[] 格式，TypeScript 类型为 string）
          const { error: updateError } = await supabase
            .from("bookmarks")
            .update({ embedding: embedding as unknown as string })
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
              action: "embedding_single_failed",
            },
            "Embedding: Single bookmark failed",
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
    }

    logger.info(
      {
        userId: user.id,
        processed: results.processed,
        success: results.success,
        failed: results.failed,
        action: "embedding_batch_complete",
      },
      "Embedding: Batch generation complete",
    );

    return successResponse({
      processed: results.processed,
      success: results.success,
      failed: results.failed,
      errors: results.errors.length > 0 ? results.errors : undefined,
      message:
        results.failed === 0
          ? `成功为 ${results.success} 条书签生成向量`
          : `处理完成：${results.success} 成功，${results.failed} 失败`,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "batch_embedding",
      },
      "POST /api/bookmarks/embeddings error",
    );
    return internalError("批量生成向量失败");
  }
}

/**
 * GET /api/bookmarks/embeddings
 * 获取当前用户的向量覆盖统计
 */
export async function GET(_request: NextRequest) {
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

    // 2. 查询统计数据
    const { data: stats, error: statsError } = await supabase
      .from("bookmarks")
      .select("id, embedding")
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (statsError) {
      return databaseError("查询统计失败", statsError);
    }

    const total = stats?.length || 0;
    const withEmbedding =
      stats?.filter((b) => b.embedding !== null).length || 0;
    const withoutEmbedding = total - withEmbedding;
    const coveragePercent =
      total > 0 ? Math.round((withEmbedding / total) * 100 * 100) / 100 : 0;

    return successResponse({
      total,
      withEmbedding,
      withoutEmbedding,
      coveragePercent,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        operation: "get_embedding_stats",
      },
      "GET /api/bookmarks/embeddings error",
    );
    return internalError("获取统计失败");
  }
}
