/**
 * Split Suggestions API
 * GET /api/folder-evolution/split-suggestions - Get folders that can be split
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
import { splitService } from "@/lib/classification/services/split.service";
import { logger } from "@/lib/logger";

/**
 * GET /api/folder-evolution/split-suggestions
 * Get folders that are candidates for splitting
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

    // Get folder ID from query params (optional - for specific folder analysis)
    const { searchParams } = new URL(request.url);
    const folderIdParam = searchParams.get("folderId");

    if (folderIdParam) {
      const folderId = safeParseInt(folderIdParam);
      if (folderId === null) {
        return badRequestError("无效的文件夹 ID");
      }

      // Analyze specific folder
      const suggestion = await splitService.analyzeSplitOptions(
        user.id,
        folderId,
      );

      return successResponse({
        suggestion,
      });
    }

    // Get all split candidates
    const candidates = await splitService.getSplitCandidates(user.id);

    // For each candidate, get detailed analysis
    const suggestions = await Promise.all(
      candidates.slice(0, 5).map(async (candidate) => {
        const analysis = await splitService.analyzeSplitOptions(
          user.id,
          candidate.id,
        );
        return analysis;
      }),
    );

    return successResponse({
      suggestions: suggestions.filter(Boolean),
      candidateCount: candidates.length,
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "GET /api/folder-evolution/split-suggestions error",
    );
    return internalError("获取分拆建议失败");
  }
}
