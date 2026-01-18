/**
 * 智能分类 v5.0 - T1结果查询 API
 *
 * GET /api/classification/v5/t1-result/[eventId]
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { T1QueueService } from "@/lib/classification/v5/t1-queue";
import { createLogger } from "@/lib/classification/v5/shared/logger";

/**
 * GET /api/classification/v5/t1-result/:eventId
 * 查询T1任务结果
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { eventId: string } },
) {
  const logger = createLogger("T1ResultAPI");

  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.warn("未授权访问", { error: authError?.message });
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    // 2. 获取eventId
    const { eventId } = params;

    if (!eventId) {
      logger.warn("缺少eventId");
      return NextResponse.json({ error: "缺少eventId" }, { status: 400 });
    }

    logger.info("查询T1结果", { userId: user.id, eventId });

    // 3. 查询T1任务
    const queueService = new T1QueueService(supabase, logger);
    const task = await queueService.getTask(eventId);

    if (!task) {
      logger.warn("T1任务不存在", { eventId });
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }

    // 4. 验证任务所有权
    if (task.userId !== user.id) {
      logger.warn("无权访问T1任务", {
        eventId,
        taskUserId: task.userId,
        requestUserId: user.id,
      });
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    // 5. 返回任务结果
    return NextResponse.json({
      success: true,
      data: {
        eventId: task.eventId,
        status: task.status,
        t0Result: {
          folderId: task.t0FolderId,
          confidence: task.t0Confidence,
        },
        t1Result: task.t1FolderId
          ? {
              folderId: task.t1FolderId,
              confidence: task.t1Confidence,
              reasoning: task.t1Reasoning,
            }
          : undefined,
        errorMessage: task.errorMessage,
        createdAt: task.createdAt,
        completedAt: task.completedAt,
        executionTimeMs: task.executionTimeMs,
      },
    });
  } catch (error) {
    logger.error("查询T1结果失败", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: "查询失败",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
