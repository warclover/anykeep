/**
 * Merge Suggestions API
 * GET /api/folder-evolution/merge-suggestions - Get folders that can be merged
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  internalError,
  badRequestError,
  safeParseInt,
} from "@/lib/utils/api-response";
import { mergeService } from "@/lib/classification/services/merge.service";
import { logger } from "@/lib/logger";

/**
 * GET /api/folder-evolution/merge-suggestions
 * Get folder pairs that are candidates for merging
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // Get folder IDs from query params (optional - for specific pair analysis)
    const { searchParams } = new URL(request.url);
    const folderIdsParam = searchParams.get("folderIds");

    if (folderIdsParam) {
      // Analyze specific folders
      const parsedIds = folderIdsParam
        .split(",")
        .map((id) => safeParseInt(id.trim()))
        .filter((id): id is number => id !== null);

      if (parsedIds.length === 0) {
        return badRequestError("无效的文件夹 ID 参数");
      }

      const suggestion = await mergeService.getMergeSuggestion(
        user.id,
        parsedIds,
      );

      return successResponse({
        suggestion,
      });
    }

    // Get all merge candidates
    const candidates = await mergeService.getMergeCandidates(user.id);

    return successResponse({
      candidates: candidates.map((c) => ({
        folder1: {
          id: c.folder1.folderId,
          name: c.folder1.name,
          bookmarkCount: c.folder1.bookmarkCount,
        },
        folder2: {
          id: c.folder2.folderId,
          name: c.folder2.name,
          bookmarkCount: c.folder2.bookmarkCount,
        },
        similarity: c.similarity,
        tagOverlap: c.tagOverlap,
        suggestedName: c.mergedName,
        reason: c.reason,
      })),
      candidateCount: candidates.length,
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "GET /api/folder-evolution/merge-suggestions error",
    );
    return internalError("获取合并建议失败");
  }
}
