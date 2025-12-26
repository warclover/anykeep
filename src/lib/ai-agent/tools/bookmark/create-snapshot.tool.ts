/**
 * CreateSnapshot Tool - 创建网页快照
 *
 * 为指定书签创建网页快照，保存内容副本
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { z } from "zod";
import type { Tool, ToolResult } from "../types";
import { snapshotService } from "@/lib/snapshot/snapshot.service";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { BOOKMARK_TOOL_DESCRIPTIONS } from "../tool-description-templates";

// ============================================
// 参数和结果类型定义
// ============================================

const paramsSchema = z.object({
  bookmarkId: z.number().int().positive().describe("要创建快照的书签 ID"),
  snapshotType: z
    .enum(["basic", "standard", "full"])
    .optional()
    .default("basic")
    .describe("快照类型：basic-基础（仅正文），standard-标准，full-完整"),
  priority: z
    .enum(["low", "normal", "high"])
    .optional()
    .default("normal")
    .describe("处理优先级"),
});

type CreateSnapshotParams = z.infer<typeof paramsSchema>;

interface CreateSnapshotResult {
  snapshotId: number;
  jobId: string;
  status: "pending";
  estimatedWaitTime: number;
  bookmarkTitle: string;
  message: string;
}

// ============================================
// Tool 实现
// ============================================

export const createSnapshotTool: Tool<
  CreateSnapshotParams,
  CreateSnapshotResult
> = {
  definition: {
    name: "create_snapshot",
    description: BOOKMARK_TOOL_DESCRIPTIONS.create_snapshot,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: false,
    estimatedDurationMs: 500,
  },

  async execute(
    params: CreateSnapshotParams,
    context,
  ): Promise<ToolResult<CreateSnapshotResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 1. 验证书签存在且属于当前用户
      const { data: bookmark, error: fetchError } = await supabase
        .from("bookmarks")
        .select("id, title, url")
        .eq("id", params.bookmarkId)
        .eq("user_id", context.userId)
        .is("deleted_at", null)
        .single();

      if (fetchError || !bookmark) {
        return {
          success: false,
          error: "书签不存在或无权访问",
          errorCode: "NOT_FOUND",
        };
      }

      // 2. 检查配额
      const canCreate = await snapshotService.canCreateSnapshot(context.userId);
      if (!canCreate) {
        return {
          success: false,
          error: "快照配额已用完，请升级会员或删除旧快照",
          errorCode: "QUOTA_EXCEEDED",
        };
      }

      // 3. 检查是否已有活跃快照
      const existingSnapshot = await snapshotService.getActiveSnapshot(
        context.userId,
        params.bookmarkId,
      );

      if (existingSnapshot) {
        return {
          success: false,
          error: `该书签已有快照（状态: ${existingSnapshot.status}）`,
          errorCode: "ALREADY_EXISTS",
        };
      }

      // 4. 创建快照任务
      const result = await snapshotService.createSnapshot(
        context.userId,
        params.bookmarkId,
        {
          snapshotType: params.snapshotType,
          priority: params.priority,
          source: "api",
        },
      );

      logger.info(
        {
          toolName: "create_snapshot",
          userId: context.userId,
          bookmarkId: params.bookmarkId,
          snapshotId: result.snapshotId,
          snapshotType: params.snapshotType,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "create_snapshot: Success",
      );

      return {
        success: true,
        data: {
          snapshotId: result.snapshotId,
          jobId: result.jobId,
          status: "pending",
          estimatedWaitTime: result.estimatedWaitTime,
          bookmarkTitle: bookmark.title || "未命名书签",
          message: `快照任务已创建，预计 ${result.estimatedWaitTime} 秒后完成`,
        },
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(
        {
          toolName: "create_snapshot",
          userId: context.userId,
          bookmarkId: params.bookmarkId,
          error: errorMessage,
        },
        "create_snapshot: Failed",
      );

      return {
        success: false,
        error: `创建快照失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
