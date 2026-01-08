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
import { logger } from "@/lib/logger";

/** 默认返回数量 */
const DEFAULT_LIMIT = 20;

/** 最大返回数量上限 */
const MAX_LIMIT = 100;

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
    const limitParam = searchParams.get("limit");
    const statusParam = searchParams.get("status");

    // 解析并限制 limit 参数
    let limit = DEFAULT_LIMIT;
    if (limitParam) {
      const parsed = parseInt(limitParam, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        limit = Math.min(parsed, MAX_LIMIT);

        // 记录超出上限的请求
        if (parsed > MAX_LIMIT) {
          logger.info(
            { userId: user.id, requested: parsed, capped: MAX_LIMIT },
            "Executions limit capped",
          );
        }
      }
    }

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
