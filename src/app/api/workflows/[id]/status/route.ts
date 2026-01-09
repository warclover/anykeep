/**
 * 工作流执行状态 API
 *
 * GET: 获取工作流执行的实时状态
 *
 * @version 1.0.0
 * @since 2026-01-09
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { getWorkflowOrchestrator } from "@/lib/workflow/orchestrator";

/**
 * GET /api/workflows/[id]/status
 *
 * 获取工作流的最近执行状态
 *
 * Query params:
 * - executionId?: string - 指定执行 ID（可选，不提供则返回最近一次）
 *
 * Response:
 * - status: 执行状态
 * - currentStep: 当前步骤索引
 * - stepResults: 各步骤执行结果
 * - startedAt: 开始时间
 * - completedAt: 完成时间
 */
export async function GET(
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

    // 获取 query params
    const searchParams = request.nextUrl.searchParams;
    const executionId = searchParams.get("executionId");

    // 如果指定了执行 ID，直接获取该执行状态
    if (executionId) {
      const orchestrator = getWorkflowOrchestrator();
      const execution = await orchestrator.getExecution(executionId);

      if (!execution) {
        return NextResponse.json(
          { error: "Execution not found" },
          { status: 404 },
        );
      }

      // 验证用户权限
      if (execution.userId !== user.id) {
        return NextResponse.json(
          { error: "Not authorized to view this execution" },
          { status: 403 },
        );
      }

      return NextResponse.json({
        success: true,
        execution: formatExecution(execution),
      });
    }

    // 否则获取该工作流的最近执行记录
    const orchestrator = getWorkflowOrchestrator();
    const executions = await orchestrator.listExecutions(user.id, {
      workflowId,
      limit: 1,
    });

    if (executions.length === 0) {
      return NextResponse.json({
        success: true,
        execution: null,
        message: "No execution history found",
      });
    }

    return NextResponse.json({
      success: true,
      execution: formatExecution(executions[0]),
    });
  } catch (error) {
    logger.error(
      { error },
      "Unexpected error in GET /api/workflows/[id]/status",
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * 格式化执行记录
 */
function formatExecution(execution: {
  id: string;
  workflowId: string;
  workflowName?: string;
  status: string;
  currentStep?: number;
  stepResults?: unknown[];
  triggerType?: string;
  startedAt?: Date | string;
  completedAt?: Date | string;
  error?: string;
}) {
  return {
    id: execution.id,
    workflowId: execution.workflowId,
    workflowName: execution.workflowName,
    status: execution.status,
    currentStep: execution.currentStep ?? 0,
    stepResults: execution.stepResults ?? [],
    triggerType: execution.triggerType,
    startedAt: execution.startedAt
      ? new Date(execution.startedAt).toISOString()
      : null,
    completedAt: execution.completedAt
      ? new Date(execution.completedAt).toISOString()
      : null,
    error: execution.error,
  };
}
