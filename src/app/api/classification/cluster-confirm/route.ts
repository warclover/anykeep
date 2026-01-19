/**
 * V4.2 聚类确认 API (V2.0.0 - Deprecated)
 *
 * @deprecated 此端点已弃用，建议使用 /api/classification/inbox 代替：
 * - POST /api/classification/inbox - 应用建议（包含聚类建议）
 * - DELETE /api/classification/inbox - 拒绝建议
 *
 * 此端点仍保留以向后兼容，但会在日志中记录弃用警告。
 *
 * POST /api/classification/cluster-confirm - 确认聚类建议（创建文件夹）
 * DELETE /api/classification/cluster-confirm - 拒绝聚类建议
 *
 * @version 2.0.0 - Deprecated, use /inbox instead
 * @deprecated 2025-12-24
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
  notFoundError,
  internalError,
  badRequestError,
  safeParseJson,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { operationLogService } from "@/lib/classification/services/operation-log.service";

/**
 * 确认建议 Schema
 */
const confirmSuggestionSchema = z.object({
  suggestionId: z.number().int().positive(),
  // 可选：自定义文件夹名称
  customFolderName: z.string().min(1).max(100).optional(),
});

/**
 * 拒绝建议 Schema
 */
const rejectSuggestionSchema = z.object({
  suggestionId: z.number().int().positive(),
  // 可选：拒绝原因
  reason: z.string().max(500).optional(),
});

/**
 * POST /api/classification/cluster-confirm
 * @deprecated Use POST /api/classification/inbox instead
 * 确认聚类建议，创建文件夹并移动书签
 */
export async function POST(request: NextRequest) {
  // Log deprecation warning
  logger.warn(
    { endpoint: "/api/classification/cluster-confirm", method: "POST" },
    "Deprecated endpoint called. Use POST /api/classification/inbox instead",
  );

  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // 2. 解析并验证请求体
    const { data: body, error: parseError } = await safeParseJson(request);
    if (parseError) {
      return badRequestError(parseError);
    }
    const validation = confirmSuggestionSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { suggestionId, customFolderName } = validation.data;

    // 3. 获取建议记录
    // Note: bookmark_ids, suggested_action, metadata 是 V4.2 新增字段
    // 类型断言: 手动维护类型文件时需要此断言
    type SuggestionType = {
      id: number;
      user_id: string;
      status: string;
      suggested_action: string | null;
      suggested_folder_name: string | null;
      reason: string | null;
      bookmark_ids: number[] | null;
      bookmark_id: number | null;
      metadata: unknown;
    };
    const { data: suggestion, error: fetchError } = await supabase
      .from("classification_suggestions")
      .select("*")
      .eq("id", suggestionId)
      .eq("user_id", user.id)
      .eq("status", "pending")
      .single() as unknown as {
      data: SuggestionType | null;
      error: { message: string } | null;
    };

    if (fetchError || !suggestion) {
      return notFoundError("建议不存在或已处理");
    }

    // 4. 检查是否是创建文件夹建议
    // 兼容处理：默认动作为 create_folder（向后兼容旧数据）
    const suggestedAction = suggestion.suggested_action || "create_folder";
    if (suggestedAction !== "create_folder") {
      return internalError("此建议类型不支持通过此 API 确认");
    }

    // 5. 创建文件夹
    const folderName = customFolderName || suggestion.suggested_folder_name;
    if (!folderName) {
      return internalError("建议中没有有效的文件夹名称");
    }

     
    const { data: newFolder, error: createError } = await (supabase
      .from("folders") as any)
      .insert({
        user_id: user.id,
        name: folderName,
        is_system: false,
        is_ai_suggested: true,
        ai_reason: suggestion.reason,
      })
      .select("id, name")
      .single() as { data: { id: number; name: string } | null; error: { message: string } | null };

    if (createError || !newFolder) {
      logger.error(
        { error: createError, userId: user.id, folderName },
        "Failed to create folder from cluster suggestion",
      );
      return internalError("创建文件夹失败");
    }

    // 6. 获取建议中的书签 ID
    // 兼容处理：优先使用 bookmark_ids，回退到 bookmark_id
    const bookmarkIds =
      suggestion.bookmark_ids && suggestion.bookmark_ids.length > 0
        ? suggestion.bookmark_ids
        : suggestion.bookmark_id
          ? [suggestion.bookmark_id]
          : [];
    if (bookmarkIds.length === 0) {
      logger.warn({ suggestionId }, "Suggestion has no bookmark IDs");
      return internalError("建议中没有书签");
    }

    // 7. 移动书签到新文件夹并清除聚类状态
    // Note: pending_cluster, pending_since, cluster_id, cluster_confidence 是 V4.2 新增字段
     
    const { error: moveError } = await (supabase
      .from("bookmarks") as any)
      .update({
        folder_id: newFolder.id,
        pending_cluster: false,
        pending_since: null,
        cluster_id: null,
        cluster_confidence: null,
      })
      .in("id", bookmarkIds)
      .eq("user_id", user.id) as { error: { message: string } | null };

    if (moveError) {
      logger.error(
        { error: moveError, userId: user.id, folderId: newFolder.id },
        "Failed to move bookmarks to new folder",
      );
      return internalError("移动书签失败");
    }

    // 8. 更新建议状态
     
    await (supabase
      .from("classification_suggestions") as any)
      .update({
        status: "accepted",
        processed_at: new Date().toISOString(),
      })
      .eq("id", suggestionId);

    // 9. 记录操作快照（用于撤销）
    await operationLogService.createFolderWithNotification(
      user.id,
      { id: newFolder.id, name: newFolder.name, parent_id: null },
      bookmarkIds.map((id) => ({ id, title: "书签", folder_id: null })), // 简化处理
      `用户确认聚类建议：${suggestion.reason || "基于内容相似性"}`,
    );

    logger.info(
      {
        userId: user.id,
        suggestionId,
        folderId: newFolder.id,
        folderName: newFolder.name,
        bookmarkCount: bookmarkIds.length,
      },
      "Cluster suggestion confirmed, folder created",
    );

    return successResponse({
      success: true,
      folder: {
        id: newFolder.id,
        name: newFolder.name,
      },
      bookmarkCount: bookmarkIds.length,
      message: `已创建「${newFolder.name}」并移动 ${bookmarkIds.length} 个书签`,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "POST /api/classification/cluster-confirm error",
    );
    return internalError("确认建议失败");
  }
}

