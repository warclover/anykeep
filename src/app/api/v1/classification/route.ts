/**
 * Classification API v1 — v2 引擎
 *
 * POST /api/v1/classification - 执行智能分类
 *
 * @module api/v1/classification
 * @version 2.0.0 (Phase 8: 切换到 classification-v2)
 * @updated 2026-03-10
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { classify } from "@/lib/classification-v2";
import { logger } from "@/lib/logger";
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
  /** 书签 ID（可选，用于缓存） */
  bookmarkId: z.union([z.string(), z.number()]).optional(),
});

/**
 * POST /api/v1/classification
 * 对书签进行智能分类 (v2 引擎)
 */
export const POST = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
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

    const { title, summary, tags, url, bookmarkId } = validation.data;

    // 调用 v2 classify
    const result = await classify({
      bookmarkId: String(bookmarkId ?? `temp-${Date.now()}`),
      title,
      summary: summary || undefined,
      tags,
      url,
      userId,
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
        },
        totalMs: result.timing.totalMs,
      },
      "[v1] Classification completed (v2 engine)",
    );

    // 返回分类结果（保持 v1 响应格式兼容）
    return NextResponse.json({
      success: true,
      data: {
        folderId: result.folderId,
        folderName: result.folderName,
        confidence: result.confidence,
        action: result.action,
        reason: result.reason,
        scores: result.candidates?.map((c) => ({
          folderId: c.folderId,
          folderName: c.folderName,
          score: c.mergedScore,
          breakdown: c.scorerBreakdown,
        })),
        suggestedFolderName: result.suggestedFolderName,
        processingTimeMs: result.timing.totalMs,
        traceId: result.traceId,
      },
    });
  },
);
