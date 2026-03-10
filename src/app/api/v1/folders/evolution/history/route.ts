/**
 * Folder Evolution History API v1
 *
 * GET /api/v1/folders/evolution/history - 获取文件夹操作历史
 *
 * @module api/v1/folders/evolution/history
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { operationLogService } from "@/lib/operation-log";
import type { OperationSnapshotAction } from "@/types/supabase";

// 查询参数 Schema
const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  includeUndone: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  includeExpired: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  action: z.string().optional(),
});

// 有效的操作类型
const VALID_ACTIONS: OperationSnapshotAction[] = [
  "move",
  "batch_move",
  "batch_tag",
  "batch_delete",
  "merge_folder",
  "create_folder",
  "rename_folder",
  "delete_folder",
  "undo",
];

/**
 * GET /api/v1/folders/evolution/history
 * 获取用户的文件夹操作历史
 *
 * Query params:
 * - limit: 返回数量限制 (default: 50, max: 100)
 * - includeUndone: 包含已撤销的操作 (default: false)
 * - includeExpired: 包含已过期的操作 (default: false)
 * - action: 逗号分隔的操作类型过滤
 */
export const GET = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const { searchParams } = new URL(request.url);

    // 解析查询参数
    const params = QuerySchema.safeParse({
      limit: searchParams.get("limit") || 50,
      includeUndone: searchParams.get("includeUndone") || "false",
      includeExpired: searchParams.get("includeExpired") || "false",
      action: searchParams.get("action") || undefined,
    });

    if (!params.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "查询参数验证失败",
            details: params.error.flatten().fieldErrors,
          },
        },
        { status: 400 },
      );
    }

    const { limit, includeUndone, includeExpired, action } = params.data;

    // 解析操作类型过滤
    let actionFilter: OperationSnapshotAction[] | undefined;
    if (action) {
      const actions = action
        .split(",")
        .filter((a) =>
          VALID_ACTIONS.includes(a as OperationSnapshotAction),
        ) as OperationSnapshotAction[];
      if (actions.length > 0) {
        actionFilter = actions;
      }
    }

    try {
      // 获取操作历史
      const operations = await operationLogService.getOperationHistory(userId, {
        limit,
        includeUndone,
        includeExpired,
        actionFilter,
      });

      // 获取可撤销操作数量
      const undoableCount = await operationLogService.getUndoableCount(userId);

      return NextResponse.json({
        success: true,
        data: {
          items: operations,
          total: operations.length,
          undoableCount,
        },
      });
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          userId,
        },
        "[v1] Failed to get folder evolution history",
      );

      return NextResponse.json(
        {
          success: false,
          error: { code: "INTERNAL_ERROR", message: "获取操作历史失败" },
        },
        { status: 500 },
      );
    }
  },
);
