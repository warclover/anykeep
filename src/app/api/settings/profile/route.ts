/**
 * User Profile Settings API
 * POST /api/settings/profile - Save user profile (occupation, scenarios)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { Json } from "@/types/supabase";

// Valid occupation IDs
const VALID_OCCUPATIONS = [
  "developer",
  "designer",
  "product_manager",
  "marketing",
  "student",
  "researcher",
  "entrepreneur",
  "freelancer",
  "other",
] as const;

// Valid scenario IDs
const VALID_SCENARIOS = [
  "work_learning",
  "hobby_interest",
  "investment",
  "reading",
  "shopping",
  "travel",
] as const;

type OccupationId = (typeof VALID_OCCUPATIONS)[number];
type ScenarioId = (typeof VALID_SCENARIOS)[number];

interface ProfileUpdateRequest {
  occupation?: OccupationId | null;
  scenarios?: ScenarioId[];
}

/**
 * POST - Save user profile settings
 */
export async function POST(request: Request) {
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

    const body: ProfileUpdateRequest = await request.json();

    // Validate occupation
    if (body.occupation !== null && body.occupation !== undefined) {
      if (!VALID_OCCUPATIONS.includes(body.occupation)) {
        return NextResponse.json(
          {
            success: false,
            error: { code: "INVALID_OCCUPATION", message: "无效的职业选项" },
          },
          { status: 400 },
        );
      }
    }

    // Validate scenarios
    if (body.scenarios) {
      if (!Array.isArray(body.scenarios)) {
        return NextResponse.json(
          {
            success: false,
            error: { code: "INVALID_SCENARIOS", message: "场景必须是数组" },
          },
          { status: 400 },
        );
      }

      if (body.scenarios.length > 4) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "TOO_MANY_SCENARIOS",
              message: "最多只能选择 4 个使用场景",
            },
          },
          { status: 400 },
        );
      }

      for (const scenario of body.scenarios) {
        if (!VALID_SCENARIOS.includes(scenario)) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: "INVALID_SCENARIO",
                message: `无效的场景选项: ${scenario}`,
              },
            },
            { status: 400 },
          );
        }
      }
    }

    // Get current profile settings
    const { data: profile, error: fetchError } = await supabase
      .from("profiles")
      .select("settings")
      .eq("id", user.id)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      throw new Error(`Failed to fetch profile: ${fetchError.message}`);
    }

    // Merge with existing settings
    const currentSettings = (profile?.settings || {}) as Record<
      string,
      Json | undefined
    >;
    const updatedSettings: Record<string, Json | undefined> = {
      ...currentSettings,
      occupation: (body.occupation ?? currentSettings.occupation ?? null) as
        | string
        | null,
      scenarios: (body.scenarios ??
        currentSettings.scenarios ??
        []) as string[],
      profile_updated_at: new Date().toISOString(),
    };

    // Update profile
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ settings: updatedSettings })
      .eq("id", user.id);

    if (updateError) {
      throw new Error(`Failed to update profile: ${updateError.message}`);
    }

    logger.info(
      {
        userId: user.id,
        occupation: body.occupation,
        scenarioCount: body.scenarios?.length ?? 0,
        action: "profile_settings_updated",
      },
      "Settings: User profile updated",
    );

    return NextResponse.json({
      success: true,
      data: {
        occupation: updatedSettings.occupation,
        scenarios: updatedSettings.scenarios,
      },
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        action: "profile_settings_error",
      },
      "Settings API: Error updating profile",
    );

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "保存画像设置失败",
        },
      },
      { status: 500 },
    );
  }
}
