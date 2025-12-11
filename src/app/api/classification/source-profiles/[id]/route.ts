/**
 * Single Source Profile API
 * V4.2 单个来源画像操作 API
 *
 * GET    /api/classification/source-profiles/[id] - 获取来源详情
 * PUT    /api/classification/source-profiles/[id] - 更新来源画像
 * DELETE /api/classification/source-profiles/[id] - 删除来源画像
 *
 * @version 1.0.0
 * @since 2025-12-11
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
// GET - 获取来源详情
// ============================================================================

/**
 * GET /api/classification/source-profiles/[id]
 * 获取单个来源画像详情
 * 注意：这里的 id 是 sourceId（如 "mp.weixin.qq.com/abc"），不是数据库 ID
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    const { id: sourceId } = await params;

    if (!sourceId) {
      return badRequestError("无效的来源 ID");
    }

    // 解码 URL 编码的 sourceId
    const decodedSourceId = decodeURIComponent(sourceId);

    // 获取来源画像
    const profile = await sourceProfileService.findBySourceId(user.id, decodedSourceId);

    if (!profile) {
      return notFoundError("来源画像不存在");
    }

    return successResponse(profile);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage }, "GET /api/classification/source-profiles/[id] error");
    return internalError("获取来源画像失败");
  }
}

// ============================================================================
// PUT - 更新来源画像
// ============================================================================

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
 * PUT /api/classification/source-profiles/[id]
 * 更新来源画像
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    const { id: sourceId } = await params;

    if (!sourceId) {
      return badRequestError("无效的来源 ID");
    }

    const decodedSourceId = decodeURIComponent(sourceId);

    // 解析请求体
    const body = (await request.json()) as UpdateSourceProfileBody;

    // 获取现有画像
    const existing = await sourceProfileService.findBySourceId(user.id, decodedSourceId);

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
      await sourceProfileService.addDomains(user.id, decodedSourceId, body.addDomains);
    }

    // TODO: 实现 removeDomains 功能

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
    logger.error({ error: errorMessage }, "PUT /api/classification/source-profiles/[id] error");
    return internalError("更新来源画像失败");
  }
}

// ============================================================================
// DELETE - 删除来源画像
// ============================================================================

/**
 * DELETE /api/classification/source-profiles/[id]
 * 删除来源画像
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    const { id: sourceId } = await params;

    if (!sourceId) {
      return badRequestError("无效的来源 ID");
    }

    const decodedSourceId = decodeURIComponent(sourceId);

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
    logger.error({ error: errorMessage }, "DELETE /api/classification/source-profiles/[id] error");
    return internalError("删除来源画像失败");
  }
}
