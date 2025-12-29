/**
 * Classification Confirmations API v1
 *
 * GET  /api/v1/classification/confirmations - 获取待确认列表
 * POST /api/v1/classification/confirmations - 创建待确认项
 *
 * @module api/v1/classification/confirmations
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { withAuthMiddleware } from "@/lib/api/middleware";
import type {
  ConfirmationType,
  ConfirmationStatus,
} from "@/types/confirmation";

const PENDING_CONFIRMATIONS_TABLE = "pending_confirmations" as const;

interface PendingConfirmationRow {
  id: number;
  user_id: string;
  bookmark_id: number | null;
  folder_id: number | null;
  confirmation_type: ConfirmationType;
  status: ConfirmationStatus;
  suggestion: {
    folderId?: number | null;
    folderName?: string | null;
    confidence?: number;
    reason?: string | null;
    alternatives?: unknown[];
  };
  user_choice: Record<string, unknown> | null;
  expires_at: string | null;
  created_at: string;
  resolved_at: string | null;
  bookmarks?: {
    id: number;
    title: string;
    url: string;
  } | null;
}

// 查询参数 Schema
const QuerySchema = z.object({
  status: z
    .enum(["pending", "confirmed", "rejected", "modified", "expired"])
    .optional(),
  type: z
    .enum([
      "classification",
      "folder_create",
      "folder_merge",
      "folder_split",
      "folder_rename",
    ])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// 创建确认项 Schema
const CreateConfirmationSchema = z.object({
  bookmarkId: z.number().int().positive(),
  type: z.enum([
    "classification",
    "folder_create",
    "folder_merge",
    "folder_split",
    "folder_rename",
  ]),
  suggestedFolderId: z.number().int().positive().nullable().optional(),
  suggestedFolderName: z.string().max(100).nullable().optional(),
  confidence: z.number().min(0).max(100),
  reason: z.string().max(500).optional(),
  expiresAt: z.string().datetime().optional(),
});

/**
 * GET /api/v1/classification/confirmations
 * 获取待确认列表
 */
export const GET = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // 解析查询参数
    const params = QuerySchema.safeParse({
      status: searchParams.get("status") || undefined,
      type: searchParams.get("type") || undefined,
      limit: searchParams.get("limit") || 50,
      offset: searchParams.get("offset") || 0,
    });

    if (!params.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "查询参数验证失败",
            details: params.error.flatten().fieldErrors,
          },
        },
        { status: 400 },
      );
    }

    const { status, type, limit, offset } = params.data;

    // 构建查询
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from(PENDING_CONFIRMATIONS_TABLE)
      .select(
        `
      *,
      bookmarks:bookmark_id (
        id,
        title,
        url
      )
    `,
        { count: "exact" },
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    // 过滤条件
    if (status) {
      query = query.eq("status", status);
    } else {
      query = query.eq("status", "pending");
    }

    if (type) {
      query = query.eq("confirmation_type", type);
    }

    // 分页
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      logger.error(
        { error: error.message, userId },
        "[v1] Failed to fetch confirmations",
      );
      return NextResponse.json(
        {
          success: false,
          error: { code: "INTERNAL_ERROR", message: "获取待确认列表失败" },
        },
        { status: 500 },
      );
    }

    // 转换为 API 响应格式
    const confirmations = (data || []).map((row: PendingConfirmationRow) => ({
      id: row.id,
      bookmarkId: row.bookmark_id,
      folderId: row.folder_id,
      type: row.confirmation_type,
      status: row.status,
      suggestion: {
        folderId: row.suggestion?.folderId,
        folderName: row.suggestion?.folderName,
        confidence: row.suggestion?.confidence,
        reason: row.suggestion?.reason,
        alternatives: row.suggestion?.alternatives,
      },
      userChoice: row.user_choice,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at,
      bookmark: row.bookmarks
        ? {
            title: row.bookmarks.title,
            url: row.bookmarks.url,
          }
        : null,
    }));

    return NextResponse.json({
      success: true,
      data: {
        items: confirmations,
        total: count || 0,
        limit,
        offset,
      },
    });
  },
);

/**
 * POST /api/v1/classification/confirmations
 * 创建待确认项
 */
export const POST = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const supabase = await createClient();

    // 解析请求体
    const body = await request.json();
    const validation = CreateConfirmationSchema.safeParse(body);

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

    const {
      bookmarkId,
      type,
      suggestedFolderId,
      suggestedFolderName,
      confidence,
      reason,
      expiresAt,
    } = validation.data;

    // 创建待确认项
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from(PENDING_CONFIRMATIONS_TABLE)
      .insert({
        user_id: userId,
        bookmark_id: bookmarkId,
        confirmation_type: type,
        status: "pending",
        suggestion: {
          folderId: suggestedFolderId || null,
          folderName: suggestedFolderName || null,
          confidence,
          reason: reason || null,
        },
        expires_at: expiresAt || null,
      })
      .select()
      .single();

    if (error) {
      logger.error(
        { error: error.message, userId },
        "[v1] Failed to create confirmation",
      );
      return NextResponse.json(
        {
          success: false,
          error: { code: "INTERNAL_ERROR", message: "创建待确认项失败" },
        },
        { status: 500 },
      );
    }

    logger.info(
      { userId, confirmationId: data.id, type },
      "[v1] Confirmation created",
    );

    return NextResponse.json({
      success: true,
      data: {
        id: data.id,
      },
    });
  },
);
