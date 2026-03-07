/**
 * 智能分类 v5.0 - T1结果查询 API
 *
 * GET /api/classification/v5/t1-result/[eventId]
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { T1QueueService } from "@/lib/classification/strategies/modern/t1-queue";
import { createLogger } from "@/lib/classification/infrastructure/shared-services/logger";
import { withAuthMiddleware } from "@/lib/api/middleware";

/**
 * GET /api/classification/v5/t1-result/:eventId
 * 查询T1任务结果
 */
export const GET = withAuthMiddleware<{ eventId: string }>(
  async (_request, { userId, params }) => {
    const logger = createLogger("T1ResultAPI");

    const supabase = await createClient();

    // 2. 获取eventId
    const { eventId } = await params;

    if (!eventId) {
      logger.warn("缺少eventId");
      return NextResponse.json({ error: "缺少eventId" }, { status: 400 });
    }

    logger.info("查询T1结果", { userId, eventId });

    // 3. 查询T1任务
    const queueService = new T1QueueService(supabase, logger);
    const task = await queueService.getTask(eventId);

    if (!task) {
      logger.warn("T1任务不存在", { eventId });
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }

    // 4. 验证任务所有权
    if (task.userId !== userId) {
      logger.warn("无权访问T1任务", {
        eventId,
        taskUserId: task.userId,
        requestUserId: userId,
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
  },
);
