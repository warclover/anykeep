/**
 * 智能分类 v2 - 批量分类入口
 *
 * POST /api/classification/v2/batch
 *
 * 合并原有端点：
 * - /api/classification/v5/classify-batch
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
 * 单个书签验证 Schema
 */
const bookmarkItemSchema = z.object({
  bookmarkId: z.union([z.string(), z.number()]).transform(String),
  title: z.string().min(1, "标题不能为空").max(500),
  url: z.string().url().optional(),
  description: z.string().max(2000).optional(),
  summary: z.string().max(1000).optional(),
  tags: z.array(z.string()).max(20).optional().default([]),
});

/**
 * 批量请求验证 Schema
 */
const batchSchema = z.object({
  bookmarks: z
    .array(bookmarkItemSchema)
    .min(1, "书签列表不能为空")
    .max(100, "单次最多处理 100 个书签"),
});

/**
 * POST /api/classification/v2/batch
 * 批量分类入口
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  const startTime = Date.now();

  // 2. 解析并验证请求体
  const body = await request.json();
  const validation = batchSchema.safeParse(body);

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

  const { bookmarks } = validation.data;

  logger.info(
    {
      userId,
      count: bookmarks.length,
    },
    "Classification v2 batch: Starting",
  );

  // 3. 构建分类请求列表
  const classificationRequests = bookmarks.map((bookmark) => ({
    userId,
    bookmarkId: bookmark.bookmarkId,
    title: bookmark.title,
    url: bookmark.url ?? "",
    description: bookmark.description,
    summary: bookmark.summary,
    tags: bookmark.tags,
  }));

  // 4. 获取分类门面并执行批量分类
  const facade = getClassificationFacade();
  const results = await facade.classifyBatch(classificationRequests);

  const latencyMs = Date.now() - startTime;

  // 5. 构建结果映射（保持请求顺序）
  const resultMap = new Map(
    results.map((result, index) => [
      classificationRequests[index].bookmarkId,
      result,
    ]),
  );

  const orderedResults = bookmarks.map((bookmark) => {
    const result = resultMap.get(bookmark.bookmarkId);
    return {
      bookmarkId: bookmark.bookmarkId,
      folderId: result?.folderId ?? null,
      folderName: result?.folderName ?? null,
      confidence: result?.confidence ?? 0,
      action: result?.action ?? "inbox",
      reason: result?.reason,
    };
  });

  // 6. 统计信息
  const summary = {
    total: orderedResults.length,
    classified: orderedResults.filter((r) => r.action === "classify").length,
    suggested: orderedResults.filter((r) => r.action === "suggest").length,
    inbox: orderedResults.filter((r) => r.action === "inbox").length,
    avgConfidence:
      orderedResults.reduce((sum, r) => sum + r.confidence, 0) /
      orderedResults.length,
    latencyMs,
    avgLatencyMs: Math.round(latencyMs / orderedResults.length),
  };

  logger.info(
    {
      userId,
      ...summary,
    },
    "Classification v2 batch: Completed",
  );

  // 7. 返回统一格式的结果
  return NextResponse.json({
    success: true,
    data: {
      results: orderedResults,
      summary,
    },
  });
});
