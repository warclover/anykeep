/**
 * Batch Confirmations API
 * V4.2 批量确认 API
 *
 * POST /api/classification/confirmations/batch - 批量处理待确认消息
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
import { preferenceLearner } from "@/lib/classification/learning/preference-learner";
import type { NextRequest } from "next/server";

// 表名常量
const PENDING_CONFIRMATIONS_TABLE = "pending_confirmations" as const;

// ============================================================================
// 类型定义
// ============================================================================

interface BatchAction {
  /** 确认 ID */
  confirmationId: number;
  /** 操作类型 */
  action: "confirm" | "reject" | "modify";
  /** 修改时的新文件夹 ID */
  newFolderId?: number;
}

interface BatchRequestBody {
  actions: BatchAction[];
}

interface BatchResult {
  confirmationId: number;
  success: boolean;
  error?: string;
}

// ============================================================================
// POST - 批量处理
// ============================================================================

/**
 * POST /api/classification/confirmations/batch
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
    const body = (await request.json()) as BatchRequestBody;

    if (!body.actions || !Array.isArray(body.actions) || body.actions.length === 0) {
      return badRequestError("actions 数组不能为空");
    }

    // 限制批量处理数量
    if (body.actions.length > 50) {
      return badRequestError("批量操作最多支持 50 条");
    }

    // 验证所有 ID 属于当前用户
    const confirmationIds = body.actions.map((a) => a.confirmationId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: validConfirmations, error: fetchError } = await (supabase as any)
      .from(PENDING_CONFIRMATIONS_TABLE)
      .select("id, bookmark_id, suggested_folder_id, source_id")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .in("id", confirmationIds);

    if (fetchError) {
      throw new Error(`获取确认消息失败: ${fetchError.message}`);
    }

    // 定义确认消息类型
    interface ConfirmationData {
      id: number;
      bookmark_id: number;
      suggested_folder_id: number;
      source_id: string;
    }

    const validIds = new Set((validConfirmations || []).map((c: ConfirmationData) => c.id));
    const confirmationMap = new Map<number, ConfirmationData>(
      (validConfirmations || []).map((c: ConfirmationData) => [c.id, c] as [number, ConfirmationData]),
    );

    // 处理每个操作
    const results: BatchResult[] = [];
    const now = new Date().toISOString();

    for (const action of body.actions) {
      const { confirmationId, action: actionType, newFolderId } = action;

      // 检查 ID 是否有效
      if (!validIds.has(confirmationId)) {
        results.push({
          confirmationId,
          success: false,
          error: "确认消息不存在或已处理",
        });
        continue;
      }

      const confirmation = confirmationMap.get(confirmationId);
      if (!confirmation) {
        results.push({
          confirmationId,
          success: false,
          error: "确认消息数据异常",
        });
        continue;
      }

      try {
        switch (actionType) {
          case "confirm": {
            // 更新书签的文件夹
            await supabase
              .from("bookmarks")
              .update({
                folder_id: confirmation.suggested_folder_id,
                updated_at: now,
              })
              .eq("id", confirmation.bookmark_id)
              .eq("user_id", user.id);

            // 更新确认状态
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any)
              .from(PENDING_CONFIRMATIONS_TABLE)
              .update({
                status: "confirmed",
                updated_at: now,
              })
              .eq("id", confirmationId);

            // 记录学习事件
            await preferenceLearner.recordEvent({
              userId: user.id,
              eventType: "classification_confirmed",
              bookmarkId: confirmation.bookmark_id,
              sourceId: confirmation.source_id,
              newFolderId: confirmation.suggested_folder_id,
              timestamp: new Date(),
            });

            results.push({ confirmationId, success: true });
            break;
          }

          case "reject": {
            // 更新确认状态
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any)
              .from(PENDING_CONFIRMATIONS_TABLE)
              .update({
                status: "rejected",
                updated_at: now,
              })
              .eq("id", confirmationId);

            // 记录学习事件
            await preferenceLearner.recordEvent({
              userId: user.id,
              eventType: "classification_rejected",
              bookmarkId: confirmation.bookmark_id,
              sourceId: confirmation.source_id,
              originalFolderId: confirmation.suggested_folder_id,
              timestamp: new Date(),
            });

            results.push({ confirmationId, success: true });
            break;
          }

          case "modify": {
            if (!newFolderId) {
              results.push({
                confirmationId,
                success: false,
                error: "修改操作需要提供 newFolderId",
              });
              break;
            }

            // 更新书签的文件夹
            await supabase
              .from("bookmarks")
              .update({
                folder_id: newFolderId,
                updated_at: now,
              })
              .eq("id", confirmation.bookmark_id)
              .eq("user_id", user.id);

            // 更新确认状态
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any)
              .from(PENDING_CONFIRMATIONS_TABLE)
              .update({
                status: "modified",
                final_folder_id: newFolderId,
                updated_at: now,
              })
              .eq("id", confirmationId);

            // 记录学习事件
            await preferenceLearner.recordEvent({
              userId: user.id,
              eventType: "classification_modified",
              bookmarkId: confirmation.bookmark_id,
              sourceId: confirmation.source_id,
              originalFolderId: confirmation.suggested_folder_id,
              newFolderId,
              timestamp: new Date(),
            });

            results.push({ confirmationId, success: true });
            break;
          }

          default:
            results.push({
              confirmationId,
              success: false,
              error: `未知操作类型: ${actionType}`,
            });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.push({
          confirmationId,
          success: false,
          error: errorMessage,
        });
      }
    }

    // 统计结果
    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    logger.info(
      {
        userId: user.id,
        action: "batch_confirmation",
        total: body.actions.length,
        success: successCount,
        failure: failureCount,
      },
      "Batch confirmation completed",
    );

    return successResponse({
      results,
      summary: {
        total: body.actions.length,
        success: successCount,
        failure: failureCount,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage }, "POST /api/classification/confirmations/batch error");
    return internalError("批量处理失败");
  }
}
