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
 * @version 2.1.0 - Deprecated, use /inbox instead
 * @deprecated 2025-12-24
 * @updated 2026-03-07 - 迁移到 withAuthMiddleware
 */

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  handleValidationError,
  notFoundError,
  internalError,
  badRequestError,
  safeParseJson,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { operationLogService } from "@/lib/operation-log";
import { withAuthMiddleware } from "@/lib/api/middleware";

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

// 添加标准 HTTP 弃用 headers (RFC 8594)
const addDeprecationHeaders = (response: Response) => {
  response.headers.set("Deprecation", "true");
  response.headers.set("Sunset", "2026-03-31T00:00:00Z"); // 计划于 2026-03-31 移除
  response.headers.set(
    "Link",
    '</api/classification/inbox>; rel="successor-version"',
  );
  return response;
};

/**
 * POST /api/classification/cluster-confirm
 * @deprecated Use POST /api/classification/inbox instead
 * 确认聚类建议，创建文件夹并移动书签
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  // Log deprecation warning
  logger.warn(
    { endpoint: "/api/classification/cluster-confirm", method: "POST" },
    "Deprecated endpoint called. Use POST /api/classification/inbox instead",
  );

  // 1. 解析并验证请求体
  const { data: body, error: parseError } = await safeParseJson(request);
  if (parseError) {
    return addDeprecationHeaders(badRequestError(parseError));
  }
  const validation = confirmSuggestionSchema.safeParse(body);

  if (!validation.success) {
    return addDeprecationHeaders(handleValidationError(validation.error));
  }

  const { suggestionId, customFolderName } = validation.data;

  const supabase = await createClient();

  // 2. 获取建议记录
  const { data: suggestion, error: fetchError } = await supabase
    .from("classification_suggestions")
    .select("*")
    .eq("id", suggestionId)
    .eq("user_id", userId)
    .eq("status", "pending")
    .single();

  if (fetchError || !suggestion) {
    return addDeprecationHeaders(notFoundError("建议不存在或已处理"));
  }

  // 3. 记录建议动作类型（所有类型均支持创建文件夹并归类）
  const suggestedAction = suggestion.suggested_action || "create_folder";
  if (suggestedAction !== "create_folder") {
    logger.info(
      { suggestionId, suggestedAction },
      "Processing non-create_folder suggestion via cluster-confirm API",
    );
  }

  // 4. 创建文件夹
  const folderName = customFolderName || suggestion.suggested_folder_name;
  if (!folderName) {
    return addDeprecationHeaders(internalError("建议中没有有效的文件夹名称"));
  }

  const { data: newFolder, error: createError } = await supabase
    .from("folders")
    .insert({
      user_id: userId,
      name: folderName,
      is_system: false,
    })
    .select("id, name")
    .single();

  if (createError || !newFolder) {
    logger.error(
      { error: createError, userId, folderName },
      "Failed to create folder from cluster suggestion",
    );
    return addDeprecationHeaders(internalError("创建文件夹失败"));
  }

  // 5. 获取建议中的书签 ID
  // 兼容处理：优先使用 bookmark_ids，回退到 bookmark_id
  const bookmarkIds =
    suggestion.bookmark_ids && suggestion.bookmark_ids.length > 0
      ? suggestion.bookmark_ids
      : suggestion.bookmark_id
        ? [suggestion.bookmark_id]
        : [];
  if (bookmarkIds.length === 0) {
    logger.warn({ suggestionId }, "Suggestion has no bookmark IDs");
    return addDeprecationHeaders(internalError("建议中没有书签"));
  }

  // 6. 移动书签到新文件夹并清除聚类状态
  const { error: moveError } = await supabase
    .from("bookmarks")
    .update({
      folder_id: newFolder.id,
      pending_cluster: false,
      pending_since: null,
      cluster_id: null,
      cluster_confidence: null,
    })
    .in("id", bookmarkIds)
    .eq("user_id", userId);

  if (moveError) {
    logger.error(
      { error: moveError, userId, folderId: newFolder.id },
      "Failed to move bookmarks to new folder",
    );
    return addDeprecationHeaders(internalError("移动书签失败"));
  }

  // 7. 更新建议状态
  await supabase
    .from("classification_suggestions")
    .update({
      status: "accepted",
      processed_at: new Date().toISOString(),
    })
    .eq("id", suggestionId);

  // 8. 记录操作快照（用于撤销）
  await operationLogService.createFolderWithNotification(
    userId,
    { id: newFolder.id, name: newFolder.name, parent_id: null },
    bookmarkIds.map((id) => ({ id, title: "书签", folder_id: null })), // 简化处理
    `用户确认聚类建议：${suggestion.reason || "基于内容相似性"}`,
  );

  logger.info(
    {
      userId,
      suggestionId,
      folderId: newFolder.id,
      folderName: newFolder.name,
      bookmarkCount: bookmarkIds.length,
    },
    "Cluster suggestion confirmed, folder created",
  );

  return addDeprecationHeaders(
    successResponse({
      success: true,
      folder: {
        id: newFolder.id,
        name: newFolder.name,
      },
      bookmarkCount: bookmarkIds.length,
      message: `已创建「${newFolder.name}」并移动 ${bookmarkIds.length} 个书签`,
    }),
  );
});

/**
 * DELETE /api/classification/cluster-confirm
 * @deprecated Use DELETE /api/classification/inbox instead
 * 拒绝聚类建议
 */
export const DELETE = withAuthMiddleware(async (request, { userId }) => {
  // Log deprecation warning
  logger.warn(
    { endpoint: "/api/classification/cluster-confirm", method: "DELETE" },
    "Deprecated endpoint called. Use DELETE /api/classification/inbox instead",
  );

  // 1. 解析并验证请求体
  const { data: body, error: parseError } = await safeParseJson(request);
  if (parseError) {
    return addDeprecationHeaders(badRequestError(parseError));
  }
  const validation = rejectSuggestionSchema.safeParse(body);

  if (!validation.success) {
    return addDeprecationHeaders(handleValidationError(validation.error));
  }

  const { suggestionId, reason } = validation.data;

  const supabase = await createClient();

  // 2. 获取建议记录
  const { data: suggestion, error: fetchError } = await supabase
    .from("classification_suggestions")
    .select("*")
    .eq("id", suggestionId)
    .eq("user_id", userId)
    .eq("status", "pending")
    .single();

  if (fetchError || !suggestion) {
    return addDeprecationHeaders(notFoundError("建议不存在或已处理"));
  }

  // 3. 更新建议状态为拒绝
  await supabase
    .from("classification_suggestions")
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

  // 4. 清除相关书签的聚类状态（保留在待整理）
  // 兼容处理：优先使用 bookmark_ids，回退到 bookmark_id
  const bookmarkIds =
    suggestion.bookmark_ids && suggestion.bookmark_ids.length > 0
      ? suggestion.bookmark_ids
      : suggestion.bookmark_id
        ? [suggestion.bookmark_id]
        : [];
  if (bookmarkIds.length > 0) {
    await supabase
      .from("bookmarks")
      .update({
        cluster_id: null,
        cluster_confidence: null,
        // 保留 pending_cluster = true，以便下次聚类时重新考虑
      })
      .in("id", bookmarkIds)
      .eq("user_id", userId);
  }

  logger.info(
    {
      userId,
      suggestionId,
      reason,
      bookmarkCount: bookmarkIds.length,
    },
    "Cluster suggestion rejected",
  );

  return addDeprecationHeaders(
    successResponse({
      success: true,
      message: "已拒绝此建议",
    }),
  );
});
