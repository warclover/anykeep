/**
 * 重分类执行 API
 * POST /api/reclassify
 *
 * 对待整理文件夹中的书签执行 AI 重分类
 * - 完全托管模式：直接移动书签到目标文件夹
 * - 半托管/不托管模式：生成分类建议等待确认
 *
 * @updated 2026-03-07 - 迁移到 withAuthMiddleware
 */

import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import {
  successResponse,
  handleValidationError,
  badRequestError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { recommendFolder, type FolderRecommendation } from "@/lib/ai-generator";
import { TrustModeService } from "@/lib/trust-mode/trust-mode.service";
import { Notify } from "@/lib/notifications/server";
import type { Database, ProfileSettings } from "@/types/supabase";
import { withAuthMiddleware } from "@/lib/api/middleware";

// 请求体验证
const reclassifySchema = z.object({
  limit: z.number().int().min(1).max(50).default(20),
  forceRun: z.boolean().default(false),
});

// FolderRecommendation 类型从 ai-generator 导入

/**
 * POST /api/reclassify
 * 执行重分类，为待整理文件夹中的书签生成分类建议
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  const supabase = await createClient();

  // 1. 解析请求体
  const body = await request.json().catch(() => ({}));
  const validation = reclassifySchema.safeParse(body);

  if (!validation.success) {
    return handleValidationError(validation.error);
  }

  const { limit, forceRun } = validation.data;

  // 2. 检查是否有待处理的建议
  const { data: pendingCount } = await supabase.rpc(
    "get_pending_suggestions_count",
    {
      p_user_id: userId,
    },
  );

  if ((pendingCount ?? 0) > 0 && !forceRun) {
    return badRequestError("已有待处理的分类建议，请先处理后再执行新的重分类");
  }

  // 3. 获取待整理文件夹
  const { data: inboxFolder, error: folderError } = await supabase
    .from("folders")
    .select("id")
    .eq("user_id", userId)
    .eq("is_system", true)
    .eq("system_type", "INBOX")
    .is("deleted_at", null)
    .single();

  if (folderError || !inboxFolder) {
    return successResponse({
      processed: 0,
      suggestions: [],
      message: "待整理文件夹为空或不存在",
    });
  }

  // 4. 获取待整理文件夹中的书签
  const { data: bookmarks, error: bookmarksError } = await supabase
    .from("bookmarks")
    .select("id, title, ai_summary, ai_tags")
    .eq("user_id", userId)
    .eq("folder_id", inboxFolder.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (bookmarksError) {
    logger.error(
      { error: bookmarksError.message },
      "Failed to fetch bookmarks",
    );
    return internalError("获取书签失败");
  }

  if (!bookmarks || bookmarks.length === 0) {
    return successResponse({
      processed: 0,
      suggestions: [],
      message: "待整理文件夹为空",
    });
  }

  // 5. 获取用户的所有文件夹（供 AI 推荐使用）
  const { data: folders } = await supabase
    .from("folders")
    .select("id, name, is_system")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .eq("is_system", false)
    .order("name");

  // 6. 获取用户的托管模式
  const trustModeService = new TrustModeService();
  const trustMode = await trustModeService.getUserTrustMode(userId);
  const isFullAuto = trustMode === "full_auto";

  // 7. 生成批次 ID
  const batchId = uuidv4();

  // 8. 为每个书签获取 AI 推荐
  // 使用 Database 类型定义的 Insert 类型
  type SuggestionInsert =
    Database["public"]["Tables"]["classification_suggestions"]["Insert"];
  const suggestions: SuggestionInsert[] = [];
  const directMoves: Array<{ bookmarkId: number; folderId: number }> = [];
  const results: Array<{
    bookmarkId: number;
    bookmarkTitle: string;
    recommendation: FolderRecommendation | null;
  }> = [];

  for (const bookmark of bookmarks) {
    try {
      // 调用 AI 推荐 API
      const recommendation = await getAIRecommendation(
        bookmark.title,
        bookmark.ai_summary || "",
        bookmark.ai_tags || [],
        (folders || []).map((f) => ({
          ...f,
          is_system: f.is_system ?? false,
        })),
      );

      if (recommendation && recommendation.confidence >= 40) {
        if (
          isFullAuto &&
          recommendation.folderId &&
          !recommendation.suggestNew
        ) {
          // 完全托管模式：直接移动（只针对已有文件夹）
          directMoves.push({
            bookmarkId: bookmark.id,
            folderId: recommendation.folderId,
          });
        } else {
          // 其他模式或需要创建新文件夹：生成建议
          suggestions.push({
            user_id: userId,
            bookmark_id: bookmark.id,
            suggested_folder_id: recommendation.folderId,
            suggested_folder_name: recommendation.folderName,
            suggest_new_folder: recommendation.suggestNew,
            confidence: recommendation.confidence,
            reason: recommendation.reason,
            status: "pending",
            batch_id: batchId,
          });
        }
      }

      results.push({
        bookmarkId: bookmark.id,
        bookmarkTitle: bookmark.title,
        recommendation,
      });
    } catch (error) {
      logger.error(
        {
          bookmarkId: bookmark.id,
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to get AI recommendation for bookmark",
      );
      results.push({
        bookmarkId: bookmark.id,
        bookmarkTitle: bookmark.title,
        recommendation: null,
      });
    }
  }

  // 9. 完全托管模式：直接移动书签
  let movedCount = 0;
  if (directMoves.length > 0) {
    for (const move of directMoves) {
      const { error: moveError } = await supabase
        .from("bookmarks")
        .update({ folder_id: move.folderId })
        .eq("id", move.bookmarkId)
        .eq("user_id", userId);

      if (!moveError) {
        movedCount++;
      } else {
        logger.error(
          { bookmarkId: move.bookmarkId, error: moveError.message },
          "Failed to move bookmark",
        );
      }
    }
  }

  // 10. 批量插入建议（仅非完全托管模式，或需要创建新文件夹的情况）
  if (suggestions.length > 0) {
    const { error: insertError } = await supabase
      .from("classification_suggestions")
      .insert(suggestions);

    if (insertError) {
      logger.error(
        { error: insertError.message },
        "Failed to insert suggestions",
      );
      return internalError("保存分类建议失败");
    }
  }

  // 11. 更新用户的重分类设置（记录本次执行时间）
  const { data: profile } = await supabase
    .from("profiles")
    .select("settings")
    .eq("id", userId)
    .single();

  const currentSettings = (profile?.settings as Record<string, unknown>) || {};
  const updatedSettings: ProfileSettings = {
    ...currentSettings,
    reclassify: {
      ...((currentSettings?.reclassify as Record<string, unknown>) || {}),
      last_run_at: new Date().toISOString(),
    },
  };

  await supabase
    .from("profiles")
    .update({ settings: updatedSettings })
    .eq("id", userId);

  // 12. 创建消息通知
  if (bookmarks.length > 0) {
    if (movedCount > 0) {
      await Notify.classificationBatch(
        userId,
        movedCount,
        "目标文件夹",
        batchId,
      );
    }
    if (suggestions.length > 0) {
      await Notify.custom(
        userId,
        "ai.classification.batch",
        "分类建议已生成",
        `${suggestions.length} 个书签需要确认分类`,
        {
          actionUrl: "/messages/pending",
          actionLabel: "查看建议",
          metadata: { batchId, suggestionsCount: suggestions.length },
        },
      );
    }
  }

  logger.info(
    {
      userId,
      batchId,
      processed: bookmarks.length,
      movedCount,
      suggestionsCreated: suggestions.length,
      isFullAuto,
    },
    "Reclassification completed",
  );

  // 构建返回消息
  let message = "";
  if (isFullAuto) {
    if (movedCount > 0 && suggestions.length > 0) {
      message = `已移动 ${movedCount} 个书签，另有 ${suggestions.length} 个需要确认`;
    } else if (movedCount > 0) {
      message = `已成功移动 ${movedCount} 个书签到目标文件夹`;
    } else if (suggestions.length > 0) {
      message = `已为 ${suggestions.length} 个书签生成分类建议`;
    } else {
      message = "没有找到合适的分类建议";
    }
  } else {
    message =
      suggestions.length > 0
        ? `已为 ${suggestions.length} 个书签生成分类建议`
        : "没有找到合适的分类建议";
  }

  return successResponse({
    processed: bookmarks.length,
    movedCount,
    suggestionsCreated: suggestions.length,
    batchId,
    isFullAuto,
    message,
  });
});

/**
 * 获取 AI 推荐的文件夹
 * 直接调用 recommendFolder 函数，避免 HTTP 内部调用
 */
async function getAIRecommendation(
  title: string,
  summary: string,
  tags: string[],
  existingFolders: Array<{ id: number; name: string; is_system: boolean }>,
): Promise<FolderRecommendation | null> {
  try {
    // 直接调用 recommendFolder 函数（重构：移除 HTTP 内部调用）
    const recommendation = await recommendFolder(
      title,
      summary,
      tags,
      existingFolders.map((f) => ({
        id: f.id,
        name: f.name,
      })),
    );
    return recommendation;
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "AI recommendation failed",
    );
    return null;
  }
}
