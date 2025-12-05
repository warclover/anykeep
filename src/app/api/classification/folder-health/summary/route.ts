/**
 * Folder Health Quick Summary API
 * GET /api/classification/folder-health/summary - Get quick health summary
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  FolderProfileRepository,
  SuggestionRepository,
} from "@/lib/classification/repositories";
import { FolderHealthService } from "@/lib/classification/services";
import { logger } from "@/lib/logger";

/**
 * GET - Get quick folder health summary
 * This is a lightweight version that doesn't calculate detailed suggestions
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "请先登录" },
        },
        { status: 401 },
      );
    }

    // Initialize services
    const folderProfileRepo = new FolderProfileRepository(supabase);
    const suggestionRepo = new SuggestionRepository(supabase);
    const healthService = new FolderHealthService(
      folderProfileRepo,
      suggestionRepo,
      supabase,
    );

    // Get quick summary
    const summary = await healthService.getQuickSummary(user.id);

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        action: "folder_health_summary_error",
      },
      "FolderHealth API: Error getting health summary",
    );

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "获取健康摘要失败",
        },
      },
      { status: 500 },
    );
  }
}
