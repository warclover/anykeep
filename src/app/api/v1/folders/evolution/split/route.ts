/**
 * Folder Split API v1
 *
 * POST /api/v1/folders/evolution/split - 执行文件夹拆分
 *
 * @module api/v1/folders/evolution/split
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { splitService } from "@/lib/classification/services/split.service";

// 请求体 Schema
const SplitRequestSchema = z.object({
  folderId: z.number().int().positive(),
  subClusters: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        bookmarkIds: z.array(z.number().int().positive()).min(1),
      }),
    )
    .min(2)
    .max(10),
});

/**
 * POST /api/v1/folders/evolution/split
 * 执行文件夹拆分操作
 */
export const POST = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    // 解析请求体
    const body = await request.json();
    const validation = SplitRequestSchema.safeParse(body);

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

    const { folderId, subClusters } = validation.data;

    try {
      // 执行拆分
      const result = await splitService.executeSplit(
        userId,
        folderId,
        subClusters,
      );

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: { code: "SPLIT_FAILED", message: result.message },
          },
          { status: 400 },
        );
      }

      logger.info(
        {
          userId,
          folderId,
          newFoldersCount: result.newFolders?.length,
        },
        "[v1] Folder split completed",
      );

      return NextResponse.json({
        success: true,
        data: {
          newFolders: result.newFolders,
          message: result.message,
        },
      });
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          userId,
          folderId,
        },
        "[v1] Folder split failed",
      );

      return NextResponse.json(
        {
          success: false,
          error: { code: "INTERNAL_ERROR", message: "拆分文件夹失败" },
        },
        { status: 500 },
      );
    }
  },
);
