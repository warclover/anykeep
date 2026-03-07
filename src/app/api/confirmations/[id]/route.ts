/**
 * Single Confirmation API
 * V4.2 单个待确认消息 API
 *
 * GET /api/confirmations/[id] - 获取单个确认消息
 * PUT /api/confirmations/[id] - 响应确认消息
 * DELETE /api/confirmations/[id] - 删除确认消息
 *
 * @version 1.1.0
 * @since 2025-12-11
 * @updated 2026-03-07 - 迁移到 withAuthMiddleware
 */

import {
  successResponse,
  badRequestError,
  notFoundError,
  forbiddenError,
} from "@/lib/utils/api-response";
import { confirmationService } from "@/lib/confirmation";
import { confirmationRepository } from "@/lib/confirmation/confirmation.repository";
import type {
  ClassificationChoice,
  FolderOperationChoice,
} from "@/types/confirmation";
import { withAuthMiddleware } from "@/lib/api/middleware";

/**
 * GET /api/confirmations/[id]
 * 获取单个确认消息
 */
export const GET = withAuthMiddleware<{ id: string }>(
  async (_request, { userId, params }) => {
    const { id } = await params;
    const confirmationId = parseInt(id, 10);

    if (isNaN(confirmationId)) {
      return badRequestError("无效的确认消息 ID");
    }

    const confirmation = await confirmationService.getById(confirmationId);

    if (!confirmation) {
      return notFoundError("确认消息不存在");
    }

    if (confirmation.user_id !== userId) {
      return forbiddenError("无权访问此确认消息");
    }

    return successResponse({ confirmation });
  },
);

/**
 * PUT /api/confirmations/[id]
 * 响应确认消息
 */
export const PUT = withAuthMiddleware<{ id: string }>(
  async (request, { userId, params }) => {
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

    if (confirmation.user_id !== userId) {
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
        userId,
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
        userId,
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
  },
);

/**
 * DELETE /api/confirmations/[id]
 * 删除确认消息
 */
export const DELETE = withAuthMiddleware<{ id: string }>(
  async (_request, { userId, params }) => {
    const { id } = await params;
    const confirmationId = parseInt(id, 10);

    if (isNaN(confirmationId)) {
      return badRequestError("无效的确认消息 ID");
    }

    const confirmation = await confirmationService.getById(confirmationId);

    if (!confirmation) {
      return notFoundError("确认消息不存在");
    }

    if (confirmation.user_id !== userId) {
      return forbiddenError("无权删除此确认消息");
    }

    await confirmationRepository.delete(confirmationId);

    return successResponse({
      deleted: true,
      id: confirmationId,
    });
  },
);
