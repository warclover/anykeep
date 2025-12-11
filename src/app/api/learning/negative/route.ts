/**
 * Negative Sample Learning API
 * V4.2 负样本学习 API
 *
 * GET /api/learning/negative - 获取用户的排除规则列表
 * POST /api/learning/negative - 手动创建排除规则
 * DELETE /api/learning/negative - 删除排除规则
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  badRequestError,
  unauthorizedError,
  internalError,
} from "@/lib/utils/api-response";
import {
  negativeSampleService,
  type ExclusionType,
  type CreatedFrom,
} from "@/lib/classification/learning/negative-sample.service";
import { learningEventHandler } from "@/lib/classification/learning/learning-event-handler";
import type { NextRequest } from "next/server";

/**
 * GET /api/learning/negative
 * 获取用户的排除规则列表
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedError("请先登录");
    }

    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get("folderId");
    const exclusionType = searchParams.get("type") as ExclusionType | null;
    const includeExpired = searchParams.get("includeExpired") === "true";
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // 获取排除规则
    const exclusions = await negativeSampleService.getUserExclusions(user.id, {
      folderId: folderId ? parseInt(folderId, 10) : undefined,
      exclusionType: exclusionType || undefined,
      includeExpired,
      limit,
      offset,
    });

    // 获取统计信息
    const stats = await negativeSampleService.getUserStats(user.id);

    return successResponse({
      exclusions,
      stats,
      pagination: {
        limit,
        offset,
        total: stats.total,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return internalError(`获取排除规则失败: ${message}`);
  }
}

/**
 * POST /api/learning/negative
 * 手动创建排除规则或从操作中学习
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedError("请先登录");
    }

    const body = await request.json();
    const { action } = body;

    // 根据 action 类型处理
    switch (action) {
      case "create": {
        // 手动创建排除规则
        const { folderId, type, value, weight } = body;

        if (!folderId || !type || !value) {
          return badRequestError("缺少必要参数: folderId, type, value");
        }

        if (!["tag", "source", "keyword"].includes(type)) {
          return badRequestError("无效的排除类型");
        }

        const exclusion = await negativeSampleService.createExclusion({
          userId: user.id,
          folderId,
          exclusionType: type as ExclusionType,
          excludedValue: value,
          weight: weight || 0.5,
          createdFrom: "user_reject" as CreatedFrom,
          expiresInDays: 90,
        });

        return successResponse({
          success: true,
          exclusion,
        });
      }

      case "learn_from_move": {
        // 从书签移动中学习
        const {
          bookmarkId,
          sourceFolderId,
          targetFolderId,
          bookmarkTags,
          bookmarkSourceId,
        } = body;

        if (!bookmarkId || !sourceFolderId || !targetFolderId) {
          return badRequestError("缺少必要参数: bookmarkId, sourceFolderId, targetFolderId");
        }

        const result = await learningEventHandler.learnFromBookmarkMove({
          userId: user.id,
          bookmarkId,
          sourceFolderId,
          targetFolderId,
          bookmarkTags,
          bookmarkSourceId,
        });

        return successResponse({
          success: result.success,
          exclusionsCreated: result.exclusionsCreated,
        });
      }

      case "learn_from_bulk_move": {
        // 从批量移动中学习
        const {
          bookmarkIds,
          sourceFolderId,
          targetFolderId,
          commonTags,
          commonSourceId,
        } = body;

        if (!bookmarkIds || !sourceFolderId || !targetFolderId) {
          return badRequestError("缺少必要参数: bookmarkIds, sourceFolderId, targetFolderId");
        }

        const result = await learningEventHandler.learnFromBulkMove({
          userId: user.id,
          bookmarkIds,
          sourceFolderId,
          targetFolderId,
          commonTags,
          commonSourceId,
        });

        return successResponse({
          success: result.success,
          exclusionsCreated: result.exclusionsCreated,
        });
      }

      case "batch_create": {
        // 批量创建排除规则
        const { folderId, exclusions } = body;

        if (!folderId || !exclusions || !Array.isArray(exclusions)) {
          return badRequestError("缺少必要参数: folderId, exclusions");
        }

        const result = await negativeSampleService.createBatchExclusions({
          userId: user.id,
          folderId,
          exclusions: exclusions.map(
            (e: { type: ExclusionType; value: string; weight?: number }) => ({
              type: e.type,
              value: e.value,
              weight: e.weight,
            }),
          ),
          createdFrom: "user_reject" as CreatedFrom,
        });

        return successResponse({
          success: true,
          created: result.created,
          skipped: result.skipped,
        });
      }

      default:
        return badRequestError(`未知操作: ${action}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return internalError(`操作失败: ${message}`);
  }
}

/**
 * DELETE /api/learning/negative
 * 删除排除规则
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedError("请先登录");
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const action = searchParams.get("action");

    if (action === "cleanup_expired") {
      // 清理过期规则
      const count = await negativeSampleService.cleanupExpired();
      return successResponse({
        success: true,
        cleanedUp: count,
      });
    }

    if (!id) {
      return badRequestError("缺少排除规则 ID");
    }

    const exclusionId = parseInt(id, 10);
    if (isNaN(exclusionId)) {
      return badRequestError("无效的排除规则 ID");
    }

    // 获取规则验证权限
    const exclusions = await negativeSampleService.getUserExclusions(user.id, {
      limit: 1000,
    });
    const exclusion = exclusions.find((e) => e.id === exclusionId);

    if (!exclusion) {
      return badRequestError("排除规则不存在或无权删除");
    }

    await negativeSampleService.deleteExclusion(exclusionId);

    return successResponse({
      success: true,
      deleted: exclusionId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return internalError(`删除失败: ${message}`);
  }
}
