/**
 * 工作流执行历史清理定时任务
 *
 * GET /api/internal/cron/workflow-cleanup
 *
 * 由 Vercel Cron 或 pg_cron 定期调用（建议每天凌晨执行）
 *
 * @version 1.0.0
 * @since 2026-01-09
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * 验证 cron 调用的 secret
 */
function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // 如果没有配置 CRON_SECRET，允许本地开发调用
  if (!cronSecret) {
    return process.env.NODE_ENV === "development";
  }

  return authHeader === `Bearer ${cronSecret}`;
}

interface CleanupResult {
  execution_history: {
    completed_deleted: number;
    failed_deleted: number;
    retained: number;
  };
  step_results_deleted: number;
  rate_limits_deleted: number;
  cleaned_at: string;
}

export async function GET(request: Request) {
  try {
    // 验证调用权限
    if (!verifyCronSecret(request)) {
      logger.warn("Workflow cleanup: Unauthorized cron call attempted");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    logger.info("Workflow cleanup: Starting cleanup job");

    // 调用数据库清理函数（函数定义在迁移中，类型断言绕过检查）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc(
      "cleanup_workflow_history_all",
    );

    if (error) {
      logger.error({ error }, "Workflow cleanup: Failed to execute cleanup");
      return NextResponse.json(
        { error: "Cleanup failed", message: error.message },
        { status: 500 },
      );
    }

    const result = data as unknown as CleanupResult;

    logger.info(
      {
        completedDeleted: result.execution_history.completed_deleted,
        failedDeleted: result.execution_history.failed_deleted,
        retained: result.execution_history.retained,
        stepResultsDeleted: result.step_results_deleted,
        rateLimitsDeleted: result.rate_limits_deleted,
      },
      "Workflow cleanup: Completed successfully",
    );

    return NextResponse.json({
      success: true,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error({ error: message }, "Workflow cleanup: Unexpected error");

    return NextResponse.json(
      { error: "Internal server error", message },
      { status: 500 },
    );
  }
}
