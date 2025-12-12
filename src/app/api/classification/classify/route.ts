/**
 * 智能分类 API
 * POST /api/classification/classify - 对书签进行智能分类
 *
 * V4.2+ 增强：集成托管模式感知分类
 * - 快慢路径路由
 * - 托管模式决策
 * - 来源画像更新
 * - 置信度校准
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ClassificationContainer } from "@/lib/classification";
import {
  createTrustModeClassificationService,
  type EnhancedClassificationResult,
} from "@/lib/classification/services/trust-mode-classification.service";
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
    const baseClassificationService = container.getClassificationService();

    // 4. 创建托管模式感知的分类服务（包装器模式）
    const trustModeClassificationService = createTrustModeClassificationService(
      baseClassificationService,
    );

    // 5. 执行托管模式感知的分类
    // 如果没有 URL，回退到基础分类服务
    const result = url
      ? await trustModeClassificationService.classify(user.id, {
          title,
          summary: summary || "",
          tags,
          embedding,
          url,
        })
      : await baseClassificationService.classify(user.id, {
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
          // V4.2: 托管模式相关信息
          routePath: "routePath" in result ? result.routePath : undefined,
          trustModeDecision:
            "trustModeDecision" in result
              ? result.trustModeDecision
              : undefined,
        },
      },
      "Classification completed (Trust Mode aware)",
    );

    // 6. 异步记录分类指标（非阻塞）
    void classificationMetricsService
      .recordMetrics({
        userId: user.id,
        bookmarkUrl: url,
        action: result.action,
        folderId: result.folderId,
        folderName: result.folderName,
        confidence: result.confidence,
        tier:
          result.matchType === "ai_select" || result.matchType === "ai_create"
            ? 2
            : 1,
        cacheHit: false,
        aiCalled:
          result.matchType === "ai_select" || result.matchType === "ai_create",
        matchType: result.matchType as MatchType | undefined,
        vectorScore: result.candidates?.[0]?.score as number | undefined,
        executionTimeMs:
          "processingTimeMs" in result
            ? (result as EnhancedClassificationResult).processingTimeMs
            : result.executionTime || 0,
        decisionReason: result.reason,
      })
      .catch((err) => {
        logger.warn(
          { error: err instanceof Error ? err.message : String(err) },
          "Failed to record classification metrics (non-blocking)",
        );
      });

    // 7. 返回分类结果（包含托管模式决策信息）
    const isEnhancedResult = "routePath" in result;
    const enhancedResult = result as EnhancedClassificationResult;

    return successResponse({
      folderId: result.folderId,
      folderName: result.folderName,
      confidence: result.confidence,
      action: result.action,
      reason: result.reason,
      scores: result.scores,
      // V4.2: 托管模式增强字段（仅当使用托管模式服务时返回）
      ...(isEnhancedResult && {
        routePath: enhancedResult.routePath,
        trustModeDecision: enhancedResult.trustModeDecision,
        processingTimeMs: enhancedResult.processingTimeMs,
        calibration: enhancedResult.calibration,
      }),
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
