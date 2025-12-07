/**
 * AI 文件夹推荐 API
 * POST /api/ai/recommend-folder - 根据内容推荐文件夹
 *
 * @deprecated V3.1 - 此 API 已废弃
 * 前端不再主动调用此 API，分类逻辑已移至后端 V3 系统 (classifyBookmarkV2)
 * 前端通过 useClassificationPolling 轮询获取分类结果
 * 保留此 API 是为了向后兼容，将在未来版本中移除
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  recommendFolder,
  type FolderRecommendation,
} from "@/lib/utils/ai-generator";
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
  databaseError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";

/**
 * 请求体验证 Schema
 */
const recommendFolderSchema = z.object({
  title: z.string().min(1, "标题不能为空").max(500),
  summary: z.string().max(1000).optional().default(""),
  tags: z.array(z.string()).max(10).optional().default([]),
});

/**
 * POST /api/ai/recommend-folder
 * 根据收藏内容推荐合适的文件夹
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
      return unauthorizedError("请先登录");
    }

    // 2. 解析并验证请求体
    const body = await request.json();
    const validation = recommendFolderSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { title, summary, tags } = validation.data;

    // 3. 获取用户的所有文件夹（排除系统文件夹，包含 folder_profiles 用于 AI 上下文）
    const { data: folders, error: foldersError } = await supabase
      .from("folders")
      .select(
        `
        id,
        name,
        folder_profiles(top_tags, bookmark_count)
      `,
      )
      .eq("user_id", user.id)
      .eq("is_system", false) // 排除系统文件夹
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (foldersError) {
      return databaseError("获取文件夹列表失败", foldersError);
    }

    // 4. 转换为增强的文件夹信息（包含 top_tags 用于 AI 推荐）
    const enrichedFolders = (folders || []).map((folder) => {
      // folder_profiles 是一对一关系，但 Supabase 返回数组
      const profile = Array.isArray(folder.folder_profiles)
        ? folder.folder_profiles[0]
        : folder.folder_profiles;
      return {
        id: folder.id,
        name: folder.name,
        topTags: (profile?.top_tags as string[] | null) || [],
        bookmarkCount: profile?.bookmark_count || 0,
      };
    });

    // 5. 调用 AI 推荐
    const recommendation: FolderRecommendation = await recommendFolder(
      title,
      summary,
      tags,
      enrichedFolders,
    );

    logger.info(
      {
        userId: user.id,
        title: title.substring(0, 50),
        recommendation: {
          folderId: recommendation.folderId,
          folderName: recommendation.folderName,
          confidence: recommendation.confidence,
          suggestNew: recommendation.suggestNew,
        },
      },
      "AI folder recommendation completed",
    );

    // 5. 返回推荐结果
    return successResponse(recommendation);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "POST /api/ai/recommend-folder error",
    );
    return internalError("文件夹推荐失败");
  }
}
