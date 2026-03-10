/**
 * 智能分类 v2 - 统一分类入口
 *
 * POST /api/classification/v2/classify
 *
 * 合并原有端点：
 * - /api/classification/classify
 * - /api/classification/v2/classify（原 v5/classify）
 *
 * @version 3.0.0
 * @since 2026-01-24 Phase 3
 * @updated 2026-03-09 Phase 5: 直接调用 classification-v2
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { classify } from "@/lib/classification-v2";
import { logger } from "@/lib/logger";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { safeParseBody } from "@/lib/utils/api-response";

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

  // 模式控制（保留兼容性，新系统 CascadeRanker 天然支持快速返回）
  optimistic: z.boolean().optional().default(false),
  quick: z.boolean().optional().default(false),
});

/**
 * POST /api/classification/v2/classify
 * 统一分类入口
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  const startTime = Date.now();

  // 2. 安全解析并验证请求体
  const { data: body, error: parseError } = await safeParseBody(request);
  if (parseError) return parseError;
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

  const { bookmarkId, title, url, summary, tags } = validation.data;

  // 3. 直接调用 classification-v2 新系统
  const result = await classify({
    bookmarkId,
    title,
    url: url ?? undefined,
    summary,
    tags,
    userId,
  });

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
      // 延迟信息
      latency: {
        total: latencyMs,
        ...result.timing.tierMs,
      },
      // Tier 信息
      earlyExitTier: result.timing.earlyExitTier,
    },
  });
});
