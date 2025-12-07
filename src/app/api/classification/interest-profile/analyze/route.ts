/**
 * Interest Profile Analyze API
 * Dedicated endpoint for post-import analysis
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { InterestProfileService } from "@/lib/classification/services";
import { logger } from "@/lib/logger";

/**
 * POST /api/classification/interest-profile/analyze
 * Analyze imported bookmarks and update interest profile
 *
 * This endpoint should be called after browser bookmark import completes.
 * It extracts interests from imported bookmarks to accelerate cold start.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: { message: "Unauthorized" } },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { importSource = "browser", triggerStageUpdate = true } = body;

    const service = new InterestProfileService(supabase);

    // Step 1: Analyze imported bookmarks
    const analysisResult = await service.analyzeImportedBookmarks(
      user.id,
      importSource,
    );

    // Step 2: Optionally update user stage
    let newStage = null;
    if (triggerStageUpdate) {
      newStage = await service.updateStage(user.id);
    }

    // Step 3: Get updated profile stats
    const stats = await service.getProfileStats(user.id);

    logger.info(
      {
        userId: user.id,
        importSource,
        bookmarkCount: analysisResult.totalBookmarks,
        keywordsExtracted: analysisResult.keywords.length,
        newStage,
        action: "post_import_analysis_complete",
      },
      "Interest Profile: Post-import analysis completed",
    );

    return NextResponse.json({
      data: {
        analysis: {
          totalBookmarks: analysisResult.totalBookmarks,
          validBookmarks: analysisResult.validBookmarks,
          keywords: analysisResult.keywords,
          suggestedFolders: analysisResult.suggestedFolders,
        },
        profile: {
          stage: stats.stage,
          confidence: stats.confidence,
          interestCount: stats.interestCount,
          hasImported: stats.hasImported,
        },
        stageUpdated: triggerStageUpdate,
        newStage,
      },
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : "Unknown error" },
      "Interest Profile Analyze API: POST failed",
    );
    return NextResponse.json(
      { error: { message: "Failed to analyze imported bookmarks" } },
      { status: 500 },
    );
  }
}
