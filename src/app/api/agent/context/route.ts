/**
 * AI 上下文管理 API
 *
 * POST /api/agent/context - 解析上下文引用
 * GET /api/agent/context - 验证上下文引用
 * DELETE /api/agent/context - 清除上下文缓存
 *
 * 功能：
 * - 解析书签、文件夹、标签等上下文引用
 * - 生成上下文摘要供 AI 使用
 * - 验证上下文引用有效性
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { contextManager } from "@/lib/ai-skills/services";
import { logger } from "@/lib/logger";
import { withAuthMiddleware } from "@/lib/api/middleware";

// =============================================================================
// 请求验证 Schema
// =============================================================================

/**
 * 上下文引用 Schema
 */
const contextReferencesSchema = z.object({
  /** 书签 ID 列表 */
  bookmarkIds: z.array(z.number().int().positive()).max(100).optional(),
  /** 文件夹 ID 列表 */
  folderIds: z.array(z.number().int().positive()).max(10).optional(),
  /** 标签名称列表 */
  tagNames: z.array(z.string().max(50)).max(20).optional(),
  /** 前次输出 ID（会话 ID 或消息 ID） */
  previousOutputId: z.string().optional(),
  /** 搜索查询 */
  searchQuery: z.string().max(200).optional(),
});

/**
 * 解析上下文请求 Schema
 */
const resolveContextRequestSchema = z.object({
  /** 上下文引用 */
  references: contextReferencesSchema,
  /** 是否生成 AI 用的文本 */
  generateText: z.boolean().default(false),
  /** 是否生成摘要 */
  generateSummary: z.boolean().default(true),
});

// =============================================================================
// POST /api/agent/context
// 解析上下文引用
// =============================================================================

export const POST = withAuthMiddleware(async (request, { userId }) => {
  // 1. 解析并验证请求体
  const body = await request.json();
  const validation = resolveContextRequestSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      {
        success: false,
        error: "请求参数无效",
        details: validation.error.issues,
      },
      { status: 400 },
    );
  }

  const { references, generateText, generateSummary } = validation.data;

  logger.info(
    {
      userId: userId.slice(0, 8) + "...",
      bookmarkCount: references.bookmarkIds?.length || 0,
      folderCount: references.folderIds?.length || 0,
      tagCount: references.tagNames?.length || 0,
      hasSearch: !!references.searchQuery,
      hasPrevious: !!references.previousOutputId,
    },
    "Agent Context: Resolve request received",
  );

  // 2. 解析上下文
  const result = await contextManager.resolveContext(references);

  if (!result.success || !result.data) {
    return NextResponse.json(
      { success: false, error: result.error || "解析上下文失败" },
      { status: 400 },
    );
  }

  // 3. 构建响应
  const response: {
    success: boolean;
    data: {
      items: typeof result.data.items;
      bookmarkCount: number;
      folderCount: number;
      tagCount: number;
      hasSearchResults: boolean;
      hasPreviousOutput: boolean;
      summary?: ReturnType<typeof contextManager.generateSummary>;
      contextText?: string;
    };
  } = {
    success: true,
    data: {
      items: result.data.items,
      bookmarkCount: result.data.bookmarks.length,
      folderCount: result.data.folders.length,
      tagCount: result.data.tags.length,
      hasSearchResults: !!result.data.searchResults,
      hasPreviousOutput: !!result.data.previousOutput,
    },
  };

  // 4. 生成摘要（可选）
  if (generateSummary) {
    response.data.summary = contextManager.generateSummary(result.data);
  }

  // 5. 生成 AI 用文本（可选）
  if (generateText) {
    response.data.contextText = contextManager.generateContextText(result.data);
  }

  logger.info(
    {
      userId: userId.slice(0, 8) + "...",
      itemCount: result.data.items.length,
      hasText: generateText,
      hasSummary: generateSummary,
    },
    "Agent Context: Context resolved",
  );

  return NextResponse.json(response);
});

// =============================================================================
// GET /api/agent/context
// 验证上下文引用
// =============================================================================

export const GET = withAuthMiddleware(async (request, { userId }) => {
  // 1. 解析查询参数
  const searchParams = request.nextUrl.searchParams;

  const bookmarkIdsParam = searchParams.get("bookmarkIds");
  const folderIdsParam = searchParams.get("folderIds");
  const tagNamesParam = searchParams.get("tagNames");

  const references = {
    bookmarkIds: bookmarkIdsParam
      ? bookmarkIdsParam
          .split(",")
          .map((id) => parseInt(id, 10))
          .filter((id) => !isNaN(id))
      : undefined,
    folderIds: folderIdsParam
      ? folderIdsParam
          .split(",")
          .map((id) => parseInt(id, 10))
          .filter((id) => !isNaN(id))
      : undefined,
    tagNames: tagNamesParam
      ? tagNamesParam.split(",").filter(Boolean)
      : undefined,
    previousOutputId: searchParams.get("previousOutputId") || undefined,
    searchQuery: searchParams.get("searchQuery") || undefined,
  };

  // 2. 验证引用
  const validation = contextReferencesSchema.safeParse(references);

  if (!validation.success) {
    return NextResponse.json(
      {
        success: false,
        error: "请求参数无效",
        details: validation.error.issues,
      },
      { status: 400 },
    );
  }

  // 3. 检查引用有效性
  const result = await contextManager.validateReferences(validation.data);

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 400 },
    );
  }

  logger.info(
    {
      userId: userId.slice(0, 8) + "...",
      valid: result.data?.valid,
      errorCount: result.data?.errors.length || 0,
    },
    "Agent Context: Validation complete",
  );

  return NextResponse.json({
    success: true,
    data: result.data,
  });
});

// =============================================================================
// DELETE /api/agent/context
// 清除上下文缓存（预留接口）
// =============================================================================

export const DELETE = withAuthMiddleware(async (request, { userId }) => {
  // 1. 解析查询参数
  const searchParams = request.nextUrl.searchParams;
  const conversationId = searchParams.get("conversationId");

  if (!conversationId) {
    return NextResponse.json(
      { success: false, error: "缺少 conversationId 参数" },
      { status: 400 },
    );
  }

  // 2. 清除上下文缓存（目前上下文存储在前端 localStorage，此接口为预留）
  logger.info(
    {
      userId: userId.slice(0, 8) + "...",
      conversationId,
    },
    "Agent Context: Clear request (no-op, frontend-managed)",
  );

  return NextResponse.json({
    success: true,
    data: {
      message: "上下文缓存已清除",
      conversationId,
    },
  });
});
