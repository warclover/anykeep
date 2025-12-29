/**
 * Classification API v1
 *
 * POST /api/v1/classification - 执行智能分类
 *
 * @module api/v1/classification
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ClassificationContainer } from "@/lib/classification";
import {
  createTrustModeClassificationService,
  type EnhancedClassificationResult,
} from "@/lib/classification/services/trust-mode-classification.service";
import { logger } from "@/lib/logger";
import {
  classificationMetricsService,
  type MatchType,
} from "@/lib/classification/services/classification-metrics.service";
import { withAuthMiddleware } from "@/lib/api/middleware";

/**
 * 请求体验证 Schema
 */
const ClassifySchema = z.object({
  title: z.string().min(1, "标题不能为空").max(500),
  summary: z.string().max(1000).optional().default(""),
  tags: z.array(z.string()).max(20).optional().default([]),
  embedding: z.array(z.number()).optional(),
  url: z.string().url().optional(),
});

/**
 * POST /api/v1/classification
 * 对书签进行智能分类
 */
export const POST = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const supabase = await createClient();

    // 解析并验证请求体
    const body = await request.json();
    const validation = ClassifySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "请求参数验证失败",
            details: validation.error.flatten().fieldErrors,
          },
        },
        { status: 400 },
      );
    }

    const { title, summary, tags, embedding, url } = validation.data;

    // 初始化分类容器并获取服务
    const container = ClassificationContainer.initialize(supabase);
    const baseClassificationService = container.getClassificationService();

    // 创建托管模式感知的分类服务（包装器模式）
    const trustModeClassificationService = createTrustModeClassificationService(
      baseClassificationService,
    );

    // 执行托管模式感知的分类
    const result = url
      ? await trustModeClassificationService.classify(userId, {
          title,
          summary: summary || "",
          tags,
          embedding,
          url,
        })
      : await baseClassificationService.classify(userId, {
          title,
          summary,
          tags,
          embedding,
          url,
        });

    logger.info(
      {
        userId,
        title: title.substring(0, 50),
        result: {
          folderId: result.folderId,
          folderName: result.folderName,
          confidence: result.confidence,
          action: result.action,
          routePath: "routePath" in result ? result.routePath : undefined,
          trustModeDecision:
            "trustModeDecision" in result
              ? result.trustModeDecision
              : undefined,
        },
      },
      "[v1] Classification completed",
    );

    // 异步记录分类指标（非阻塞）
    void classificationMetricsService
      .recordMetrics({
        userId,
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

    // 返回分类结果
    const isEnhancedResult = "routePath" in result;
    const enhancedResult = result as EnhancedClassificationResult;

    return NextResponse.json({
      success: true,
      data: {
        folderId: result.folderId,
        folderName: result.folderName,
        confidence: result.confidence,
        action: result.action,
        reason: result.reason,
        scores: result.scores,
        // 托管模式增强字段
        ...(isEnhancedResult && {
          routePath: enhancedResult.routePath,
          trustModeDecision: enhancedResult.trustModeDecision,
          processingTimeMs: enhancedResult.processingTimeMs,
          calibration: enhancedResult.calibration,
        }),
      },
    });
  },
);
