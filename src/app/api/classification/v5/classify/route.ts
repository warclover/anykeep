/**
 * 智能分类 v5.0 - 单个书签分类 API
 *
 * POST /api/classification/v5/classify
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
 * 分类请求体
 */
interface ClassifyRequestBody {
  bookmarkId: string;
  title: string;
  description?: string;
  summary?: string;
  tags?: string[];
  url: string;
}

/**
 * POST /api/classification/v5/classify
 * 对单个书签进行智能分类
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
    const body: ClassifyRequestBody = await request.json();

    // 3. 验证必需字段
    if (!body.bookmarkId || !body.title || !body.url) {
      logger.warn("缺少必需字段", { body });
      return NextResponse.json(
        { error: "缺少必需字段: bookmarkId, title, url" },
        { status: 400 },
      );
    }

    // 4. 构建分类请求
    const classificationRequest: ClassificationRequest = {
      userId: user.id,
      bookmarkId: body.bookmarkId,
      title: body.title,
      description: body.description,
      summary: body.summary,
      tags: body.tags,
      url: body.url,
    };

    logger.info("开始分类", {
      userId: user.id,
      bookmarkId: body.bookmarkId,
      title: body.title,
    });

    // 5. 初始化服务
    const embeddingService = new EmbeddingService(logger, {});
    const vectorSearch = new VectorSearchService(logger, {});
    const llmService = new LLMService(logger);

    const pipeline = new ClassificationPipelineService(
      logger,
      embeddingService,
      vectorSearch,
      llmService,
    );

    // 6. 执行分类
    const result = await pipeline.classify(classificationRequest);

    logger.info("分类完成", {
      userId: user.id,
      bookmarkId: body.bookmarkId,
      folderId: result.folderId,
      confidence: result.confidence,
      usedT1: result.usedT1,
      totalLatencyMs: result.totalLatencyMs,
    });

    // 7. 返回结果
    return NextResponse.json({
      success: true,
      data: {
        folderId: result.folderId,
        confidence: result.confidence,
        usedT1: result.usedT1,
        reasoning: result.reasoning,
        latency: {
          total: result.totalLatencyMs,
          t0: result.t0LatencyMs,
          t1: result.t1LatencyMs,
        },
      },
    });
  } catch (error) {
    logger.error("分类失败", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: "分类失败",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
