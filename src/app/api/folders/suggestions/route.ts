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

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import {
  createFolderAutoOrganizationService,
  type OrganizationSuggestion,
} from "@/lib/folder";
import { logger } from "@/lib/logger";

// ============================================================================
// GET - 获取组织建议
// ============================================================================

export const GET = withAuthMiddleware(
  async (_request: NextRequest, { userId }) => {
    const supabase = await createClient();

    // 获取用户托管模式设置
    // Note: Table may not exist yet - using type assertion
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: trustModeData } = await (supabase as any)
      .from("user_trust_mode")
      .select("trust_mode")
      .eq("user_id", userId)
      .single();

    // 根据托管模式配置自动组织参数
    const trustMode =
      (trustModeData as { trust_mode?: string })?.trust_mode ?? "semi";
    const autoExecute = trustMode === "full";

    const service = createFolderAutoOrganizationService(supabase, {
      autoExecute,
      maxSuggestions: 10,
    });

    const suggestions = await service.analyzeAndSuggest(userId);

    return NextResponse.json({
      suggestions,
      trustMode,
      autoExecute,
    });
  },
);

// ============================================================================
// POST - 执行建议
// ============================================================================

export const POST = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const supabase = await createClient();

    const body = await request.json();
    const suggestion = body.suggestion as OrganizationSuggestion;

    if (!suggestion || !suggestion.action) {
      return NextResponse.json(
        { error: "Invalid suggestion" },
        { status: 400 },
      );
    }

    const service = createFolderAutoOrganizationService(supabase);
    const result = await service.executeSuggestion(userId, suggestion);

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    logger.info(
      {
        userId,
        suggestionType: suggestion.type,
        suggestionId: suggestion.id,
      },
      "Folder Suggestions API: Suggestion executed",
    );

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  },
);
