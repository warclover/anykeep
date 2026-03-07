/**
 * Confirm Split API
 * POST /api/folder-evolution/confirm-split - Execute folder split
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
import { splitService } from "@/lib/classification/services/split.service";
import { logger } from "@/lib/logger";

/**
 * Request body schema
 */
const confirmSplitSchema = z.object({
  folderId: z.number().int().positive(),
  subClusters: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        bookmarkIds: z.array(z.number().int().positive()),
      }),
    )
    .min(2)
    .max(10),
});

/**
 * POST /api/folder-evolution/confirm-split
 * Execute folder split based on user confirmation
 */
export const POST = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    // Validate request body
    const { data: body, error: parseError } = await safeParseJson(request);
    if (parseError) {
      return badRequestError(parseError);
    }
    const validation = confirmSplitSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { folderId, subClusters } = validation.data;

    // Execute split
    const result = await splitService.executeSplit(
      userId,
      folderId,
      subClusters,
    );

    if (!result.success) {
      return internalError(result.message);
    }

    logger.info(
      {
        userId,
        folderId,
        newFoldersCount: result.newFolders?.length,
      },
      "Folder split completed",
    );

    return successResponse({
      success: true,
      message: result.message,
      newFolders: result.newFolders,
    });
  },
);
