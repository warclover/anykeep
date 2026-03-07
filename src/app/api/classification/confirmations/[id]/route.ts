/**
 * Single Confirmation API
 * V4.2 单个确认项操作 API
 *
 * GET    /api/classification/confirmations/[id] - 获取确认详情
 * PUT    /api/classification/confirmations/[id] - 确认/拒绝
 * DELETE /api/classification/confirmations/[id] - 删除确认项
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { withAuthMiddleware } from "@/lib/api/middleware";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  notFoundError,
  badRequestError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import type { ConfirmationStatus } from "@/types/confirmation";
import type { NextRequest } from "next/server";

// 表名常量
const PENDING_CONFIRMATIONS_TABLE = "pending_confirmations" as const;

// ============================================================================
// GET - 获取确认详情
// ============================================================================

/**
 * GET /api/classification/confirmations/[id]
 * 获取单个确认项详情
 */
export const GET = withAuthMiddleware<{ id: string }>(
  async (_request: NextRequest, { userId, params }) => {
    const supabase = await createClient();

    const { id } = await params;
    const confirmationId = parseInt(id, 10);

    if (isNaN(confirmationId)) {
      return badRequestError("无效的确认 ID");
    }

    // 获取确认项
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from(PENDING_CONFIRMATIONS_TABLE)
      .select("*")
      .eq("id", confirmationId)
      .eq("user_id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return notFoundError("确认项不存在");
      }
      return internalError("获取确认项失败");
    }

    return successResponse({
      id: data.id,
      bookmarkId: data.bookmark_id,
      folderId: data.folder_id,
      type: data.confirmation_type,
      status: data.status,
      suggestion: {
        folderId: data.suggestion?.folderId,
        folderName: data.suggestion?.folderName,
        confidence: data.suggestion?.confidence,
        reason: data.suggestion?.reason,
        alternatives: data.suggestion?.alternatives,
      },
      userChoice: data.user_choice,
      expiresAt: data.expires_at,
      createdAt: data.created_at,
      resolvedAt: data.resolved_at,
    });
  },
);

// ============================================================================
// PUT - 确认/拒绝
// ============================================================================

interface UpdateConfirmationBody {
  action: "confirm" | "reject" | "skip";
  /** 用户选择的文件夹 ID（如果与建议不同） */
  selectedFolderId?: number;
  /** 用户选择的新文件夹名（如果创建新文件夹） */
  newFolderName?: string;
  /** 拒绝理由 */
  rejectReason?: string;
}

/**
 * PUT /api/classification/confirmations/[id]
 * 确认或拒绝建议
 */
export const PUT = withAuthMiddleware<{ id: string }>(
  async (request: NextRequest, { userId, params }) => {
    const supabase = await createClient();

    const { id } = await params;
    const confirmationId = parseInt(id, 10);

    if (isNaN(confirmationId)) {
      return badRequestError("无效的确认 ID");
    }

    // 解析请求体
    const body = (await request.json()) as UpdateConfirmationBody;

    if (!body.action || !["confirm", "reject", "skip"].includes(body.action)) {
      return badRequestError("无效的操作");
    }

    // 获取当前确认项
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing, error: fetchError } = await (supabase as any)
      .from(PENDING_CONFIRMATIONS_TABLE)
      .select("*")
      .eq("id", confirmationId)
      .eq("user_id", userId)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return notFoundError("确认项不存在");
      }
      return internalError("获取确认项失败");
    }

    if (existing.status !== "pending") {
      return badRequestError("该确认项已处理");
    }

    // 确定新状态
    let newStatus: ConfirmationStatus;
    switch (body.action) {
      case "confirm":
        newStatus = "confirmed";
        break;
      case "reject":
        newStatus = "rejected";
        break;
      case "skip":
        // skip 操作标记为 modified（用户选择跳过/修改）
        newStatus = "modified";
        break;
      default:
        return badRequestError("无效的操作");
    }

    // 更新确认项状态
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from(PENDING_CONFIRMATIONS_TABLE)
      .update({
        status: newStatus,
        user_choice: {
          ...(existing.user_choice || {}),
          userAction: body.action,
          selectedFolderId: body.selectedFolderId,
          newFolderName: body.newFolderName,
          rejectReason: body.rejectReason,
          processedAt: new Date().toISOString(),
        },
        resolved_at: new Date().toISOString(),
      })
      .eq("id", confirmationId);

    if (updateError) {
      logger.error(
        { error: updateError.message, confirmationId },
        "Failed to update confirmation",
      );
      return internalError("更新确认项失败");
    }

    // 如果确认，执行分类操作
    if (body.action === "confirm" && existing.bookmark_id) {
      const targetFolderId =
        body.selectedFolderId || existing.suggestion?.folderId;

      if (targetFolderId) {
        // 更新书签的文件夹
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: moveError } = (await (supabase.from("bookmarks") as any)
          .update({
            folder_id: targetFolderId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.bookmark_id)
          .eq("user_id", userId)) as { error: { message: string } | null };

        if (moveError) {
          logger.warn(
            { error: moveError.message, bookmarkId: existing.bookmark_id },
            "Failed to move bookmark after confirmation",
          );
        }
      }
    }

    logger.info(
      {
        userId,
        confirmationId,
        action: body.action,
        status: newStatus,
      },
      "Confirmation processed",
    );

    return successResponse({
      id: confirmationId,
      status: newStatus,
      message:
        body.action === "confirm"
          ? "已确认分类建议"
          : body.action === "reject"
            ? "已拒绝分类建议"
            : "已跳过",
    });
  },
);

// ============================================================================
// DELETE - 删除确认项
// ============================================================================

/**
 * DELETE /api/classification/confirmations/[id]
 * 删除确认项
 */
export const DELETE = withAuthMiddleware<{ id: string }>(
  async (_request: NextRequest, { userId, params }) => {
    const supabase = await createClient();

    const { id } = await params;
    const confirmationId = parseInt(id, 10);

    if (isNaN(confirmationId)) {
      return badRequestError("无效的确认 ID");
    }

    // 删除确认项
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from(PENDING_CONFIRMATIONS_TABLE)
      .delete()
      .eq("id", confirmationId)
      .eq("user_id", userId);

    if (error) {
      logger.error(
        { error: error.message, confirmationId },
        "Failed to delete confirmation",
      );
      return internalError("删除确认项失败");
    }

    logger.info(
      {
        userId,
        confirmationId,
        action: "confirmation_deleted",
      },
      "Confirmation deleted",
    );

    return successResponse({
      message: "确认项已删除",
    });
  },
);
