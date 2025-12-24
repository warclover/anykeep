/**
 * Folder Organization Suggestions API
 * V4.2 文件夹组织建议接口
 *
 * GET: 获取文件夹组织建议
 * POST: 执行建议
 *
 * @version 1.0.0
 * @since 2025-12-12
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createFolderAutoOrganizationService,
  type OrganizationSuggestion,
} from "@/lib/folder";
import { logger } from "@/lib/logger";

// ============================================================================
// GET - 获取组织建议
// ============================================================================

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 获取用户托管模式设置
    // Note: Table may not exist yet - using type assertion
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: trustModeData } = await (supabase as any)
      .from("user_trust_mode")
      .select("trust_mode")
      .eq("user_id", user.id)
      .single();

    // 根据托管模式配置自动组织参数
    const trustMode =
      (trustModeData as { trust_mode?: string })?.trust_mode ?? "semi";
    const autoExecute = trustMode === "full";

    const service = createFolderAutoOrganizationService(supabase, {
      autoExecute,
      maxSuggestions: 10,
    });

    const suggestions = await service.analyzeAndSuggest(user.id);

    return NextResponse.json({
      suggestions,
      trustMode,
      autoExecute,
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Folder Suggestions API: GET failed",
    );
    return NextResponse.json(
      { error: "Failed to get suggestions" },
      { status: 500 },
    );
  }
}

// ============================================================================
// POST - 执行建议
// ============================================================================

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const suggestion = body.suggestion as OrganizationSuggestion;

    if (!suggestion || !suggestion.action) {
      return NextResponse.json(
        { error: "Invalid suggestion" },
        { status: 400 },
      );
    }

    const service = createFolderAutoOrganizationService(supabase);
    const result = await service.executeSuggestion(user.id, suggestion);

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    logger.info(
      {
        userId: user.id,
        suggestionType: suggestion.type,
        suggestionId: suggestion.id,
      },
      "Folder Suggestions API: Suggestion executed",
    );

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Folder Suggestions API: POST failed",
    );
    return NextResponse.json(
      { error: "Failed to execute suggestion" },
      { status: 500 },
    );
  }
}
