/**
 * 重分类执行 API
 * POST /api/reclassify
 *
 * 对待整理文件夹中的书签执行 AI 重分类，生成分类建议
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
  badRequestError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import type { ClassificationSuggestionInsert } from "@/types/supabase";
import {
  recommendFolder,
  type FolderRecommendation,
} from "@/lib/utils/ai-generator";

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
export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 2. 解析请求体
    const body = await request.json().catch(() => ({}));
    const validation = reclassifySchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { limit, forceRun } = validation.data;

    // 3. 检查是否有待处理的建议
    const { data: pendingCount } = await supabase.rpc(
      "get_pending_suggestions_count",
      {
        p_user_id: user.id,
      },
    );

    if ((pendingCount ?? 0) > 0 && !forceRun) {
      return badRequestError(
        "已有待处理的分类建议，请先处理后再执行新的重分类",
      );
    }

    // 4. 获取待整理文件夹
    const { data: inboxFolder, error: folderError } = await supabase
      .from("folders")
      .select("id")
      .eq("user_id", user.id)
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

    // 5. 获取待整理文件夹中的书签
    const { data: bookmarks, error: bookmarksError } = await supabase
      .from("bookmarks")
      .select("id, title, ai_summary, ai_tags")
      .eq("user_id", user.id)
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

    // 6. 获取用户的所有文件夹（供 AI 推荐使用）
    const { data: folders } = await supabase
      .from("folders")
      .select("id, name, is_system")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .eq("is_system", false)
      .order("name");

    // 7. 生成批次 ID
    const batchId = uuidv4();

    // 8. 为每个书签获取 AI 推荐
    const suggestions: ClassificationSuggestionInsert[] = [];
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
          suggestions.push({
            user_id: user.id,
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

    // 9. 批量插入建议
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

    // 10. 更新用户的重分类设置（记录本次执行时间）
    const { data: profile } = await supabase
      .from("profiles")
      .select("settings")
      .eq("id", user.id)
      .single();

    const currentSettings =
      (profile?.settings as Record<string, unknown>) || {};
    const updatedSettings = {
      ...currentSettings,
      reclassify: {
        ...((currentSettings.reclassify as Record<string, unknown>) || {}),
        last_run_at: new Date().toISOString(),
      },
    };

    await supabase
      .from("profiles")
      .update({ settings: updatedSettings })
      .eq("id", user.id);

    logger.info(
      {
        userId: user.id,
        batchId,
        processed: bookmarks.length,
        suggestionsCreated: suggestions.length,
      },
      "Reclassification completed",
    );

    return successResponse({
      processed: bookmarks.length,
      suggestionsCreated: suggestions.length,
      batchId,
      message:
        suggestions.length > 0
          ? `已为 ${suggestions.length} 个书签生成分类建议`
          : "没有找到合适的分类建议",
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "POST /api/reclassify error",
    );
    return internalError("执行重分类失败");
  }
}

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
