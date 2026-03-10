/**
 * Classification Result Handlers
 * 拆分自 integration.ts，处理不同置信度级别的分类结果
 *
 * @version 1.0.0
 * @since 2026-01-27
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { ClassificationResult } from "../types";
import type { ClassificationSuggestion } from "@/types/confirmation";
import { logger } from "@/lib/logger";
import { MessageService } from "@/lib/messages/server";
import { confirmationService } from "@/lib/confirmation";
import { CLASSIFICATION_STATUS } from "../types/classification-status";
import { updateBookmarkClassificationStatus } from "../classification-status";
import { updateFolderProfileAfterClassification } from "../folder-profile-manager";

/**
 * 分类处理结果
 */
export interface ClassificationHandlerResult {
  classified: boolean;
  folderId: number | null;
  folderName: string | null;
  confidence: number;
  action: ClassificationResult["action"];
  suggestionId?: number;
}

/**
 * 处理高置信度分类结果（自动归类）
 */
export async function handleHighConfidenceClassification(
  supabase: SupabaseClient<Database>,
  bookmarkId: number,
  userId: string,
  result: ClassificationResult,
): Promise<ClassificationHandlerResult | null> {
  if (!result.folderId) {
    return null;
  }

  // 移动书签到分类文件夹并清除待聚类状态
  const { error: moveError } = await supabase
    .from("bookmarks")
    .update({
      folder_id: result.folderId,
      pending_cluster: false,
      pending_since: null,
      cluster_id: null,
      cluster_confidence: null,
    })
    .eq("id", bookmarkId)
    .eq("user_id", userId);

  if (moveError) {
    logger.error(
      { error: moveError, bookmarkId, folderId: result.folderId },
      "Classification: Failed to move bookmark (high confidence)",
    );
    return {
      classified: false,
      folderId: null,
      folderName: null,
      confidence: result.confidence,
      action: CLASSIFICATION_STATUS.INBOX,
    };
  }

  logger.info(
    {
      bookmarkId,
      folderId: result.folderId,
      folderName: result.folderName,
      confidence: result.confidence,
    },
    "Classification: Auto-classified (high confidence)",
  );

  // 发送自动分类完成消息（静默级别）
  await MessageService.notifyClassificationComplete(
    userId,
    bookmarkId,
    result.folderName || "未知文件夹",
    result.confidence,
    true,
  ).catch((err) => {
    logger.warn({ error: err }, "Failed to create classification message");
  });

  // 写入分类状态
  await updateBookmarkClassificationStatus(
    supabase,
    bookmarkId,
    userId,
    CLASSIFICATION_STATUS.CLASSIFIED,
    {
      folder_id: result.folderId,
      folder_name: result.folderName,
      confidence: result.confidence,
      method: "auto-classify",
      action: "select_existing",
      reason: result.reason,
    },
  );

  // 同步更新文件夹 Profile
  try {
    await updateFolderProfileAfterClassification(result.folderId, userId);
    logger.debug(
      { folderId: result.folderId, bookmarkId },
      "Classification: Folder profile updated synchronously",
    );
  } catch (profileErr) {
    logger.warn(
      {
        error:
          profileErr instanceof Error ? profileErr.message : String(profileErr),
        folderId: result.folderId,
      },
      "Classification: Folder profile update failed (non-blocking)",
    );
  }

  return {
    classified: true,
    folderId: result.folderId,
    folderName: result.folderName,
    confidence: result.confidence,
    action: "classify",
  };
}

/**
 * 处理中等置信度分类结果（创建建议）
 */
