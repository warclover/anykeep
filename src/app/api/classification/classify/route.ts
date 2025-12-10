/**
 * 智能分类 API
 * POST /api/classification/classify - 对书签进行智能分类
 *
 * V4.1+ 增强：集成分类指标记录
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ClassificationContainer } from "@/lib/classification";
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import {
  classificationMetricsService,
  type MatchType,
} from "@/lib/classification/services/classification-metrics.service";

/**
 * 请求体验证 Schema
 */
const classifySchema = z.object({
  title: z.string().min(1, "标题不能为空").max(500),
  summary: z.string().max(1000).optional().default(""),
  tags: z.array(z.string()).max(20).optional().default([]),
  embedding: z.array(z.number()).optional(),
  url: z.string().url().optional(),
});

/**
 * POST /api/classification/classify
 * 对书签进行智能分类
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
      return unauthorizedError("请先登录");
    }

    // 2. 解析并验证请求体
    const body = await request.json();
    const validation = classifySchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { title, summary, tags, embedding, url } = validation.data;

    // 3. 初始化分类容器并获取服务
    const container = ClassificationContainer.initialize(supabase);
    const classificationService = container.getClassificationService();

    // 4. 执行分类
    const result = await classificationService.classify(user.id, {
      title,
      summary,
      tags,
      embedding,
      url,
    });

    logger.info(
      {
        userId: user.id,
        title: title.substring(0, 50),
        result: {
          folderId: result.folderId,
          folderName: result.folderName,
          confidence: result.confidence,
          action: result.action,
        },
      },
      "Classification completed",
    );

    // 5. 异步记录分类指标（非阻塞）
    void classificationMetricsService
      .recordMetrics({
        userId: user.id,
        bookmarkUrl: url,
        action: result.action,
        folderId: result.folderId,
        folderName: result.folderName,
        confidence: result.confidence,
        tier: result.matchType === "ai_select" || result.matchType === "ai_create" ? 2 : 1,
        cacheHit: false,
        aiCalled: result.matchType === "ai_select" || result.matchType === "ai_create",
        matchType: result.matchType as MatchType | undefined,
        vectorScore: result.candidates?.[0]?.score,
        executionTimeMs: result.executionTime || 0,
        decisionReason: result.reason,
      })
      .catch((err) => {
        logger.warn(
          { error: err instanceof Error ? err.message : String(err) },
          "Failed to record classification metrics (non-blocking)"
        );
      });

    // 6. 返回分类结果
    return successResponse({
      folderId: result.folderId,
      folderName: result.folderName,
      confidence: result.confidence,
      action: result.action,
      reason: result.reason,
      scores: result.scores,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "POST /api/classification/classify error",
    );
    return internalError("分类失败");
  }
}
