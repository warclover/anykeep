/**
 * AI Folder Settings API
 * GET /api/settings/ai-folder - Get AI folder settings
 * PUT /api/settings/ai-folder - Update AI folder settings
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { v42Rpc } from "@/lib/supabase/v42-types";
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
  internalError,
} from "@/lib/utils/api-response";
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
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // Get settings using RPC function (with defaults) - V4.2 RPC
    const { data, error } = await v42Rpc(supabase).rpc("get_ai_folder_settings", {
      p_user_id: user.id,
    });

    if (error) {
      logger.error(
        { error: error.message },
        "GET /api/settings/ai-folder: Failed to get settings",
      );
      return internalError("获取设置失败");
    }

    return successResponse({
      settings: data,
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "GET /api/settings/ai-folder error",
    );
    return internalError("获取设置失败");
  }
}

/**
 * PUT /api/settings/ai-folder
 * Update user's AI folder settings
 */
export async function PUT(request: NextRequest) {
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
    const validation = aiSettingsSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    // Update settings using RPC function - V4.2 RPC
    const { data, error } = await v42Rpc(supabase).rpc("update_ai_folder_settings", {
      p_user_id: user.id,
      p_settings: validation.data,
    });

    if (error) {
      logger.error(
        { error: error.message },
        "PUT /api/settings/ai-folder: Failed to update settings",
      );
      return internalError("更新设置失败");
    }

    logger.info(
      { userId: user.id, settings: validation.data },
      "AI folder settings updated",
    );

    return successResponse({
      settings: data,
      message: "设置已保存",
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "PUT /api/settings/ai-folder error",
    );
    return internalError("更新设置失败");
  }
}