/**
 * DELETE /api/classification/cluster-confirm
 * @deprecated Use DELETE /api/classification/inbox instead
 * 拒绝聚类建议
 */
export async function DELETE(request: NextRequest) {
  // Log deprecation warning
  logger.warn(
    { endpoint: "/api/classification/cluster-confirm", method: "DELETE" },
    "Deprecated endpoint called. Use DELETE /api/classification/inbox instead",
  );

  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // 2. 解析并验证请求体
    const { data: body, error: parseError } = await safeParseJson(request);
    if (parseError) {
      return badRequestError(parseError);
    }
    const validation = rejectSuggestionSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { suggestionId, reason } = validation.data;

    // 3. 获取建议记录
    // Note: bookmark_ids, metadata 是 V4.2 新增字段
    // 类型断言: 手动维护类型文件时需要此断言
    type DeleteSuggestionType = {
      id: number;
      bookmark_ids: number[] | null;
      bookmark_id: number | null;
      metadata: unknown;
    };
    const { data: suggestion, error: fetchError } = await supabase
      .from("classification_suggestions")
      .select("*")
      .eq("id", suggestionId)
      .eq("user_id", user.id)
      .eq("status", "pending")
      .single() as unknown as {
      data: DeleteSuggestionType | null;
      error: { message: string } | null;
    };

    if (fetchError || !suggestion) {
      return notFoundError("建议不存在或已处理");
    }

    // 4. 更新建议状态为拒绝
     
    await (supabase
      .from("classification_suggestions") as any)
      .update({
        status: "rejected",
        processed_at: new Date().toISOString(),
        metadata: {
          ...((suggestion.metadata as Record<string, unknown>) || {}),
          rejectedReason: reason,
          rejectedAt: new Date().toISOString(),
        },
      })
      .eq("id", suggestionId);

    // 5. 清除相关书签的聚类状态（保留在待整理）
    // 兼容处理：优先使用 bookmark_ids，回退到 bookmark_id
    const bookmarkIds =
      suggestion.bookmark_ids && suggestion.bookmark_ids.length > 0
        ? suggestion.bookmark_ids
        : suggestion.bookmark_id
          ? [suggestion.bookmark_id]
          : [];
    if (bookmarkIds.length > 0) {
       
      await (supabase
        .from("bookmarks") as any)
        .update({
          cluster_id: null,
          cluster_confidence: null,
          // 保留 pending_cluster = true，以便下次聚类时重新考虑
        })
        .in("id", bookmarkIds)
        .eq("user_id", user.id);
    }

    logger.info(
      {
        userId: user.id,
        suggestionId,
        reason,
        bookmarkCount: bookmarkIds.length,
      },
      "Cluster suggestion rejected",
    );

    return successResponse({
      success: true,
      message: "已拒绝此建议",
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "DELETE /api/classification/cluster-confirm error",
    );
    return internalError("拒绝建议失败");
  }
}
