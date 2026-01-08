/**
 * 取消工作流 API
 *
 * POST /api/workflow/execution/[id]/cancel - 取消工作流执行
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkflowOrchestrator } from "@/lib/workflow/orchestrator";
import { logger } from "@/lib/logger";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const orchestrator = getWorkflowOrchestrator();
    const execution = await orchestrator.getExecution(id);

    if (!execution) {
      return NextResponse.json(
        { error: "Execution not found" },
        { status: 404 },
      );
    }

    if (execution.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const cancelled = await orchestrator.cancelWorkflow(id);

    logger.info(
      { userId: user.id, executionId: id, cancelled },
      "API: Cancel workflow requested",
    );

    return NextResponse.json({ success: true, cancelled });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to cancel workflow", message },
      { status: 500 },
    );
  }
}
