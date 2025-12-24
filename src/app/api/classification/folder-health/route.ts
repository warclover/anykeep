/**
 * Folder Health Check API (V2.0.0 - Consolidated)
 *
 * GET /api/classification/folder-health - Full health report (default)
 * GET /api/classification/folder-health?type=summary - Quick summary
 * POST /api/classification/folder-health - Save suggestions to database
 *
 * @version 2.0.0 - Merged /folder-health/summary into this route
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  FolderProfileRepository,
  SuggestionRepository,
} from "@/lib/classification/repositories";
import { FolderHealthService } from "@/lib/classification/services";
import { logger } from "@/lib/logger";

/**
 * GET - Check folder health
 * @query type - 'report' (default) for full health check, 'summary' for quick summary
 */
export async function GET(request: NextRequest) {
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "report";

    // Initialize services
    const folderProfileRepo = new FolderProfileRepository(supabase);
    const suggestionRepo = new SuggestionRepository(supabase);
    const healthService = new FolderHealthService(
      folderProfileRepo,
      suggestionRepo,
      supabase,
    );

    // Route based on type
    if (type === "summary") {
      // Quick summary (lightweight)
      const summary = await healthService.getQuickSummary(user.id);
      return NextResponse.json({
        success: true,
        data: summary,
      });
    }

    // Default: Full health report
    const report = await healthService.checkHealth(user.id);

    return NextResponse.json({
      success: true,
      data: {
        status: report.status,
        totalFolders: report.totalFolders,
        healthyFolders: report.healthyFolders,
        foldersNeedingAttention: report.foldersNeedingAttention,
        mergeSuggestions: report.mergeSuggestions,
        splitSuggestions: report.splitSuggestions,
        analyzedAt: report.analyzedAt.toISOString(),
      },
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        action: "folder_health_check_error",
      },
      "FolderHealth API: Error checking folder health",
    );

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message:
            error instanceof Error ? error.message : "检查文件夹健康度失败",
        },
      },
      { status: 500 },
    );
  }
}

/**
 * POST - Save suggestions to database for later review
 */
export async function POST() {
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

    // Run health check
    const report = await healthService.checkHealth(user.id);

    // Save suggestions
    const savedCount = await healthService.saveSuggestions(user.id, report);

    return NextResponse.json({
      success: true,
      data: {
        savedCount,
        status: report.status,
      },
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        action: "folder_health_save_error",
      },
      "FolderHealth API: Error saving suggestions",
    );

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "保存建议失败",
        },
      },
      { status: 500 },
    );
  }
}
