/**
 * Folder Health Check API (V2.0.0 - Consolidated)
 *
 * GET /api/classification/folder-health - Full health report (default)
 * GET /api/classification/folder-health?type=summary - Quick summary
 * POST /api/classification/folder-health - Save suggestions to database
 *
 * @version 2.1.0 - Merged /folder-health/summary into this route
 * @updated 2026-03-07 - 迁移到 withAuthMiddleware
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  FolderProfileRepository,
  SuggestionRepository,
} from "@/lib/folder/profile";
import { FolderHealthService } from "@/lib/folder/health";
import { withAuthMiddleware } from "@/lib/api/middleware";

/**
 * GET - Check folder health
 * @query type - 'report' (default) for full health check, 'summary' for quick summary
 */
export const GET = withAuthMiddleware(async (request, { userId }) => {
  const supabase = await createClient();

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
    const summary = await healthService.getQuickSummary(userId);
    return NextResponse.json({
      success: true,
      data: summary,
    });
  }

  // Default: Full health report
  const report = await healthService.checkHealth(userId);

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
});

/**
 * POST - Save suggestions to database for later review
 */
export const POST = withAuthMiddleware(async (_request, { userId }) => {
  const supabase = await createClient();

  // Initialize services
  const folderProfileRepo = new FolderProfileRepository(supabase);
  const suggestionRepo = new SuggestionRepository(supabase);
  const healthService = new FolderHealthService(
    folderProfileRepo,
    suggestionRepo,
    supabase,
  );

  // Run health check
  const report = await healthService.checkHealth(userId);

  // Save suggestions
  const savedCount = await healthService.saveSuggestions(userId, report);

  return NextResponse.json({
    success: true,
    data: {
      savedCount,
      status: report.status,
    },
  });
});
