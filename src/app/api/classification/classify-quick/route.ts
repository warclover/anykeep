/**
 * V4.0 快速分类 API
 * POST /api/classification/classify-quick
 *
 * 乐观 UI 第一阶段：仅运行 Tier 0 (缓存) + Tier 1 (快速匹配)
 * 立即返回结果，不调用 AI，用于即时反馈
 *
 * 返回值包含 needsDeepValidation 标志，前端据此决定是否调用深度验证
 */

import { type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ClassificationContainer } from "@/lib/classification";
import { TieredClassificationService } from "@/lib/classification/v3/services/tiered-classification.service";
import { WeightedScoreAggregator } from "@/lib/classification/strategies";
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import {
  generateEmbedding,
  buildEmbeddingText,
} from "@/lib/utils/embedding-generator";

/**
 * 请求体验证 Schema
 */
const classifyQuickSchema = z.object({
  title: z.string().min(1, "标题不能为空").max(500),
  summary: z.string().max(1000).optional().default(""),
  tags: z.array(z.string()).max(20).optional().default([]),
  url: z.string().url().optional(),
  embedding: z.array(z.number()).optional(),
  // 可选：书签 ID（用于排除自匹配）
  bookmarkId: z.number().optional(),
});

/**
 * POST /api/classification/classify-quick
 * 快速分类（乐观 UI 第一阶段）
 */
export async function POST(request: NextRequest) {
  const startTime = performance.now();

  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // 2. 解析并验证请求体
    const body = await request.json();
    const validation = classifyQuickSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { title, summary, tags, url, embedding, bookmarkId } =
      validation.data;

    // 3. 生成 embedding（如果未提供）
    let finalEmbedding = embedding;
    if (!finalEmbedding || finalEmbedding.length === 0) {
      try {
        const text = buildEmbeddingText(title, summary, tags);
        finalEmbedding = await generateEmbedding(text);
      } catch (error) {
        logger.warn(
          {
            error: error instanceof Error ? error.message : String(error),
          },
          "Quick classification: Embedding generation failed",
        );
        finalEmbedding = [];
      }
    }

    // 4. 初始化分层分类服务
    const container = ClassificationContainer.initialize(supabase);
    const matchers = container.getV3Matchers();
    const aggregator = new WeightedScoreAggregator();

    const tieredService = new TieredClassificationService(
      supabase,
      matchers,
      aggregator,
      {
        // 快速分类配置：优化速度
        matcherTimeoutMs: 300, // 更短的超时
        correctionCacheEnabled: true,
        tracingEnabled: true,
      },
    );

    // 5. 准备上下文
    const context = {
      userId: user.id,
      bookmarkId: bookmarkId ?? -1,
      title,
      summary: summary || "",
      tags: tags || [],
      embedding: finalEmbedding || [],
      url,
    };

    // 6. 执行快速分类
    const quickResult = await tieredService.classifyQuick(
      user.id,
      {
        id: bookmarkId ?? -1,
        title,
        summary,
        tags,
        url,
        embedding: finalEmbedding,
      },
      context,
    );

    const totalMs = Math.round(performance.now() - startTime);

    logger.info(
      {
        userId: user.id,
        title: title.substring(0, 50),
        traceId: quickResult.traceId,
        tier: quickResult.tier,
        confidence: quickResult.result.confidence,
        needsDeep: quickResult.needsDeepValidation,
        totalMs,
      },
      `Quick classification completed in ${totalMs}ms`,
    );

    // 7. 返回结果
    return successResponse({
      // 分类结果
      folderId: quickResult.result.folderId,
      folderName: quickResult.result.folderName,
      confidence: quickResult.result.confidence,
      action: quickResult.result.action,
      reason: quickResult.result.reason,
      scores: quickResult.result.scores,

      // 乐观 UI 元数据
      needsDeepValidation: quickResult.needsDeepValidation,
      traceId: quickResult.traceId,
      tier: quickResult.tier,

      // V4.0 决策理由透传
      decisionReason: quickResult.decisionReason,

      // 性能指标
      timings: {
        ...quickResult.timings,
        totalMs,
      },
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "POST /api/classification/classify-quick error",
    );
    return internalError("快速分类失败");
  }
}
