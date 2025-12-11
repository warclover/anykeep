/**
 * Single Confirmation API
 * V4.2 单个待确认消息 API
 *
 * GET /api/confirmations/[id] - 获取单个确认消息
 * PUT /api/confirmations/[id] - 响应确认消息
 * DELETE /api/confirmations/[id] - 删除确认消息
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  badRequestError,
  notFoundError,
  unauthorizedError,
  forbiddenError,
  internalError,
} from "@/lib/utils/api-response";
import { confirmationService } from "@/lib/confirmation";
import { confirmationRepository } from "@/lib/confirmation/confirmation.repository";
import type { ClassificationChoice, FolderOperationChoice } from "@/types/confirmation";
import type { NextRequest } from "next/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/confirmations/[id]
 * 获取单个确认消息
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedError("请先登录");
    }

    const { id } = await params;
    const confirmationId = parseInt(id, 10);

    if (isNaN(confirmationId)) {
      return badRequestError("无效的确认消息 ID");
    }

    const confirmation = await confirmationService.getById(confirmationId);

    if (!confirmation) {
      return notFoundError("确认消息不存在");
    }

    if (confirmation.user_id !== user.id) {
      return forbiddenError("无权访问此确认消息");
    }

    return successResponse({ confirmation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return internalError(`获取确认消息失败: ${message}`);
  }
}

/**
 * PUT /api/confirmations/[id]
 * 响应确认消息
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedError("请先登录");
    }

    const { id } = await params;
    const confirmationId = parseInt(id, 10);

    if (isNaN(confirmationId)) {
      return badRequestError("无效的确认消息 ID");
    }

    const body = await request.json();
    const confirmation = await confirmationService.getById(confirmationId);

    if (!confirmation) {
      return notFoundError("确认消息不存在");
    }

    if (confirmation.user_id !== user.id) {
      return forbiddenError("无权操作此确认消息");
    }

    // 根据确认类型处理响应
    let result;

    if (confirmation.confirmation_type === "classification") {
      // 分类确认响应
      const choice: ClassificationChoice = {
        selectedFolderId: body.selectedFolderId ?? null,
        newFolderName: body.newFolderName,
        feedback: body.feedback,
        comment: body.comment,
      };

      result = await confirmationService.respondToClassification(
        confirmationId,
        user.id,
        choice,
      );
    } else {
      // 文件夹操作确认响应
      const choice: FolderOperationChoice = {
        accepted: body.accepted ?? false,
        modifications: body.modifications,
        comment: body.comment,
      };

      result = await confirmationService.respondToFolderOperation(
        confirmationId,
        user.id,
        choice,
      );
    }

    if (!result.success) {
      return badRequestError(result.error || "处理失败");
    }

    return successResponse({
      confirmation: result.confirmation,
      learningApplied: result.learningApplied,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return internalError(`响应确认消息失败: ${message}`);
  }
}

/**
 * DELETE /api/confirmations/[id]
 * 删除确认消息
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedError("请先登录");
    }

    const { id } = await params;
    const confirmationId = parseInt(id, 10);

    if (isNaN(confirmationId)) {
      return badRequestError("无效的确认消息 ID");
    }

    const confirmation = await confirmationService.getById(confirmationId);

    if (!confirmation) {
      return notFoundError("确认消息不存在");
    }

    if (confirmation.user_id !== user.id) {
      return forbiddenError("无权删除此确认消息");
    }

    await confirmationRepository.delete(confirmationId);

    return successResponse({
      deleted: true,
      id: confirmationId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return internalError(`删除确认消息失败: ${message}`);
  }
}
