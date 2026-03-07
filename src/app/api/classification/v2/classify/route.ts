/**
 * 智能分类 v2 - 统一分类入口
 *
 * POST /api/classification/v2/classify
 *
 * 合并原有端点：
 * - /api/classification/classify
 * - /api/classification/v5/classify
 *
 * @version 2.0.0
 * @since 2026-01-24 Phase 3
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getClassificationFacade } from "@/lib/classification/facade";
import { logger } from "@/lib/logger";
import { withAuthMiddleware } from "@/lib/api/middleware";

/**
 * 请求体验证 Schema
 */
const classifySchema = z.object({
  // 必需字段
  bookmarkId: z.union([z.string(), z.number()]).transform(String),
  title: z.string().min(1, "标题不能为空").max(500),
  url: z.string().url().optional(),

  // 可选字段
  description: z.string().max(2000).optional(),
  summary: z.string().max(1000).optional(),
  tags: z.array(z.string()).max(20).optional().default([]),
  content: z.string().max(10000).optional(),

  // 模式控制
  optimistic: z.boolean().optional().default(false),
  quick: z.boolean().optional().default(false),
});

/**
 * POST /api/classification/v2/classify
 * 统一分类入口
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  const startTime = Date.now();

  // 2. 解析并验证请求体
  const body = await request.json();
  const validation = classifySchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      {
        success: false,
        error: "请求参数无效",
        details: validation.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const {
    bookmarkId,
    title,
    url,
    description,
    summary,
    tags,
    optimistic,
    quick,
  } = validation.data;

  // 3. 获取分类门面并执行分类
  const facade = getClassificationFacade();

  const classificationRequest = {
    userId,
    bookmarkId,
    title,
    url: url ?? "",
    description,
    summary,
    tags,
  };

  let result;

  if (quick || optimistic) {
    // 快速模式：仅 T0，用于 Optimistic UI
    result = await facade.classifyQuick(classificationRequest);
  } else {
    // 标准模式：完整 L0→T0→T1 流程
    result = await facade.classify(classificationRequest);
  }

  const latencyMs = Date.now() - startTime;

  logger.info(
    {
      userId,
      bookmarkId,
      title: title.substring(0, 50),
      folderId: result.folderId,
      confidence: result.confidence,
      action: result.action,
      latencyMs,
      mode: quick || optimistic ? "quick" : "standard",
    },
    "Classification v2 completed",
  );

  // 4. 返回统一格式的结果
  return NextResponse.json({
    success: true,
    data: {
      folderId: result.folderId,
      folderName: result.folderName,
      confidence: result.confidence,
      action: result.action,
      reason: result.reason,
      suggestionId: result.suggestionId,
      // 延迟信息
      latency: {
        total: latencyMs,
      },
      // T1 相关（如果有）
      usedT1: result.usedT1,
    },
  });
});
