/**
 * Folder Evolution Suggestions API v1
 *
 * GET /api/v1/folders/evolution/suggestions - 获取合并和拆分建议
 *
 * @module api/v1/folders/evolution/suggestions
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { mergeService, splitService } from "@/lib/folder-evolution";

// 查询参数 Schema
const QuerySchema = z.object({
  type: z.enum(["merge", "split", "all"]).default("all"),
  folderId: z.coerce.number().int().positive().optional(),
  folderIds: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

/**
 * GET /api/v1/folders/evolution/suggestions
 * 获取文件夹合并和拆分建议
 *
 * Query params:
 * - type: "merge" | "split" | "all" (default: "all")
 * - folderId: 分析特定文件夹（用于 split）
 * - folderIds: 逗号分隔的文件夹 ID（用于 merge 特定分析）
 * - limit: 返回建议数量限制 (default: 5)
 */
export const GET = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const { searchParams } = new URL(request.url);

    // 解析查询参数
    const params = QuerySchema.safeParse({
      type: searchParams.get("type") || "all",
      folderId: searchParams.get("folderId") || undefined,
      folderIds: searchParams.get("folderIds") || undefined,
      limit: searchParams.get("limit") || 5,
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

    const { type, folderId, folderIds, limit } = params.data;

    try {
      const result: {
        mergeSuggestions?: unknown[];
        splitSuggestions?: unknown[];
        mergeCandidateCount?: number;
        splitCandidateCount?: number;
      } = {};

      // 获取合并建议
      if (type === "merge" || type === "all") {
        if (folderIds) {
          // 分析特定文件夹组合
          const parsedIds = folderIds
            .split(",")
            .map((id) => parseInt(id.trim(), 10))
            .filter((id) => !isNaN(id));

          if (parsedIds.length >= 2) {
            const suggestion = await mergeService.getMergeSuggestion(
              userId,
              parsedIds,
            );
            result.mergeSuggestions = suggestion ? [suggestion] : [];
          }
        } else {
          // 获取所有合并候选
          const candidates = await mergeService.getMergeCandidates(userId);
          result.mergeSuggestions = candidates.slice(0, limit).map((c) => ({
            folder1: {
              id: c.folder1.folderId,
              name: c.folder1.name,
              bookmarkCount: c.folder1.bookmarkCount,
            },
            folder2: {
              id: c.folder2.folderId,
              name: c.folder2.name,
              bookmarkCount: c.folder2.bookmarkCount,
            },
            similarity: c.similarity,
            tagOverlap: c.tagOverlap,
            suggestedName: c.mergedName,
            reason: c.reason,
          }));
          result.mergeCandidateCount = candidates.length;
        }
      }

      // 获取拆分建议
      if (type === "split" || type === "all") {
        if (folderId) {
          // 分析特定文件夹
          const suggestion = await splitService.analyzeSplitOptions(
            userId,
            folderId,
          );
          result.splitSuggestions = suggestion ? [suggestion] : [];
        } else {
          // 获取所有拆分候选
          const candidates = await splitService.getSplitCandidates(userId);
          const suggestions = await Promise.all(
            candidates.slice(0, limit).map(async (candidate) => {
              return splitService.analyzeSplitOptions(userId, candidate.id);
            }),
          );
          result.splitSuggestions = suggestions.filter(Boolean);
          result.splitCandidateCount = candidates.length;
        }
      }

      return NextResponse.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          userId,
          type,
        },
        "[v1] Failed to get folder evolution suggestions",
      );

      return NextResponse.json(
        {
          success: false,
          error: { code: "INTERNAL_ERROR", message: "获取文件夹演化建议失败" },
        },
        { status: 500 },
      );
    }
  },
);
