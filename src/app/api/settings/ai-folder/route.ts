/**
 * AI Folder Settings API
 * GET /api/settings/ai-folder - Get AI folder settings
 * PUT /api/settings/ai-folder - Update AI folder settings
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  handleValidationError,
} from "@/lib/utils/api-response";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { logger } from "@/lib/logger";

/**
 * AI folder settings schema
 */
const aiSettingsSchema = z.object({
  autonomy_level: z.number().int().min(1).max(3).optional(),
  enable_auto_create: z.boolean().optional(),
  enable_auto_split: z.boolean().optional(),
  enable_auto_merge: z.boolean().optional(),
  enable_auto_rename: z.boolean().optional(),
  create_notification: z.boolean().optional(),
  report_interval: z.enum(["weekly", "monthly", "never"]).optional(),
  daily_create_limit: z.number().int().min(1).max(20).optional(),
});

/**
 * GET /api/settings/ai-folder
 * Get user's AI folder settings
 */
export const GET = withAuthMiddleware(
  async (_request: NextRequest, { userId }) => {
    const supabase = await createClient();

    // Get settings using RPC function (with defaults) - V4.2 RPC
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = (await (supabase.rpc as any)(
      "get_ai_folder_settings",
      {
        p_user_id: userId,
      },
    )) as {
      data: Record<string, unknown> | null;
      error: { message: string } | null;
    };

    if (error) {
      logger.error(
        { error: error.message },
        "GET /api/settings/ai-folder: Failed to get settings",
      );
      throw new Error("获取设置失败");
    }

    return successResponse({
      settings: data,
    });
  },
);

/**
 * PUT /api/settings/ai-folder
 * Update user's AI folder settings
 */
export const PUT = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const supabase = await createClient();

    // Validate request body
    const body = await request.json();
    const validation = aiSettingsSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    // Update settings using RPC function - V4.2 RPC
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = (await (supabase.rpc as any)(
      "update_ai_folder_settings",
      {
        p_user_id: userId,
        p_settings: validation.data,
      },
    )) as {
      data: Record<string, unknown> | null;
      error: { message: string } | null;
    };

    if (error) {
      logger.error(
        { error: error.message },
        "PUT /api/settings/ai-folder: Failed to update settings",
      );
      throw new Error("更新设置失败");
    }

    logger.info(
      { userId, settings: validation.data },
      "AI folder settings updated",
    );

    return successResponse({
      settings: data,
      message: "设置已保存",
    });
  },
);
