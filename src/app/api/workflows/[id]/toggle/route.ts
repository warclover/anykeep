/**
 * 工作流开关切换 API
 *
 * PATCH: 切换工作流的启用/禁用状态
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

interface ToggleRequestBody {
  enabled: boolean;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const { id: workflowId } = await params;

    // 验证用户身份
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 解析请求体
    const body: ToggleRequestBody = await request.json();
    const { enabled } = body;

    if (typeof enabled !== "boolean") {
      return NextResponse.json(
        { error: "Invalid request body: enabled must be a boolean" },
        { status: 400 },
      );
    }

    // 检查工作流是否存在
    const { data: workflow, error: fetchError } = await supabase
      .from("workflows")
      .select("id, name, category")
      .eq("id", workflowId)
      .single();

    if (fetchError || !workflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 },
      );
    }

    // 只允许切换内置工作流（用户自定义工作流需要单独权限检查）
    if (workflow.category !== "builtin") {
      // 检查是否是用户自己的工作流
      const { data: userWorkflow } = await supabase
        .from("workflows")
        .select("id")
        .eq("id", workflowId)
        .eq("user_id", user.id)
        .single();

      if (!userWorkflow) {
        return NextResponse.json(
          { error: "Not authorized to modify this workflow" },
          { status: 403 },
        );
      }
    }

    // 更新工作流状态
    const { error: updateError } = await supabase
      .from("workflows")
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq("id", workflowId);

    if (updateError) {
      logger.error(
        { error: updateError, workflowId },
        "Failed to toggle workflow",
      );
      return NextResponse.json(
        { error: "Failed to update workflow" },
        { status: 500 },
      );
    }

    logger.info(
      { workflowId, workflowName: workflow.name, enabled, userId: user.id },
      "Workflow toggled",
    );

    return NextResponse.json({
      success: true,
      workflow: {
        id: workflowId,
        name: workflow.name,
        enabled,
      },
    });
  } catch (error) {
    logger.error(
      { error },
      "Unexpected error in PATCH /api/workflows/[id]/toggle",
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
