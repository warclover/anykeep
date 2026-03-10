/**
 * Split Suggestions API
 * GET /api/folder-evolution/split-suggestions - Get folders that can be split
 */

import type { NextRequest } from "next/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import {
  successResponse,
  badRequestError,
  safeParseInt,
} from "@/lib/utils/api-response";
import { splitService } from "@/lib/folder-evolution";

/**
 * GET /api/folder-evolution/split-suggestions
 * Get folders that are candidates for splitting
 */
export const GET = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
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
        userId,
        folderId,
      );

      return successResponse({
        suggestion,
      });
    }

    // Get all split candidates
    const candidates = await splitService.getSplitCandidates(userId);

    // For each candidate, get detailed analysis
    const suggestions = await Promise.all(
      candidates.slice(0, 5).map(async (candidate) => {
        const analysis = await splitService.analyzeSplitOptions(
          userId,
          candidate.id,
        );
        return analysis;
      }),
    );

    return successResponse({
      suggestions: suggestions.filter(Boolean),
      candidateCount: candidates.length,
    });
  },
);
