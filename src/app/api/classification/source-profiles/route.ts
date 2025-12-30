/**
 * Source Profiles API (V2.0.0 - Consolidated)
 * V4.2 来源画像 API
 *
 * GET /api/classification/source-profiles - 获取来源画像列表（默认）
 * GET /api/classification/source-profiles?id=X - 获取单个来源画像详情
 * PUT /api/classification/source-profiles - 更新来源画像（需要 sourceId 参数）
 * DELETE /api/classification/source-profiles - 删除来源画像（需要 sourceId 参数）
 *
 * @version 2.0.0 - Merged /[id] endpoint
 * @since 2025-12-11
 * @updated 2025-12-24
 */

import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  notFoundError,
  badRequestError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { sourceProfileService } from "@/lib/source-profile/source-profile.service";
import type { NextRequest } from "next/server";

// ============================================================================
// Types
// ============================================================================

interface SourceProfilesQueryParams {
  limit?: number;
  offset?: number;
  sortBy?: "sample_count" | "trust_score" | "last_seen_at";
  sortOrder?: "asc" | "desc";
}

interface UpdateSourceProfileBody {
  /** 来源 ID (URL encoded) */
  sourceId: string;
  /** 来源名称 */
  sourceName?: string;
  /** 可信度调整 */
  trustScoreAdjustment?: number;
  /** 添加领域标签 */
  addDomains?: string[];
  /** 移除领域标签 */
  removeDomains?: string[];
}

interface DeleteSourceProfileBody {
  /** 来源 ID (URL encoded) */
  sourceId: string;
}

// ============================================================================
// GET - 获取来源画像
// ============================================================================

/**
 * GET /api/classification/source-profiles
 * @query id - 来源 ID，用于获取单个来源详情
 * @query limit - 分页限制
 * @query offset - 分页偏移
 * @query sortBy - 排序字段
 * @query sortOrder - 排序方向
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get("id");

    // 如果指定了 id，返回单个来源详情
    if (sourceId) {
      return handleSingleProfile(user.id, sourceId);
    }

    // 默认：返回列表
    return handleList(user.id, searchParams);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      { error: errorMessage },
      "GET /api/classification/source-profiles error",
    );
    return internalError("获取来源画像失败");
  }
}

/**
 * 处理单个来源画像请求
 */
async function handleSingleProfile(userId: string, sourceId: string) {
  // 解码 URL 编码的 sourceId
  const decodedSourceId = decodeURIComponent(sourceId);

  // 获取来源画像
  const profile = await sourceProfileService.findBySourceId(
    userId,
    decodedSourceId,
  );

  if (!profile) {
    return notFoundError("来源画像不存在");
  }

  return successResponse(profile);
}

/**
 * 处理来源画像列表请求
 */
async function handleList(userId: string, searchParams: URLSearchParams) {
  const limitParam = searchParams.get("limit");
  const offsetParam = searchParams.get("offset");
  const params: SourceProfilesQueryParams = {
    limit: limitParam ? parseInt(limitParam, 10) : 50,
    offset: offsetParam ? parseInt(offsetParam, 10) : 0,
    sortBy:
      (searchParams.get("sortBy") as SourceProfilesQueryParams["sortBy"]) ||
      "sample_count",
    sortOrder:
      (searchParams.get(
        "sortOrder",
      ) as SourceProfilesQueryParams["sortOrder"]) || "desc",
  };

  // 获取来源画像列表
  const profiles = await sourceProfileService.findAllByUserId(userId);

  // 应用排序
  const sortedProfiles = [...profiles].sort((a, b) => {
    let comparison = 0;
    switch (params.sortBy) {
      case "sample_count":
        comparison = a.sampleCount - b.sampleCount;
        break;
      case "trust_score":
        comparison = a.trustScore - b.trustScore;
        break;
      case "last_seen_at":
        comparison =
          new Date(a.lastSeenAt || 0).getTime() -
          new Date(b.lastSeenAt || 0).getTime();
        break;
    }
    return params.sortOrder === "desc" ? -comparison : comparison;
  });

  // 应用分页 - offset 和 limit 都有默认值，使用 ?? 确保类型安全
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 50;
  const paginatedProfiles = sortedProfiles.slice(offset, offset + limit);

  return successResponse({
    profiles: paginatedProfiles,
    total: profiles.length,
    limit: params.limit,
    offset: params.offset,
  });
}

// ============================================================================
// PUT - 更新来源画像 (V2.0.0 - merged from /[id])
// ============================================================================

/**
 * PUT /api/classification/source-profiles
 * 更新来源画像
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 解析请求体
    const body = (await request.json()) as UpdateSourceProfileBody;

    if (!body.sourceId) {
      return badRequestError("缺少 sourceId 参数");
    }

    const decodedSourceId = decodeURIComponent(body.sourceId);

    // 获取现有画像
    const existing = await sourceProfileService.findBySourceId(
      user.id,
      decodedSourceId,
    );

    if (!existing) {
      return notFoundError("来源画像不存在");
    }

    // 更新可信度
    if (body.trustScoreAdjustment !== undefined) {
      if (body.trustScoreAdjustment < -100 || body.trustScoreAdjustment > 100) {
        return badRequestError("可信度调整值必须在 -100 到 100 之间");
      }
      await sourceProfileService.updateTrustScore(
        user.id,
        decodedSourceId,
        body.trustScoreAdjustment,
      );
    }

    // 添加领域标签
    if (body.addDomains && body.addDomains.length > 0) {
      await sourceProfileService.addDomains(
        user.id,
        decodedSourceId,
        body.addDomains,
      );
    }

    // 移除领域标签
    if (body.removeDomains && body.removeDomains.length > 0) {
      await sourceProfileService.removeDomains(
        user.id,
        decodedSourceId,
        body.removeDomains,
      );
    }

    // 获取更新后的画像
    const updatedProfile = await sourceProfileService.findBySourceId(
      user.id,
      decodedSourceId,
    );

    logger.info(
      {
        userId: user.id,
        sourceId: decodedSourceId,
        action: "source_profile_updated",
      },
      "Source profile updated",
    );

    return successResponse({
      profile: updatedProfile,
      message: "来源画像已更新",
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      { error: errorMessage },
      "PUT /api/classification/source-profiles error",
    );
    return internalError("更新来源画像失败");
  }
}

// ============================================================================
// DELETE - 删除来源画像 (V2.0.0 - merged from /[id])
// ============================================================================

/**
 * DELETE /api/classification/source-profiles
 * 删除来源画像
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 解析请求体
    const body = (await request.json()) as DeleteSourceProfileBody;

    if (!body.sourceId) {
      return badRequestError("缺少 sourceId 参数");
    }

    const decodedSourceId = decodeURIComponent(body.sourceId);

    // 删除来源画像
    await sourceProfileService.delete(user.id, decodedSourceId);

    logger.info(
      {
        userId: user.id,
        sourceId: decodedSourceId,
        action: "source_profile_deleted",
      },
      "Source profile deleted",
    );

    return successResponse({
      message: "来源画像已删除",
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      { error: errorMessage },
      "DELETE /api/classification/source-profiles error",
    );
    return internalError("删除来源画像失败");
  }
}
