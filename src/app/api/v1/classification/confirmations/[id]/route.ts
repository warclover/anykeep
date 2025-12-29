/**
 * Single Confirmation API v1
 *
 * GET    /api/v1/classification/confirmations/{id} - 获取确认详情
 * PUT    /api/v1/classification/confirmations/{id} - 确认/拒绝
 * DELETE /api/v1/classification/confirmations/{id} - 删除确认项
 *
 * @module api/v1/classification/confirmations/[id]
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { withAuthMiddleware } from "@/lib/api/middleware";
import type { ConfirmationStatus } from "@/types/confirmation";

const PENDING_CONFIRMATIONS_TABLE = "pending_confirmations" as const;

interface RouteParams {
  id: string;
}

// 更新确认项 Schema
const UpdateConfirmationSchema = z.object({
  action: z.enum(["confirm", "reject", "skip"]),
  selectedFolderId: z.number().int().positive().optional(),
  newFolderName: z.string().max(100).optional(),
  rejectReason: z.string().max(500).optional(),
});

/**
 * GET /api/v1/classification/confirmations/{id}
 * 获取确认详情
 */
export const GET = withAuthMiddleware<RouteParams>(
  async (_request, { userId, params }) => {
    const { id } = await params;
    const confirmationId = parseInt(id, 10);

    if (isNaN(confirmationId)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_ID", message: "无效的确认 ID" },
        },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from(PENDING_CONFIRMATIONS_TABLE)
      .select("*")
      .eq("id", confirmationId)
      .eq("user_id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          {
            success: false,
            error: { code: "NOT_FOUND", message: "确认项不存在" },
          },
          { status: 404 },
        );
      }
      logger.error(
        { error: error.message, confirmationId },
        "[v1] Failed to get confirmation",
      );
      return NextResponse.json(
        {
          success: false,
          error: { code: "INTERNAL_ERROR", message: "获取确认项失败" },
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
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
      },
    });
  },
);

/**
 * PUT /api/v1/classification/confirmations/{id}
 * 确认/拒绝建议
 */
export const PUT = withAuthMiddleware<RouteParams>(
  async (request: NextRequest, { userId, params }) => {
    const { id } = await params;
    const confirmationId = parseInt(id, 10);

    if (isNaN(confirmationId)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_ID", message: "无效的确认 ID" },
        },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // 解析请求体
    const body = await request.json();
    const validation = UpdateConfirmationSchema.safeParse(body);

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

    const { action, selectedFolderId, newFolderName, rejectReason } =
      validation.data;

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
        return NextResponse.json(
          {
            success: false,
            error: { code: "NOT_FOUND", message: "确认项不存在" },
          },
          { status: 404 },
        );
      }
      logger.error(
        { error: fetchError.message, confirmationId },
        "[v1] Failed to fetch confirmation",
      );
      return NextResponse.json(
        {
          success: false,
          error: { code: "INTERNAL_ERROR", message: "获取确认项失败" },
        },
        { status: 500 },
      );
    }

    if (existing.status !== "pending") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "ALREADY_PROCESSED", message: "该确认项已处理" },
        },
        { status: 400 },
      );
    }

    // 确定新状态
    let newStatus: ConfirmationStatus;
    switch (action) {
      case "confirm":
        newStatus = "confirmed";
        break;
      case "reject":
        newStatus = "rejected";
        break;
      case "skip":
        newStatus = "modified";
        break;
    }

    // 更新确认项状态
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from(PENDING_CONFIRMATIONS_TABLE)
      .update({
        status: newStatus,
        user_choice: {
          ...(existing.user_choice || {}),
          userAction: action,
          selectedFolderId,
          newFolderName,
          rejectReason,
          processedAt: new Date().toISOString(),
        },
        resolved_at: new Date().toISOString(),
      })
      .eq("id", confirmationId);

    if (updateError) {
      logger.error(
        { error: updateError.message, confirmationId },
        "[v1] Failed to update confirmation",
      );
      return NextResponse.json(
        {
          success: false,
          error: { code: "INTERNAL_ERROR", message: "更新确认项失败" },
        },
        { status: 500 },
      );
    }

    // 如果确认，执行分类操作
    if (action === "confirm" && existing.bookmark_id) {
      const targetFolderId = selectedFolderId || existing.suggestion?.folderId;

      if (targetFolderId) {
        const { error: moveError } = await supabase
          .from("bookmarks")
          .update({
            folder_id: targetFolderId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.bookmark_id)
          .eq("user_id", userId);

        if (moveError) {
          logger.warn(
            { error: moveError.message, bookmarkId: existing.bookmark_id },
            "[v1] Failed to move bookmark after confirmation",
          );
        }
      }
    }

    logger.info(
      { userId, confirmationId, action, status: newStatus },
      "[v1] Confirmation processed",
    );

    const message =
      action === "confirm"
        ? "已确认分类建议"
        : action === "reject"
          ? "已拒绝分类建议"
          : "已跳过";

    return NextResponse.json({
      success: true,
      data: {
        id: confirmationId,
        status: newStatus,
        message,
      },
    });
  },
);

/**
 * DELETE /api/v1/classification/confirmations/{id}
 * 删除确认项
 */
export const DELETE = withAuthMiddleware<RouteParams>(
  async (_request, { userId, params }) => {
    const { id } = await params;
    const confirmationId = parseInt(id, 10);

    if (isNaN(confirmationId)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_ID", message: "无效的确认 ID" },
        },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from(PENDING_CONFIRMATIONS_TABLE)
      .delete()
      .eq("id", confirmationId)
      .eq("user_id", userId);

    if (error) {
      logger.error(
        { error: error.message, confirmationId },
        "[v1] Failed to delete confirmation",
      );
      return NextResponse.json(
        {
          success: false,
          error: { code: "INTERNAL_ERROR", message: "删除确认项失败" },
        },
        { status: 500 },
      );
    }

    logger.info({ userId, confirmationId }, "[v1] Confirmation deleted");

    return NextResponse.json({
      success: true,
      data: {
        deleted: true,
      },
    });
  },
);
