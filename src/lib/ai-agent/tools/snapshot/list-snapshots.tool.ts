/**
 * ListSnapshots Tool - 快照列表工具
 *
 * 列出用户的快照记录，支持筛选和分页
 *
 * @version 1.0.0
 * @since 2026-01-10
 */

import { z } from "zod";
import type { Tool, ToolResult } from "../types";
import { logger } from "@/lib/logger";
import { buildToolDescription } from "../tool-description-templates";
import { snapshotService } from "@/lib/snapshot";
import type {
  SnapshotStatus,
  SnapshotType,
} from "@/lib/snapshot/snapshot.types";

// ============================================
// 参数和结果类型定义
// ============================================

const paramsSchema = z.object({
  status: z
    .enum(["pending", "processing", "completed", "failed", "expired"])
    .optional()
    .describe("筛选状态（可选，默认返回所有状态）"),
  snapshotType: z
    .enum(["basic", "standard", "full"])
    .optional()
    .describe("筛选快照类型（可选，默认返回所有类型）"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(20)
    .describe("返回数量限制（默认20，最大100）"),
  offset: z
    .number()
    .int()
    .min(0)
    .optional()
    .default(0)
    .describe("分页偏移量（默认0）"),
});

type ListSnapshotsParams = z.infer<typeof paramsSchema>;

interface SnapshotItem {
  id: number;
  bookmarkId: number;
  snapshotType: SnapshotType;
  status: SnapshotStatus;
  readableTitle?: string;
  readableExcerpt?: string;
  capturedAt?: string;
  hasScreenshot: boolean;
}

interface ListSnapshotsResult {
  snapshots: SnapshotItem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// ============================================
// 工具描述
// ============================================

const LIST_SNAPSHOTS_DESCRIPTION = buildToolDescription({
  core: "列出用户的网页快照记录，支持按状态和类型筛选。",
  scenarios: [
    '"查看我的快照"',
    '"列出所有完成的快照"',
    '"有哪些失败的快照"',
    '"我保存了哪些页面快照"',
  ],
  notes: [
    "支持按状态筛选：pending/processing/completed/failed/expired",
    "支持按类型筛选：basic/standard/full",
    "支持分页，默认返回最近20条",
    "按创建时间倒序排列",
  ],
  boundaries: ["emptyResult"],
});

// ============================================
// Tool 实现
// ============================================

export const listSnapshotsTool: Tool<ListSnapshotsParams, ListSnapshotsResult> =
  {
    definition: {
      name: "list_snapshots",
      description: LIST_SNAPSHOTS_DESCRIPTION,
      parameters: paramsSchema,
      category: "query",
      requiresConfirmation: false,
      estimatedDurationMs: 200,
    },

    async execute(
      params: ListSnapshotsParams,
      context,
    ): Promise<ToolResult<ListSnapshotsResult>> {
      const startTime = performance.now();

      try {
        // 调用 snapshotService 获取用户快照列表
        const snapshots = await snapshotService.getUserSnapshots(
          context.userId,
          {
            status: params.status as SnapshotStatus | undefined,
            snapshotType: params.snapshotType as SnapshotType | undefined,
            limit: params.limit ?? 20,
            offset: params.offset ?? 0,
          },
        );

        // 计算是否有更多数据
        const hasMore = snapshots.length === (params.limit ?? 20);

        const result: ListSnapshotsResult = {
          snapshots: snapshots.map((s) => ({
            id: s.id,
            bookmarkId: s.bookmarkId,
            snapshotType: s.snapshotType,
            status: s.status,
            readableTitle: s.readableTitle,
            readableExcerpt: s.readableExcerpt,
            capturedAt: s.capturedAt,
            hasScreenshot: s.hasScreenshot,
          })),
          total: snapshots.length,
          limit: params.limit ?? 20,
          offset: params.offset ?? 0,
          hasMore,
        };

        logger.info(
          {
            toolName: "list_snapshots",
            userId: context.userId,
            status: params.status,
            snapshotType: params.snapshotType,
            count: snapshots.length,
            executionTimeMs: Math.round(performance.now() - startTime),
          },
          "list_snapshots: Success",
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
            toolName: "list_snapshots",
            userId: context.userId,
            error: errorMessage,
          },
          "list_snapshots: Failed",
        );

        return {
          success: false,
          error: `获取快照列表失败: ${errorMessage}`,
          errorCode: "EXECUTION_ERROR",
        };
      }
    },
  };
