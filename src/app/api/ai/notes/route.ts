/**
 * AI 笔记 API
 *
 * POST /api/ai/notes - 保存笔记
 * GET /api/ai/notes - 获取笔记列表
 *
 * Phase 4: AI 生成内容保存
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { noteService } from "@/lib/ai-skills/services";
import { logger } from "@/lib/logger";

/**
 * 保存笔记请求 Schema
 */
const saveNoteRequestSchema = z.object({
  /** 笔记内容 */
  content: z.string().min(1).max(100000),
  /** 笔记标题（可选，自动生成） */
  title: z.string().max(200).optional(),
  /** 来源类型 */
  sourceType: z.enum([
    "ai_summary",
    "ai_extraction",
    "ai_review",
    "ai_report",
    "ai_response",
  ]),
  /** 关联书签 ID 列表 */
  relatedBookmarkIds: z.array(z.number().int().positive()).optional(),
  /** 来源会话 ID */
  sourceConversationId: z.string().optional(),
  /** 来源消息 ID */
  sourceMessageId: z.string().optional(),
  /** 来源 Skill ID */
  sourceSkillId: z.string().optional(),
  /** 标签列表 */
  tags: z.array(z.string().max(50)).max(20).optional(),
});

/**
 * 获取笔记列表请求 Schema
 */
const listNotesRequestSchema = z.object({
  /** 来源类型筛选 */
  sourceType: z
    .enum([
      "ai_summary",
      "ai_extraction",
      "ai_review",
      "ai_report",
      "ai_response",
    ])
    .optional(),
  /** 标签筛选 */
  tags: z.array(z.string()).optional(),
  /** 搜索关键词 */
  search: z.string().optional(),
  /** 分页限制 */
  limit: z.number().int().min(1).max(100).optional(),
  /** 分页偏移 */
  offset: z.number().int().min(0).optional(),
});

/**
 * POST /api/ai/notes
 * 保存 AI 笔记
 */
export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
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

    // 解析请求体
    const body = await request.json();
    const validation = saveNoteRequestSchema.safeParse(body);

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

    // 保存笔记
    const result = await noteService.saveNote(validation.data);

    if (!result.success) {
      logger.warn(
        { sourceType: validation.data.sourceType, error: result.error },
        "AI Notes API: Save failed",
      );
      return Response.json(
        { success: false, error: result.error },
        { status: 400 },
      );
    }

    logger.info(
      {
        userId: user.id.slice(0, 8) + "...",
        noteId: result.data?.id,
        sourceType: validation.data.sourceType,
        contentLength: validation.data.content.length,
      },
      "AI Notes API: Note saved",
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
      "AI Notes API: POST unexpected error",
    );

    return Response.json(
      { success: false, error: "系统错误" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/ai/notes
 * 获取 AI 笔记列表
 */
export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
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

    // 解析查询参数
    const searchParams = request.nextUrl.searchParams;
    const params = {
      sourceType: searchParams.get("sourceType") || undefined,
      tags: searchParams.get("tags")?.split(",").filter(Boolean) || undefined,
      search: searchParams.get("search") || undefined,
      limit: searchParams.get("limit")
        ? parseInt(searchParams.get("limit")!, 10)
        : undefined,
      offset: searchParams.get("offset")
        ? parseInt(searchParams.get("offset")!, 10)
        : undefined,
    };

    const validation = listNotesRequestSchema.safeParse(params);

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

    // 获取笔记列表
    const result = await noteService.listNotes(validation.data);

    if (!result.success) {
      return Response.json(
        { success: false, error: result.error },
        { status: 400 },
      );
    }

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
      "AI Notes API: GET unexpected error",
    );

    return Response.json(
      { success: false, error: "系统错误" },
      { status: 500 },
    );
  }
}
