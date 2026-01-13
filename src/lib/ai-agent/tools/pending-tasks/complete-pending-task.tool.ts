/**
 * CompletePendingTask Tool - 完成待办事项
 *
 * 标记用户的待办事项为已完成，从列表中移除。
 *
 * @version 1.0.0
 * @since 2026-01-13
 */

import { z } from "zod";
import type { Tool, ToolResult } from "../types";
import { withReasoning, extractReasoning } from "../types";
import { getPendingTasksService } from "@/lib/ai-memory/pending-tasks";
import { logger } from "@/lib/logger";
import type { CompletePendingTaskResult } from "./types";

// ============================================
// 参数 Schema
// ============================================

const baseParamsSchema = z.object({
  task: z.string().min(1).describe("要完成的任务内容，支持模糊匹配"),
  exactMatch: z
    .boolean()
    .optional()
    .default(false)
    .describe("是否精确匹配任务内容，默认模糊匹配"),
});

const paramsSchema = withReasoning(baseParamsSchema);

type CompletePendingTaskParams = z.input<typeof paramsSchema>;

// ============================================
// Tool 实现
// ============================================

export const completePendingTaskTool: Tool<
  CompletePendingTaskParams,
  CompletePendingTaskResult
> = {
  definition: {
    name: "complete_pending_task",
    description: `标记待办事项为已完成。

支持精确匹配和模糊匹配两种方式：
- 模糊匹配（默认）：任务描述包含关键词即可
- 精确匹配：任务内容需完全一致

使用场景：
- 用户说 "这个事情做完了" / "我已经整理好了"
- 用户完成了之前提到的任务
- 批量整理后清理相关待办

注意：
- 如果模糊匹配到多个任务，只会完成第一个匹配的
- 建议先用 list_pending_tasks 确认任务内容`,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: false,
    estimatedDurationMs: 100,
  },

  async execute(
    params: CompletePendingTaskParams,
    context,
  ): Promise<ToolResult<CompletePendingTaskResult>> {
    const startTime = performance.now();
    const reasoning = extractReasoning(params);
    const { task, exactMatch } = params;

    try {
      const service = getPendingTasksService();

      let completedTask: string | null = null;

      if (exactMatch) {
        // 精确匹配
        const success = await service.completeTask(context.userId, task);
        if (success) {
          completedTask = task;
        }
      } else {
        // 模糊匹配
        completedTask = await service.completeTaskByMatch(context.userId, task);
      }

      // 获取剩余任务数量
      const remainingCount = await service.getTaskCount(context.userId);

      const executionTimeMs = Math.round(performance.now() - startTime);

      // 构造结果
      const result: CompletePendingTaskResult = {
        success: !!completedTask,
        completedTask: completedTask || undefined,
        remainingCount,
        message: completedTask
          ? `已完成: "${completedTask}"${remainingCount > 0 ? `，还有 ${remainingCount} 项待办` : "，所有待办已清空"}`
          : `未找到匹配的待办事项: "${task}"`,
      };

      logger.info(
        {
          toolName: "complete_pending_task",
          userId: context.userId,
          requestedTask: task,
          completedTask,
          exactMatch,
          remainingCount,
          executionTimeMs,
          reasoning,
        },
        `complete_pending_task: ${completedTask ? "Success" : "Not found"}`,
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
          toolName: "complete_pending_task",
          userId: context.userId,
          task,
          error: errorMessage,
          executionTimeMs,
        },
        "complete_pending_task: Failed",
      );

      return {
        success: false,
        error: `完成待办事项失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
        metadata: {
          executionTimeMs,
        },
      };
    }
  },
};
