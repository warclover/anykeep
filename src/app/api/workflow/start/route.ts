/**
 * 启动工作流 API
 *
 * POST /api/workflow/start - 启动工作流执行
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkflowOrchestrator } from "@/lib/workflow/orchestrator";
import { logger } from "@/lib/logger";
import { z } from "zod";

const startWorkflowSchema = z.object({
  workflowId: z.string().min(1),
  triggerContext: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = startWorkflowSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { workflowId, triggerContext = {} } = parsed.data;

    const orchestrator = getWorkflowOrchestrator();
    const execution = await orchestrator.startWorkflow(workflowId, user.id, {
      triggerType: "manual",
      triggerContext,
    });

    logger.info(
      { userId: user.id, workflowId, executionId: execution.id },
      "API: Workflow started",
    );

    return NextResponse.json({
      success: true,
      executionId: execution.id,
      status: execution.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error({ error: message }, "API: Failed to start workflow");

    return NextResponse.json(
      { error: "Failed to start workflow", message },
      { status: 500 },
    );
  }
}
