/**
 * Pending Confirmations API
 * V4.2 待确认列表 API
 *
 * GET  /api/classification/confirmations - 获取待确认列表
 * POST /api/classification/confirmations - 创建待确认项（内部调用）
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  badRequestError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import type {
  ConfirmationType,
  ConfirmationStatus,
} from "@/types/confirmation";
import type { NextRequest } from "next/server";

// 表名常量
const PENDING_CONFIRMATIONS_TABLE = "pending_confirmations" as const;

// ============================================================================
// 类型定义
// ============================================================================

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
  // 关联的书签数据
  bookmarks?: {
    id: number;
    title: string;
    url: string;
  } | null;
}

interface ConfirmationsQueryParams {
  status?: ConfirmationStatus;
  type?: ConfirmationType;
  limit?: number;
  offset?: number;
}

// ============================================================================
// GET - 获取待确认列表
// ============================================================================

/**
 * GET /api/classification/confirmations
 * 获取当前用户的待确认列表
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const params: ConfirmationsQueryParams = {
      status: searchParams.get("status") as ConfirmationStatus | undefined,
      type: searchParams.get("type") as ConfirmationType | undefined,
      limit: searchParams.get("limit")
        ? parseInt(searchParams.get("limit")!, 10)
        : 50,
      offset: searchParams.get("offset")
        ? parseInt(searchParams.get("offset")!, 10)
        : 0,
    };

    // 构建查询 - 关联 bookmarks 表获取标题和 URL
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
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    // 过滤条件
    if (params.status) {
      query = query.eq("status", params.status);
    } else {
      // 默认只显示 pending 状态
      query = query.eq("status", "pending");
    }

    if (params.type) {
      query = query.eq("confirmation_type", params.type);
    }

    // 分页
    query = query.range(params.offset!, params.offset! + params.limit! - 1);

    const { data, count, error } = await query;

    if (error) {
      logger.error(
        { error: error.message, userId: user.id },
        "Failed to fetch confirmations",
      );
      return internalError("获取待确认列表失败");
    }

    // 转换为前端格式
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
      // 关联的书签数据
      bookmark: row.bookmarks
        ? {
            title: row.bookmarks.title,
            url: row.bookmarks.url,
          }
        : null,
    }));

    return successResponse({
      confirmations,
      total: count || 0,
      limit: params.limit,
      offset: params.offset,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      { error: errorMessage },
      "GET /api/classification/confirmations error",
    );
    return internalError("获取待确认列表失败");
  }
}

// ============================================================================
// POST - 创建待确认项
// ============================================================================

interface CreateConfirmationBody {
  bookmarkId: number;
  type: ConfirmationType;
  suggestedFolderId?: number | null;
  suggestedFolderName?: string | null;
  confidence: number;
  reason?: string;
  metadata?: Record<string, unknown>;
  expiresAt?: string;
}

/**
 * POST /api/classification/confirmations
 * 创建待确认项（通常由分类服务内部调用）
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 解析请求体
    const body = (await request.json()) as CreateConfirmationBody;

    // 验证必填字段
    if (!body.bookmarkId || !body.type || body.confidence === undefined) {
      return badRequestError("缺少必填字段");
    }

    // 验证类型
    const validTypes: ConfirmationType[] = [
      "classification",
      "folder_create",
      "folder_merge",
      "folder_split",
      "folder_rename",
    ];
    if (!validTypes.includes(body.type)) {
      return badRequestError("无效的确认类型");
    }

    // 创建待确认项
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from(PENDING_CONFIRMATIONS_TABLE)
      .insert({
        user_id: user.id,
        bookmark_id: body.bookmarkId,
        confirmation_type: body.type,
        status: "pending",
        suggestion: {
          folderId: body.suggestedFolderId || null,
          folderName: body.suggestedFolderName || null,
          confidence: body.confidence,
          reason: body.reason || null,
        },
        expires_at: body.expiresAt || null,
      })
      .select()
      .single();

    if (error) {
      logger.error(
        { error: error.message, userId: user.id },
        "Failed to create confirmation",
      );
      return internalError("创建待确认项失败");
    }

    logger.info(
      {
        userId: user.id,
        confirmationId: data.id,
        type: body.type,
        action: "confirmation_created",
      },
      "Confirmation created",
    );

    return successResponse({
      id: data.id,
      message: "待确认项已创建",
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      { error: errorMessage },
      "POST /api/classification/confirmations error",
    );
    return internalError("创建待确认项失败");
  }
}
