/**
 * Merge Suggestions API
 * GET /api/folder-evolution/merge-suggestions - Get folders that can be merged
 */

import type { NextRequest } from "next/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import {
  successResponse,
  badRequestError,
  safeParseInt,
} from "@/lib/utils/api-response";
import { mergeService } from "@/lib/folder-evolution";

/**
 * GET /api/folder-evolution/merge-suggestions
 * Get folder pairs that are candidates for merging
 */
export const GET = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
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
        userId,
        parsedIds,
      );

      return successResponse({
        suggestion,
      });
    }

    // Get all merge candidates
    const candidates = await mergeService.getMergeCandidates(userId);

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
  },
);
