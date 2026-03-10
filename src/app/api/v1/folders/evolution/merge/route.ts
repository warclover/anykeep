/**
 * Folder Merge API v1
 *
 * POST /api/v1/folders/evolution/merge - 执行文件夹合并
 *
 * @module api/v1/folders/evolution/merge
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { mergeService } from "@/lib/folder-evolution";

// 请求体 Schema
const MergeRequestSchema = z.object({
  sourceFolderIds: z.array(z.number().int().positive()).min(1).max(10),
  targetFolderId: z.number().int().positive(),
  newName: z.string().min(1).max(100).optional(),
});

/**
 * POST /api/v1/folders/evolution/merge
 * 执行文件夹合并操作
 */
export const POST = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    // 解析请求体
    const body = await request.json();
    const validation = MergeRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "请求参数验证失败",
            details: validation.error.flatten().fieldErrors,
          },
        },
        { status: 400 },
      );
    }

    const { sourceFolderIds, targetFolderId, newName } = validation.data;

    // 过滤掉目标文件夹（如果在源列表中）
    const filteredSourceIds = sourceFolderIds.filter(
      (id) => id !== targetFolderId,
    );

    if (filteredSourceIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "至少需要一个源文件夹（不能与目标文件夹相同）",
          },
        },
        { status: 400 },
      );
    }

    try {
      // 执行合并
      const result = await mergeService.executeMerge(
        userId,
        filteredSourceIds,
        targetFolderId,
        newName,
      );

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: { code: "MERGE_FAILED", message: result.message },
          },
          { status: 400 },
        );
      }

      logger.info(
        {
          userId,
          sourceFolderIds: filteredSourceIds,
          targetFolderId,
          mergedCount: result.mergedCount,
        },
        "[v1] Folder merge completed",
      );

      return NextResponse.json({
        success: true,
        data: {
          targetFolderId: result.targetFolderId,
          mergedCount: result.mergedCount,
          message: result.message,
        },
      });
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          userId,
          sourceFolderIds: filteredSourceIds,
          targetFolderId,
        },
        "[v1] Folder merge failed",
      );

      return NextResponse.json(
        {
          success: false,
          error: { code: "INTERNAL_ERROR", message: "合并文件夹失败" },
        },
        { status: 500 },
      );
    }
  },
);
