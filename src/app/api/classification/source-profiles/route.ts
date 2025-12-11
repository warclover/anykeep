/**
 * Source Profiles API
 * V4.2 来源画像 API
 *
 * GET /api/classification/source-profiles - 获取来源画像列表
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { sourceProfileService } from "@/lib/source-profile/source-profile.service";
import type { NextRequest } from "next/server";

// ============================================================================
// GET - 获取来源画像列表
// ============================================================================

interface SourceProfilesQueryParams {
  limit?: number;
  offset?: number;
  sortBy?: "sample_count" | "trust_score" | "last_seen_at";
  sortOrder?: "asc" | "desc";
}

/**
 * GET /api/classification/source-profiles
 * 获取当前用户的来源画像列表
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
    const params: SourceProfilesQueryParams = {
      limit: searchParams.get("limit")
        ? parseInt(searchParams.get("limit")!, 10)
        : 50,
      offset: searchParams.get("offset")
        ? parseInt(searchParams.get("offset")!, 10)
        : 0,
      sortBy:
        (searchParams.get("sortBy") as SourceProfilesQueryParams["sortBy"]) ||
        "sample_count",
      sortOrder:
        (searchParams.get("sortOrder") as SourceProfilesQueryParams["sortOrder"]) ||
        "desc",
    };

    // 获取来源画像列表
    const profiles = await sourceProfileService.findAllByUserId(user.id);

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

    // 应用分页
    const paginatedProfiles = sortedProfiles.slice(
      params.offset!,
      params.offset! + params.limit!,
    );

    return successResponse({
      profiles: paginatedProfiles,
      total: profiles.length,
      limit: params.limit,
      offset: params.offset,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage }, "GET /api/classification/source-profiles error");
    return internalError("获取来源画像失败");
  }
}
