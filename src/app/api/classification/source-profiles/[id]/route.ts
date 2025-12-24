/**
 * @deprecated Use /api/classification/source-profiles instead
 *
 * This route is deprecated but kept for backward compatibility:
 * - GET: Use GET /api/classification/source-profiles?id=X
 * - PUT: Use PUT /api/classification/source-profiles with { sourceId: X, ... }
 * - DELETE: Use DELETE /api/classification/source-profiles with { sourceId: X }
 *
 * @version 2.0.0 - Deprecated, proxies to consolidated endpoint
 * @deprecated 2025-12-24
 */

import { type NextRequest, NextResponse } from "next/server";
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

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface UpdateSourceProfileBody {
  /** 来源名称 */
  sourceName?: string;
  /** 可信度调整 */
  trustScoreAdjustment?: number;
  /** 添加领域标签 */
  addDomains?: string[];
  /** 移除领域标签 */
  removeDomains?: string[];
}

/**
 * GET /api/classification/source-profiles/[id]
 * @deprecated Use GET /api/classification/source-profiles?id=X
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  // Log deprecation warning
  logger.warn(
    { endpoint: `/api/classification/source-profiles/${id}`, method: "GET" },
    "Deprecated endpoint called. Use GET /api/classification/source-profiles?id=X",
  );

  // Redirect to consolidated endpoint
  return NextResponse.redirect(
    new URL(
      `/api/classification/source-profiles?id=${encodeURIComponent(id)}`,
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    ),
    { status: 308 }, // Permanent redirect
  );
}

/**
 * PUT /api/classification/source-profiles/[id]
 * @deprecated Use PUT /api/classification/source-profiles with { sourceId: X, ... }
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  const { id: sourceId } = await context.params;

  // Log deprecation warning
  logger.warn(
    {
      endpoint: `/api/classification/source-profiles/${sourceId}`,
      method: "PUT",
    },
    "Deprecated endpoint called. Use PUT /api/classification/source-profiles",
  );

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    if (!sourceId) {
      return badRequestError("无效的来源 ID");
    }

    const decodedSourceId = decodeURIComponent(sourceId);
    const body = (await request.json()) as UpdateSourceProfileBody;

    // Get existing profile
    const existing = await sourceProfileService.findBySourceId(
      user.id,
      decodedSourceId,
    );

    if (!existing) {
      return notFoundError("来源画像不存在");
    }

    // Update trust score
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

    // Add domains
    if (body.addDomains && body.addDomains.length > 0) {
      await sourceProfileService.addDomains(
        user.id,
        decodedSourceId,
        body.addDomains,
      );
    }

    // Remove domains
    if (body.removeDomains && body.removeDomains.length > 0) {
      await sourceProfileService.removeDomains(
        user.id,
        decodedSourceId,
        body.removeDomains,
      );
    }

    // Get updated profile
    const updatedProfile = await sourceProfileService.findBySourceId(
      user.id,
      decodedSourceId,
    );

    return successResponse({
      profile: updatedProfile,
      message: "来源画像已更新",
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      { error: errorMessage },
      "PUT /api/classification/source-profiles/[id] error (deprecated)",
    );
    return internalError("更新来源画像失败");
  }
}

/**
 * DELETE /api/classification/source-profiles/[id]
 * @deprecated Use DELETE /api/classification/source-profiles with { sourceId: X }
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id: sourceId } = await context.params;

  // Log deprecation warning
  logger.warn(
    {
      endpoint: `/api/classification/source-profiles/${sourceId}`,
      method: "DELETE",
    },
    "Deprecated endpoint called. Use DELETE /api/classification/source-profiles",
  );

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    if (!sourceId) {
      return badRequestError("无效的来源 ID");
    }

    const decodedSourceId = decodeURIComponent(sourceId);

    // Delete source profile
    await sourceProfileService.delete(user.id, decodedSourceId);

    return successResponse({
      message: "来源画像已删除",
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      { error: errorMessage },
      "DELETE /api/classification/source-profiles/[id] error (deprecated)",
    );
    return internalError("删除来源画像失败");
  }
}