export async function handleMediumConfidenceClassification(
  supabase: SupabaseClient<Database>,
  bookmarkId: number,
  userId: string,
  title: string,
  result: ClassificationResult,
  trustMode: "full_auto" | "semi_auto" | "manual",
): Promise<ClassificationHandlerResult | null> {
  if (!result.folderId) {
    return null;
  }

  // Full Auto 模式：中等置信度也直接自动分类
  if (trustMode === "full_auto") {
    const { error: moveError } = await supabase
      .from("bookmarks")
      .update({
        folder_id: result.folderId,
        pending_cluster: false,
        pending_since: null,
        cluster_id: null,
        cluster_confidence: null,
      })
      .eq("id", bookmarkId)
      .eq("user_id", userId);

    if (moveError) {
      logger.error(
        { error: moveError, bookmarkId, folderId: result.folderId },
        "Classification: Failed to auto-classify (full_auto, medium confidence)",
      );
      return {
        classified: false,
        folderId: null,
        folderName: null,
        confidence: result.confidence,
        action: CLASSIFICATION_STATUS.INBOX,
      };
    }

    logger.info(
      {
        bookmarkId,
        folderId: result.folderId,
        folderName: result.folderName,
        confidence: result.confidence,
        trustMode: "full_auto",
      },
      "Classification: Auto-classified (full_auto mode, medium confidence)",
    );

    await MessageService.notifyClassificationComplete(
      userId,
      bookmarkId,
      result.folderName || "未知文件夹",
      result.confidence,
      true,
    ).catch((err) => {
      logger.warn({ error: err }, "Failed to create classification message");
    });

    await updateBookmarkClassificationStatus(
      supabase,
      bookmarkId,
      userId,
      CLASSIFICATION_STATUS.CLASSIFIED,
      {
        folder_id: result.folderId,
        folder_name: result.folderName,
        confidence: result.confidence,
        method: "full-auto",
        action: "select_existing",
        reason: `${result.reason || ""} (full_auto mode)`,
      },
    );

    return {
      classified: true,
      folderId: result.folderId,
      folderName: result.folderName,
      confidence: result.confidence,
      action: "classify",
    };
  }

  // Semi-auto 或 Manual 模式：创建确认消息
  const { data: suggestion, error: suggestionError } = await supabase
    .from("classification_suggestions")
    .insert({
      user_id: userId,
      bookmark_id: bookmarkId,
      suggested_folder_id: result.folderId,
      suggested_folder_name: result.folderName,
      suggest_new_folder: false,
      confidence: result.confidence,
      reason: result.reason,
      status: "pending",
      batch_id: crypto.randomUUID(),
    })
    .select("id")
    .single();

  if (suggestionError || !suggestion) {
    logger.error(
      { error: suggestionError, bookmarkId },
      "Classification: Failed to save suggestion",
    );
    return null;
  }

  logger.info(
    {
      bookmarkId,
      suggestionId: suggestion.id,
      folderId: result.folderId,
      folderName: result.folderName,
      confidence: result.confidence,
      trustMode,
    },
    "Classification: Saved suggestion (medium confidence)",
  );

  // 创建待确认记录（非 full_auto 模式）
  const { data: bookmarkData } = await supabase
    .from("bookmarks")
    .select("url")
    .eq("id", bookmarkId)
    .single();

  const confirmationSuggestion: ClassificationSuggestion = {
    folderId: result.folderId,
    folderName: result.folderName,
    confidence: Math.round(result.confidence),
    reason: result.reason || "基于内容相似度匹配",
    alternatives: [],
  };

  await confirmationService
    .createClassificationConfirmation({
      userId,
      bookmarkId,
      bookmarkTitle: title,
      bookmarkUrl: bookmarkData?.url || "",
      suggestion: confirmationSuggestion,
    })
    .catch((err) => {
      logger.warn(
        { error: err },
        "Failed to create classification confirmation",
      );
    });

  await updateBookmarkClassificationStatus(
    supabase,
    bookmarkId,
    userId,
    CLASSIFICATION_STATUS.SUGGESTED,
    {
      folder_id: result.folderId,
      folder_name: result.folderName,
      confidence: result.confidence,
      method: "suggestion",
      action: "select_existing",
      reason: result.reason,
    },
  );

  // 清除 pending_cluster 状态
  await supabase
    .from("bookmarks")
    .update({
      pending_cluster: false,
      pending_since: null,
    })
    .eq("id", bookmarkId)
    .eq("user_id", userId);

  return {
    classified: false,
    folderId: result.folderId,
    folderName: result.folderName,
    confidence: result.confidence,
    action: "classify",
    suggestionId: suggestion.id,
  };
}

/**
 * 处理低置信度分类结果（保留在收件箱）
 */
export async function handleLowConfidenceClassification(
  supabase: SupabaseClient<Database>,
  bookmarkId: number,
  userId: string,
  result: ClassificationResult,
): Promise<ClassificationHandlerResult> {
  logger.info(
    {
      bookmarkId,
      confidence: result.confidence,
      action: result.action,
    },
    "Classification: Staying in inbox (low confidence)",
  );

  // 标记为待聚类状态
  await supabase
    .from("bookmarks")
    .update({
      pending_cluster: true,
      pending_since: new Date().toISOString(),
    })
    .eq("id", bookmarkId)
    .eq("user_id", userId);

  logger.info(
    { bookmarkId, userId },
    "Classification: Marked as pending cluster for smart sorting",
  );

  await updateBookmarkClassificationStatus(
    supabase,
    bookmarkId,
    userId,
    CLASSIFICATION_STATUS.INBOX,
    {
      folder_id: null,
      folder_name: "待整理",
      confidence: result.confidence,
      method: "inbox-fallback",
      action: "inbox",
      reason: `置信度 ${result.confidence}% 低于阈值`,
    },
  );

  return {
    classified: false,
    folderId: null,
    folderName: null,
    confidence: result.confidence,
    action: CLASSIFICATION_STATUS.INBOX,
  };
}
