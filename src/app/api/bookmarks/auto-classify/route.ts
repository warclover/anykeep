/**
 * 自动分类 API
 * POST /api/bookmarks/auto-classify
 *
 * V4.2 智能分类系统核心接口
 * 根据 AI 推荐置信度自动决定分类行为
 *
 * @deprecated V3.1 - 此 API 已废弃
 * 分类逻辑已移至后端 V3 系统 (classifyBookmarkV2)，在 AI 内容生成后自动执行
 * 前端通过 useClassificationPolling 轮询获取分类结果
 * 保留此 API 是为了向后兼容，将在未来版本中移除
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
  databaseError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import {
  CONFIDENCE_THRESHOLDS,
  getOrCreateInboxFolder,
} from "@/lib/utils/auto-classify";

/**
 * 请求体验证 Schema
 */
const autoClassifySchema = z.object({
  bookmarkId: z.number().int().positive(),
  recommendation: z
    .object({
      folderId: z.number().int().positive().nullable(),
      folderName: z.string(),
      confidence: z.number().min(0).max(100),
      reason: z.string(),
      suggestNew: z.boolean(),
    })
    .nullable(),
});

/**
 * POST /api/bookmarks/auto-classify
 *
 * 根据置信度自动处理书签分类：
 * - ≥80%: 自动归类到推荐文件夹
 * - 60-79%: 返回需要用户确认
 * - <60%: 自动归类到"待整理"文件夹
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

    // 2. 解析并验证请求体
    const body = await request.json();
    const validation = autoClassifySchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { bookmarkId, recommendation } = validation.data;

    // 3. 验证书签属于当前用户
    const { data: bookmark, error: bookmarkError } = await supabase
      .from("bookmarks")
      .select("id, folder_id")
      .eq("id", bookmarkId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (bookmarkError || !bookmark) {
      return databaseError("书签不存在或无权访问");
    }

    // 4. 根据置信度决定行为
    let action: "auto" | "recommend" | "inbox";
    let targetFolderId: number | null = null;
    let targetFolderName: string = "";
    let message: string = "";

    // 无推荐数据：放入待整理
    if (!recommendation) {
      action = "inbox";
      targetFolderId = await getOrCreateInboxFolder(user.id);
      targetFolderName = "待整理";
      message = '已移动到"待整理"文件夹';
    } else {
      const { confidence, folderId, folderName, suggestNew } = recommendation;

      // 高置信度 (≥80%)：自动归类
      if (confidence >= CONFIDENCE_THRESHOLDS.AUTO_CLASSIFY) {
        action = "auto";

        if (folderId) {
          // 使用现有文件夹
          targetFolderId = folderId;
          targetFolderName = folderName;
        } else if (suggestNew && folderName) {
          // 自动创建新文件夹
          const { data: newFolder, error: createError } = await supabase
            .from("folders")
            .insert({
              user_id: user.id,
              name: folderName,
              sort_order: 0,
            })
            .select("id")
            .single();

          if (createError) {
            logger.error(
              { error: createError.message, folderName },
              "Auto Classify: Failed to create folder",
            );
            // 创建失败则放入待整理
            action = "inbox";
            targetFolderId = await getOrCreateInboxFolder(user.id);
            targetFolderName = "待整理";
            message = '创建文件夹失败，已移动到"待整理"';
          } else {
            targetFolderId = newFolder.id;
            targetFolderName = folderName;
            message = `已创建并移动到「${folderName}」`;
          }
        } else {
          // 无法确定目标，放入待整理
          action = "inbox";
          targetFolderId = await getOrCreateInboxFolder(user.id);
          targetFolderName = "待整理";
          message = '已移动到"待整理"文件夹';
        }

        if (action === "auto") {
          message = `已自动归类到「${targetFolderName}」`;
        }
      }
      // 中等置信度 (60-79%)：返回需要用户确认
      else if (confidence >= CONFIDENCE_THRESHOLDS.SHOW_RECOMMENDATION) {
        action = "recommend";
        // 不执行任何操作，让前端显示推荐 toast
        return successResponse({
          action: "recommend",
          recommendation,
          message: "请确认是否移动到推荐文件夹",
        });
      }
      // 低置信度 (<60%)：放入待整理
      else {
        action = "inbox";
        targetFolderId = await getOrCreateInboxFolder(user.id);
        targetFolderName = "待整理";
        message = '已移动到"待整理"文件夹';
      }
    }

    // 5. 执行移动操作（auto 或 inbox）
    if (targetFolderId !== null) {
      const { error: updateError } = await supabase
        .from("bookmarks")
        .update({ folder_id: targetFolderId })
        .eq("id", bookmarkId)
        .eq("user_id", user.id);

      if (updateError) {
        logger.error(
          { error: updateError.message, bookmarkId, targetFolderId },
          "Auto Classify: Failed to update bookmark",
        );
        return databaseError("移动书签失败");
      }

      logger.info(
        {
          bookmarkId,
          targetFolderId,
          targetFolderName,
          action,
          confidence: recommendation?.confidence,
        },
        "Auto Classify: Bookmark classified",
      );
    }

    return successResponse({
      action,
      folderId: targetFolderId,
      folderName: targetFolderName,
      message,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "POST /api/bookmarks/auto-classify error",
    );
    return internalError("自动分类失败");
  }
}
