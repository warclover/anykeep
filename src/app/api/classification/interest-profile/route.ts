/**
 * Interest Profile API
 * Handles user interest profile operations
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { InterestProfileService } from "@/lib/classification/services";
import { logger } from "@/lib/logger";

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
    const { manualDescription } = body;

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
    const { action, manualDescription, importSource } = body;

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
                "Invalid action. Use: update_manual, analyze_imported, learn_behavior, update_stage",
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
