/**
 * 工作流列表 API
 *
 * GET /api/workflow - 列出可用的工作流
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkflowOrchestrator } from "@/lib/workflow/orchestrator";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orchestrator = getWorkflowOrchestrator();
    const workflows = await orchestrator.listWorkflows(user.id);

    return NextResponse.json({ workflows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error({ error: message }, "API: Failed to list workflows");

    return NextResponse.json(
      { error: "Failed to list workflows", message },
      { status: 500 },
    );
  }
}
