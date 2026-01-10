/**
 * DeleteSnapshot Tool - 删除快照工具
 *
 * 删除指定的快照记录及其关联存储文件
 *
 * @version 1.0.0
 * @since 2026-01-10
 */

import { z } from "zod";
import type { Tool, ToolResult } from "../types";
import { logger } from "@/lib/logger";
import { buildToolDescription } from "../tool-description-templates";
import { snapshotService } from "@/lib/snapshot";

// ============================================
// 参数和结果类型定义
// ============================================

const paramsSchema = z.object({
  snapshotId: z.number().int().positive().describe("要删除的快照 ID（必填）"),
});

type DeleteSnapshotParams = z.infer<typeof paramsSchema>;

interface DeleteSnapshotResult {
  deleted: boolean;
  snapshotId: number;
  message: string;
}

// ============================================
// 工具描述
// ============================================

const DELETE_SNAPSHOT_DESCRIPTION = buildToolDescription({
  core: "删除指定的网页快照记录及其存储文件。",
  scenarios: [
    '"删除这个快照"',
    '"移除快照 123"',
    '"清理失败的快照"',
    '"删掉过期的快照"',
  ],
  notes: [
    "此操作不可撤销，会同时删除存储的截图和HTML文件",
    "只能删除自己的快照",
    "删除成功后相关存储空间会释放",
  ],
  boundaries: ["notFound", "confirmation"],
});

// ============================================
// Tool 实现
// ============================================

export const deleteSnapshotTool: Tool<
  DeleteSnapshotParams,
  DeleteSnapshotResult
> = {
  definition: {
    name: "delete_snapshot",
    description: DELETE_SNAPSHOT_DESCRIPTION,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: true, // 删除操作需要确认
    estimatedDurationMs: 500,
  },

  async execute(
    params: DeleteSnapshotParams,
    context,
  ): Promise<ToolResult<DeleteSnapshotResult>> {
    const startTime = performance.now();

    try {
      // 调用 snapshotService 删除快照
      const deleted = await snapshotService.deleteSnapshot(
        context.userId,
        params.snapshotId,
      );

      if (!deleted) {
        logger.warn(
          {
            toolName: "delete_snapshot",
            userId: context.userId,
            snapshotId: params.snapshotId,
          },
          "delete_snapshot: Snapshot not found or already deleted",
        );

        return {
          success: false,
          error: "快照不存在或已被删除",
          errorCode: "NOT_FOUND",
        };
      }

      const result: DeleteSnapshotResult = {
        deleted: true,
        snapshotId: params.snapshotId,
        message: `快照 ${params.snapshotId} 已成功删除`,
      };

      logger.info(
        {
          toolName: "delete_snapshot",
          userId: context.userId,
          snapshotId: params.snapshotId,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "delete_snapshot: Success",
      );

      return {
        success: true,
        data: result,
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(
        {
          toolName: "delete_snapshot",
          userId: context.userId,
          snapshotId: params.snapshotId,
          error: errorMessage,
        },
        "delete_snapshot: Failed",
      );

      return {
        success: false,
        error: `删除快照失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
