/**
 * Source Profiles API
 * V4.2 来源画像 API
 *
 * GET /api/sources - 获取用户所有来源画像
 * GET /api/sources?url=xxx - 获取特定 URL 的匹配结果
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import type { NextRequest } from "next/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { successResponse, badRequestError } from "@/lib/utils/api-response";
import { sourceProfileService } from "@/lib/source-profile/source-profile.service";

/**
 * GET /api/sources
 * 获取来源画像
 */
export const GET = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");
    const sourceId = searchParams.get("sourceId");
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // 查询特定 URL 的匹配
    if (url) {
      const match = await sourceProfileService.getQuickMatch(userId, url);
      return successResponse({
        type: "match",
        url,
        result: match,
      });
    }

    // 查询特定来源
    if (sourceId) {
      const profile = await sourceProfileService.findBySourceId(
        userId,
        sourceId,
      );
      if (!profile) {
        return successResponse({
          type: "profile",
          sourceId,
          profile: null,
        });
      }
      return successResponse({
        type: "profile",
        sourceId,
        profile,
      });
    }

    // 查询所有来源画像
    const profiles = await sourceProfileService.findAllByUserId(userId);

    // 简单分页
    const paginatedProfiles = profiles.slice(offset, offset + limit);

    return successResponse({
      type: "list",
      total: profiles.length,
      limit,
      offset,
      profiles: paginatedProfiles,
      summary: {
        totalSources: profiles.length,
        highTrustSources: profiles.filter((p) => p.trustScore >= 80).length,
        totalSamples: profiles.reduce((sum, p) => sum + p.sampleCount, 0),
        avgConfidence:
          profiles.length > 0
            ? Math.round(
                profiles.reduce((sum, p) => sum + (p.avgConfidence || 0), 0) /
                  profiles.length,
              )
            : 0,
      },
    });
  },
);

/**
 * DELETE /api/sources?sourceId=xxx
 * 删除来源画像
 */
export const DELETE = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get("sourceId");

    if (!sourceId) {
      return badRequestError("缺少 sourceId 参数");
    }

    await sourceProfileService.delete(userId, sourceId);

    return successResponse({
      deleted: true,
      sourceId,
    });
  },
);

/**
 * PATCH /api/sources
 * 更新来源可信度
 */
export const PATCH = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const body = await request.json();
    const { sourceId, trustAdjustment, domains } = body;

    if (!sourceId) {
      return badRequestError("缺少 sourceId");
    }

    // 更新可信度
    if (typeof trustAdjustment === "number") {
      await sourceProfileService.updateTrustScore(
        userId,
        sourceId,
        trustAdjustment,
      );
    }

    // 更新领域标签
    if (Array.isArray(domains) && domains.length > 0) {
      await sourceProfileService.addDomains(userId, sourceId, domains);
    }

    // 返回更新后的画像
    const profile = await sourceProfileService.findBySourceId(userId, sourceId);

    return successResponse({
      updated: true,
      profile,
    });
  },
);
