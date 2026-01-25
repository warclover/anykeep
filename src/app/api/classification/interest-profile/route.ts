/**
 * Interest Profile API (V2.0.0 - Consolidated)
 *
 * GET /api/classification/interest-profile - Get user's interest profile
 * POST /api/classification/interest-profile - Initialize interest profile
 * PATCH /api/classification/interest-profile - Update interest profile
 *   - action=update_manual - Update manual description
 *   - action=analyze_imported - Simple analysis
 *   - action=full_analyze - Full analysis with stage update (merged from /analyze)
 *   - action=learn_behavior - Learn from user behavior
 *   - action=update_stage - Update user stage
 *
 * @version 2.0.0 - Merged /analyze endpoint
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { InterestProfileService } from "@/lib/classification/services";
import { logger } from "@/lib/logger";
import { z } from "zod";

// Validation Schemas
const initProfileSchema = z.object({
  manualDescription: z.string().optional(),
});

const updateProfileSchema = z.object({
  action: z.enum([
    "update_manual",
    "analyze_imported",
    "full_analyze",
    "learn_behavior",
    "update_stage",
  ]),
  manualDescription: z.string().optional(),
  importSource: z.string().optional(),
  triggerStageUpdate: z.boolean().optional().default(true),
});

/**
 * GET /api/classification/interest-profile
 * Get user's interest profile
 */
export async function GET() {
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

    const service = new InterestProfileService(supabase);
    const profile = await service.getOrCreateProfile(user.id);
    const stats = await service.getProfileStats(user.id);

    return NextResponse.json({
      data: {
        profile,
        stats,
      },
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : "Unknown error" },
      "Interest Profile API: GET failed",
    );
    return NextResponse.json(
      { error: { message: "Failed to get interest profile" } },
      { status: 500 },
    );
  }
}

/**
 * POST /api/classification/interest-profile
 * Initialize or update interest profile
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
    const parseResult = initProfileSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            message: "Invalid request body",
            details: parseResult.error.format(),
          },
        },
        { status: 400 },
      );
    }

    const { manualDescription } = parseResult.data;

    const service = new InterestProfileService(supabase);
    const profile = await service.initializeProfile(user.id, {
      manualDescription,
    });

    return NextResponse.json({
      data: {
        profile,
        message: "Profile initialized successfully",
      },
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : "Unknown error" },
      "Interest Profile API: POST failed",
    );
    return NextResponse.json(
      { error: { message: "Failed to initialize interest profile" } },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/classification/interest-profile
 * Update interest profile (manual description, trigger analysis, etc.)
 */
export async function PATCH(request: NextRequest) {
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
    const parseResult = updateProfileSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            message: "Invalid request body",
            details: parseResult.error.format(),
          },
        },
        { status: 400 },
      );
    }

    const { action, manualDescription, importSource, triggerStageUpdate } =
      parseResult.data;

    const service = new InterestProfileService(supabase);
    let result: {
      success: boolean;
      message: string;
      data?: unknown;
    };

    switch (action) {
      case "update_manual": {
        if (!manualDescription) {
          return NextResponse.json(
            { error: { message: "manualDescription is required" } },
            { status: 400 },
          );
        }
        const profile = await service.updateManualDescription(
          user.id,
          manualDescription,
        );
        result = {
          success: true,
          message: "Manual description updated",
          data: { profile },
        };
        break;
      }

      case "analyze_imported": {
        const analysisResult = await service.analyzeImportedBookmarks(
          user.id,
          importSource || "browser",
        );
        result = {
          success: analysisResult.totalBookmarks > 0,
          message:
            analysisResult.totalBookmarks > 0
              ? `Analyzed ${analysisResult.totalBookmarks} bookmarks, extracted ${analysisResult.keywords.length} keywords`
              : "No imported bookmarks to analyze",
          data: analysisResult,
        };
        break;
      }

      // V2.0.0: Full analysis (merged from /analyze endpoint)
      case "full_analyze": {
        // Step 1: Analyze imported bookmarks
        const analysisResult = await service.analyzeImportedBookmarks(
          user.id,
          importSource || "browser",
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
            importSource: importSource || "browser",
            bookmarkCount: analysisResult.totalBookmarks,
            keywordsExtracted: analysisResult.keywords.length,
            newStage,
            action: "post_import_analysis_complete",
          },
          "Interest Profile: Post-import analysis completed",
        );

        result = {
          success: true,
          message: `Full analysis completed: ${analysisResult.totalBookmarks} bookmarks analyzed`,
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
        };
        break;
      }

      case "learn_behavior": {
        const learnResult = await service.learnFromBehavior(user.id);
        result = {
          success: learnResult.success,
          message: learnResult.message,
          data: { learnedKeywords: learnResult.learnedKeywords },
        };
        break;
      }

      case "update_stage": {
        const newStage = await service.updateStage(user.id);
        result = {
          success: true,
          message: `Stage updated to ${newStage}`,
          data: { stage: newStage },
        };
        break;
      }

      default:
        return NextResponse.json(
          {
            error: {
              message:
                "Invalid action. Use: update_manual, analyze_imported, full_analyze, learn_behavior, update_stage",
            },
          },
          { status: 400 },
        );
    }

    logger.info(
      {
        userId: user.id,
        action,
        success: result.success,
      },
      `Interest Profile API: ${action} completed`,
    );

    return NextResponse.json({ data: result });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : "Unknown error" },
      "Interest Profile API: PATCH failed",
    );
    return NextResponse.json(
      { error: { message: "Failed to update interest profile" } },
      { status: 500 },
    );
  }
}
