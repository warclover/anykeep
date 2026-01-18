/**
 * 智能分类 v5.0 - 批量书签分类 API
 *
 * POST /api/classification/v5/classify-batch
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ClassificationPipelineService } from "@/lib/classification/v5/classification-pipeline";
import { EmbeddingService } from "@/lib/classification/v5/shared/embedding";
import { VectorSearchService } from "@/lib/classification/v5/shared/vector-search";
import { LLMService } from "@/lib/classification/v5/shared/llm";
import type { ClassificationRequest } from "@/lib/classification/v5/classification-pipeline/types";

/**
 * 批量分类请求体
 */
interface ClassifyBatchRequestBody {
  bookmarks: Array<{
    bookmarkId: string;
    title: string;
    description?: string;
    summary?: string;
    tags?: string[];
    url: string;
  }>;
}

/**
 * POST /api/classification/v5/classify-batch
 * 批量对书签进行智能分类
 */
export async function POST(request: NextRequest) {
  const logger = console; // TODO: 使用实际 LoggerService

  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.warn("未授权访问", { error: authError?.message });
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    // 2. 解析请求体
    const body: ClassifyBatchRequestBody = await request.json();

    // 3. 验证请求
    if (!body.bookmarks || !Array.isArray(body.bookmarks)) {
      logger.warn("无效的请求体", { body });
      return NextResponse.json(
        { error: "bookmarks 必须是数组" },
        { status: 400 },
      );
    }

    if (body.bookmarks.length === 0) {
      logger.warn("空的书签列表");
      return NextResponse.json({ error: "书签列表不能为空" }, { status: 400 });
    }

    if (body.bookmarks.length > 100) {
      logger.warn("书签数量超过限制", { count: body.bookmarks.length });
      return NextResponse.json(
        { error: "单次最多处理 100 个书签" },
        { status: 400 },
      );
    }

    // 4. 验证每个书签的必需字段
    for (let i = 0; i < body.bookmarks.length; i++) {
      const bookmark = body.bookmarks[i];
      if (!bookmark.bookmarkId || !bookmark.title || !bookmark.url) {
        logger.warn("书签缺少必需字段", { index: i, bookmark });
        return NextResponse.json(
          {
            error: `书签 ${i} 缺少必需字段: bookmarkId, title, url`,
          },
          { status: 400 },
        );
      }
    }

    logger.info("开始批量分类", {
      userId: user.id,
      count: body.bookmarks.length,
    });

    // 5. 构建分类请求列表
    const classificationRequests: ClassificationRequest[] = body.bookmarks.map(
      (bookmark) => ({
        userId: user.id,
        bookmarkId: bookmark.bookmarkId,
        title: bookmark.title,
        description: bookmark.description,
        summary: bookmark.summary,
        tags: bookmark.tags,
        url: bookmark.url,
      }),
    );

    // 6. 初始化服务
    const embeddingService = new EmbeddingService(logger, {});
    const vectorSearch = new VectorSearchService(logger, {});
    const llmService = new LLMService(logger);

    const pipeline = new ClassificationPipelineService(
      logger,
      embeddingService,
      vectorSearch,
      llmService,
    );

    // 7. 执行批量分类
    const startTime = Date.now();
    const results = await pipeline.classifyBatch(classificationRequests);
    const totalTime = Date.now() - startTime;

    logger.info("批量分类完成", {
      userId: user.id,
      count: results.length,
      totalTimeMs: totalTime,
      avgTimeMs: totalTime / results.length,
    });

    // 8. 返回结果
    return NextResponse.json({
      success: true,
      data: {
        results: results.map((result) => ({
          bookmarkId: classificationRequests.find(
            (req) => req.bookmarkId === result.folderId,
          )?.bookmarkId,
          folderId: result.folderId,
          confidence: result.confidence,
          usedT1: result.usedT1,
          reasoning: result.reasoning,
          latency: {
            total: result.totalLatencyMs,
            t0: result.t0LatencyMs,
            t1: result.t1LatencyMs,
          },
        })),
        summary: {
          total: results.length,
          totalTimeMs: totalTime,
          avgTimeMs: Math.round(totalTime / results.length),
          usedT1Count: results.filter((r) => r.usedT1).length,
        },
      },
    });
  } catch (error) {
    logger.error("批量分类失败", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: "批量分类失败",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
