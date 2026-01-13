/**
 * ListPendingTasks Tool - 获取待办事项列表
 *
 * 获取用户跨会话的待办事项，用于提醒用户未完成的任务。
 *
 * @version 1.0.0
 * @since 2026-01-13
 */

import { z } from "zod";
import type { Tool, ToolResult } from "../types";
import { withReasoning, extractReasoning } from "../types";
import { getPendingTasksService } from "@/lib/ai-memory/pending-tasks";
import { logger } from "@/lib/logger";
import type { ListPendingTasksResult } from "./types";

// ============================================
// 参数 Schema
// ============================================

const baseParamsSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .default(10)
    .describe("最大返回数量，默认 10"),
});

const paramsSchema = withReasoning(baseParamsSchema);

type ListPendingTasksParams = z.input<typeof paramsSchema>;

// ============================================
// Tool 实现
// ============================================

export const listPendingTasksTool: Tool<
  ListPendingTasksParams,
  ListPendingTasksResult
> = {
  definition: {
    name: "list_pending_tasks",
    description: `获取用户的待办事项列表。

返回用户在之前对话中提到但尚未完成的事项。

使用场景：
- 用户问 "我有什么待办" / "上次说的事情"
- 新会话开始时提醒用户未完成的事项
- 检查是否有遗留任务需要处理

注意：
- 待办事项会在 7 天后自动过期
- 可以使用 complete_pending_task 标记任务完成`,
    parameters: paramsSchema,
    category: "query",
    requiresConfirmation: false,
    estimatedDurationMs: 100,
  },

  async execute(
    params: ListPendingTasksParams,
    context,
  ): Promise<ToolResult<ListPendingTasksResult>> {
    const startTime = performance.now();
    const reasoning = extractReasoning(params);
    const limit = params.limit ?? 10;

    try {
      const service = getPendingTasksService({ maxTasks: limit + 1 });
      const allTasks = await service.getTasks(context.userId);

      // 检查是否有更多
      const hasMore = allTasks.length > limit;
      const tasks = allTasks.slice(0, limit);

      const executionTimeMs = Math.round(performance.now() - startTime);

      // 构造消息
      let message: string;
      if (tasks.length === 0) {
        message = "暂无待办事项";
      } else if (tasks.length === 1) {
        message = `有 1 项待办事项`;
      } else {
        message = `有 ${tasks.length} 项待办事项${hasMore ? "（还有更多）" : ""}`;
      }

      const result: ListPendingTasksResult = {
        tasks,
        count: tasks.length,
        hasMore,
        message,
      };

      logger.info(
        {
          toolName: "list_pending_tasks",
          userId: context.userId,
          count: tasks.length,
          hasMore,
          executionTimeMs,
          reasoning,
        },
        "list_pending_tasks: Success",
      );

      return {
        success: true,
        data: result,
        metadata: {
          executionTimeMs,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const executionTimeMs = Math.round(performance.now() - startTime);

      logger.error(
        {
          toolName: "list_pending_tasks",
          userId: context.userId,
          error: errorMessage,
          executionTimeMs,
        },
        "list_pending_tasks: Failed",
      );

      return {
        success: false,
        error: `获取待办事项失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
        metadata: {
          executionTimeMs,
        },
      };
    }
  },
};
