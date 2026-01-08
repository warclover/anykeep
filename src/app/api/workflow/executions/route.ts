/**
 * 工作流执行历史列表端点
 *
 * GET /api/workflow/executions?limit=20&status=completed
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkflowOrchestrator } from "@/lib/workflow/orchestrator";
import type { ExecutionStatus } from "@/lib/workflow/types";

const VALID_STATUSES: ExecutionStatus[] = [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
  "waiting_confirmation",
];

function isValidStatus(status: string): status is ExecutionStatus {
  return VALID_STATUSES.includes(status as ExecutionStatus);
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const statusParam = searchParams.get("status");
    const status =
      statusParam && isValidStatus(statusParam) ? statusParam : undefined;

    const orchestrator = getWorkflowOrchestrator();
    const executions = await orchestrator.listExecutions(user.id, {
      limit,
      status,
    });

    return NextResponse.json({ executions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to list executions", message },
      { status: 500 },
    );
  }
}
