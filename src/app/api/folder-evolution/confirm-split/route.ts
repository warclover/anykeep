/**
 * Confirm Split API
 * POST /api/folder-evolution/confirm-split - Execute folder split
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
  internalError,
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
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // Validate request body
    const body = await request.json();
    const validation = confirmSplitSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { folderId, subClusters } = validation.data;

    // Execute split
    const result = await splitService.executeSplit(
      user.id,
      folderId,
      subClusters,
    );

    if (!result.success) {
      return internalError(result.message);
    }

    logger.info(
      {
        userId: user.id,
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
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "POST /api/folder-evolution/confirm-split error",
    );
    return internalError("分拆文件夹失败");
  }
}
