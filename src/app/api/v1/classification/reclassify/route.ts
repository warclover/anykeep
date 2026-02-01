/**
 * Reclassification API v1
 *
 * POST /api/v1/classification/reclassify - 执行重分类
 *
 * 对待整理文件夹中的书签执行 AI 重分类：
 * - 完全托管模式：直接移动书签到目标文件夹
 * - 半托管/不托管模式：生成分类建议等待确认
 *
 * @module api/v1/classification/reclassify
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { withAuthMiddleware } from "@/lib/api/middleware";
import type { ClassificationSuggestionInsert } from "@/types/supabase";
import { recommendFolder, type FolderRecommendation } from "@/lib/ai-generator";
import { TrustModeService } from "@/lib/trust-mode/trust-mode.service";
import { Notify } from "@/lib/notifications";

// 请求体 Schema
const ReclassifySchema = z.object({
  limit: z.number().int().min(1).max(50).default(20),
  forceRun: z.boolean().default(false),
});

/**
 * POST /api/v1/classification/reclassify
 * 执行重分类
 */
export const POST = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const supabase = await createClient();

    // 解析请求体
    const body = await request.json().catch(() => ({}));
    const validation = ReclassifySchema.safeParse(body);

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

    const { limit, forceRun } = validation.data;

    // 检查是否有待处理的建议
    // 使用 rpc 返回类型泛型
    const { data: pendingCount } = await supabase.rpc(
      "get_pending_suggestions_count",
      {
        p_user_id: userId,
      },
    );

    if ((pendingCount ?? 0) > 0 && !forceRun) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "PENDING_EXISTS",
            message: "已有待处理的分类建议，请先处理后再执行新的重分类",
          },
        },
        { status: 400 },
      );
    }

    // 获取待整理文件夹
    const { data: inboxFolder, error: folderError } = await supabase
      .from("folders")
      .select("id")
      .eq("user_id", userId)
      .eq("is_system", true)
      .eq("system_type", "INBOX")
      .is("deleted_at", null)
      .single();

    if (folderError || !inboxFolder) {
      return NextResponse.json({
        success: true,
        data: {
          processed: 0,
          movedCount: 0,
          suggestionsCreated: 0,
          message: "待整理文件夹为空或不存在",
        },
      });
    }

    // 获取待整理文件夹中的书签
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
        "[v1] Failed to fetch bookmarks for reclassify",
      );
      return NextResponse.json(
        {
          success: false,
          error: { code: "INTERNAL_ERROR", message: "获取书签失败" },
        },
        { status: 500 },
      );
    }

    if (!bookmarks || bookmarks.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          processed: 0,
          movedCount: 0,
          suggestionsCreated: 0,
          message: "待整理文件夹为空",
        },
      });
    }

    // 获取用户的所有文件夹
    const { data: folders } = await supabase
      .from("folders")
      .select("id, name, is_system")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .eq("is_system", false)
      .order("name");

    // 获取用户的托管模式
    const trustModeService = new TrustModeService();
    const trustMode = await trustModeService.getUserTrustMode(userId);
    const isFullAuto = trustMode === "full_auto";

    // 生成批次 ID
    const batchId = uuidv4();

    // 为每个书签获取 AI 推荐
    const suggestions: ClassificationSuggestionInsert[] = [];
    const directMoves: Array<{ bookmarkId: number; folderId: number }> = [];

    for (const bookmark of bookmarks) {
      try {
        const recommendation = await getAIRecommendation(
          bookmark.title || "",
          bookmark.ai_summary || "",
          bookmark.ai_tags || [],
          (folders || []).map((f) => ({
            id: f.id,
            name: f.name,
            is_system: f.is_system ?? false,
          })),
        );

        if (recommendation && recommendation.confidence >= 40) {
          if (
            isFullAuto &&
            recommendation.folderId &&
            !recommendation.suggestNew
          ) {
            directMoves.push({
              bookmarkId: bookmark.id,
              folderId: recommendation.folderId,
            });
          } else {
            // 不使用 ClassificationSuggestionInsert 类型，直接定义插入数据
            suggestions.push({
              user_id: userId,
              bookmark_id: bookmark.id,
              suggested_folder_id: recommendation.folderId || null,
              suggest_new_folder: recommendation.suggestNew,
              confidence: recommendation.confidence,
              reason: recommendation.reason,
              status: "pending",
              batch_id: batchId,
            } as ClassificationSuggestionInsert);
          }
        }
      } catch (error) {
        logger.error(
          {
            bookmarkId: bookmark.id,
            error: error instanceof Error ? error.message : String(error),
          },
          "[v1] Failed to get AI recommendation for bookmark",
        );
      }
    }

    // 完全托管模式：直接移动书签
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
            "[v1] Failed to move bookmark",
          );
        }
      }
    }

    // 批量插入建议
    if (suggestions.length > 0) {
      const { error: insertError } = await supabase
        .from("classification_suggestions")
        .insert(suggestions);

      if (insertError) {
        logger.error(
          { error: insertError.message },
          "[v1] Failed to insert suggestions",
        );
        return NextResponse.json(
          {
            success: false,
            error: { code: "INTERNAL_ERROR", message: "保存分类建议失败" },
          },
          { status: 500 },
        );
      }
    }

    // 更新用户的重分类设置
    const { data: profile } = await supabase
      .from("profiles")
      .select("settings")
      .eq("id", userId)
      .single();

    const currentSettings =
      (profile?.settings as Record<string, unknown>) || {};
    const updatedSettings = {
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

    // 创建消息通知
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
      "[v1] Reclassification completed",
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

    return NextResponse.json({
      success: true,
      data: {
        processed: bookmarks.length,
        movedCount,
        suggestionsCreated: suggestions.length,
        batchId,
        isFullAuto,
        message,
      },
    });
  },
);

/**
 * 获取 AI 推荐的文件夹
 */
async function getAIRecommendation(
  title: string,
  summary: string,
  tags: string[],
  existingFolders: Array<{ id: number; name: string; is_system: boolean }>,
): Promise<FolderRecommendation | null> {
  try {
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
      "[v1] AI recommendation failed",
    );
    return null;
  }
}
