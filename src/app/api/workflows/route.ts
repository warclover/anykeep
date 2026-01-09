/**
 * 工作流列表 API
 *
 * GET: 获取用户可用的内置工作流列表
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const supabase = await createClient();

    // 验证用户身份
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 获取内置工作流列表
    const { data: workflows, error } = await supabase
      .from("workflows")
      .select(
        "id, name, description, category, enabled, definition, created_at",
      )
      .eq("category", "builtin")
      .order("created_at", { ascending: true });

    if (error) {
      logger.error({ error }, "Failed to fetch workflows");
      return NextResponse.json(
        { error: "Failed to fetch workflows" },
        { status: 500 },
      );
    }

    // 格式化响应
    const formattedWorkflows = (workflows || []).map((w) => ({
      id: w.id,
      name: w.name,
      description: w.description,
      category: w.category,
      enabled: w.enabled,
      definitionId: (w.definition as { id?: string })?.id || null,
      triggers: (w.definition as { triggers?: unknown[] })?.triggers || [],
    }));

    return NextResponse.json({
      success: true,
      workflows: formattedWorkflows,
    });
  } catch (error) {
    logger.error({ error }, "Unexpected error in GET /api/workflows");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
