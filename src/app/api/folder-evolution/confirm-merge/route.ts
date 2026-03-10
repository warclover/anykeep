/**
 * Confirm Merge API
 * POST /api/folder-evolution/confirm-merge - Execute folder merge
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { withAuthMiddleware } from "@/lib/api/middleware";
import {
  successResponse,
  handleValidationError,
  internalError,
  badRequestError,
  safeParseJson,
} from "@/lib/utils/api-response";
import { mergeService } from "@/lib/folder-evolution";
import { logger } from "@/lib/logger";

/**
 * Request body schema
 */
const confirmMergeSchema = z.object({
  sourceFolderIds: z.array(z.number().int().positive()).min(1).max(10),
  targetFolderId: z.number().int().positive(),
  newName: z.string().min(1).max(100).optional(),
});

/**
 * POST /api/folder-evolution/confirm-merge
 * Execute folder merge based on user confirmation
 */
export const POST = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    // Validate request body
    const { data: body, error: parseError } = await safeParseJson(request);
    if (parseError) {
      return badRequestError(parseError);
    }
    const validation = confirmMergeSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { sourceFolderIds, targetFolderId, newName } = validation.data;

    // Ensure target is not in source list
    const filteredSourceIds = sourceFolderIds.filter(
      (id) => id !== targetFolderId,
    );

    if (filteredSourceIds.length === 0) {
      return internalError("至少需要一个源文件夹");
    }

    // Execute merge
    const result = await mergeService.executeMerge(
      userId,
      filteredSourceIds,
      targetFolderId,
      newName,
    );

    if (!result.success) {
      return internalError(result.message);
    }

    logger.info(
      {
        userId,
        sourceFolderIds: filteredSourceIds,
        targetFolderId,
        mergedCount: result.mergedCount,
      },
      "Folder merge completed",
    );

    return successResponse({
      success: true,
      message: result.message,
      targetFolderId: result.targetFolderId,
      mergedCount: result.mergedCount,
    });
  },
);
