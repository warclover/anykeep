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

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { contextManager } from "@/lib/ai-skills/services";
import { logger } from "@/lib/logger";

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

export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json(
        { success: false, error: "请先登录" },
        { status: 401 },
      );
    }

    // 2. 解析并验证请求体
    const body = await request.json();
    const validation = resolveContextRequestSchema.safeParse(body);

    if (!validation.success) {
      return Response.json(
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
        userId: user.id.slice(0, 8) + "...",
        bookmarkCount: references.bookmarkIds?.length || 0,
        folderCount: references.folderIds?.length || 0,
        tagCount: references.tagNames?.length || 0,
        hasSearch: !!references.searchQuery,
        hasPrevious: !!references.previousOutputId,
      },
      "Agent Context: Resolve request received",
    );

    // 3. 解析上下文
    const result = await contextManager.resolveContext(references);

    if (!result.success || !result.data) {
      return Response.json(
        { success: false, error: result.error || "解析上下文失败" },
        { status: 400 },
      );
    }

    // 4. 构建响应
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

    // 5. 生成摘要（可选）
    if (generateSummary) {
      response.data.summary = contextManager.generateSummary(result.data);
    }

    // 6. 生成 AI 用文本（可选）
    if (generateText) {
      response.data.contextText = contextManager.generateContextText(
        result.data,
      );
    }

    logger.info(
      {
        userId: user.id.slice(0, 8) + "...",
        itemCount: result.data.items.length,
        hasText: generateText,
        hasSummary: generateSummary,
      },
      "Agent Context: Context resolved",
    );

    return Response.json(response);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "POST /api/agent/context error",
    );

    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "解析上下文失败",
      },
      { status: 500 },
    );
  }
}

// =============================================================================
// GET /api/agent/context
// 验证上下文引用
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json(
        { success: false, error: "请先登录" },
        { status: 401 },
      );
    }

    // 2. 解析查询参数
    const searchParams = request.nextUrl.searchParams;

    const references = {
      bookmarkIds: searchParams.get("bookmarkIds")
        ? searchParams
            .get("bookmarkIds")!
            .split(",")
            .map((id) => parseInt(id, 10))
            .filter((id) => !isNaN(id))
        : undefined,
      folderIds: searchParams.get("folderIds")
        ? searchParams
            .get("folderIds")!
            .split(",")
            .map((id) => parseInt(id, 10))
            .filter((id) => !isNaN(id))
        : undefined,
      tagNames: searchParams.get("tagNames")
        ? searchParams.get("tagNames")!.split(",").filter(Boolean)
        : undefined,
      previousOutputId: searchParams.get("previousOutputId") || undefined,
      searchQuery: searchParams.get("searchQuery") || undefined,
    };

    // 3. 验证引用
    const validation = contextReferencesSchema.safeParse(references);

    if (!validation.success) {
      return Response.json(
        {
          success: false,
          error: "请求参数无效",
          details: validation.error.issues,
        },
        { status: 400 },
      );
    }

    // 4. 检查引用有效性
    const result = await contextManager.validateReferences(validation.data);

    if (!result.success) {
      return Response.json(
        { success: false, error: result.error },
        { status: 400 },
      );
    }

    logger.info(
      {
        userId: user.id.slice(0, 8) + "...",
        valid: result.data?.valid,
        errorCount: result.data?.errors.length || 0,
      },
      "Agent Context: Validation complete",
    );

    return Response.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "GET /api/agent/context error",
    );

    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "验证上下文失败",
      },
      { status: 500 },
    );
  }
}

// =============================================================================
// DELETE /api/agent/context
// 清除上下文缓存（预留接口）
// =============================================================================

export async function DELETE(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json(
        { success: false, error: "请先登录" },
        { status: 401 },
      );
    }

    // 2. 解析查询参数
    const searchParams = request.nextUrl.searchParams;
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return Response.json(
        { success: false, error: "缺少 conversationId 参数" },
        { status: 400 },
      );
    }

    // 3. 清除上下文缓存（目前上下文存储在前端 localStorage，此接口为预留）
    logger.info(
      {
        userId: user.id.slice(0, 8) + "...",
        conversationId,
      },
      "Agent Context: Clear request (no-op, frontend-managed)",
    );

    return Response.json({
      success: true,
      data: {
        message: "上下文缓存已清除",
        conversationId,
      },
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "DELETE /api/agent/context error",
    );

    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "清除上下文失败",
      },
      { status: 500 },
    );
  }
}
