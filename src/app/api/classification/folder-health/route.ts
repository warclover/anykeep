/**
 * Folder Health Check API
 * GET /api/classification/folder-health - Get folder health report
 * POST /api/classification/folder-health/save - Save suggestions to database
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
 * GET - Check folder health and get suggestions
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

    // Run health check
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
