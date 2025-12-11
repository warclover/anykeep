/**
 * Trust Mode Settings API
 * V4.2 托管模式设置 API
 *
 * GET  /api/settings/trust-mode - 获取用户托管模式设置
 * PUT  /api/settings/trust-mode - 更新用户托管模式设置
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  badRequestError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { trustModeService } from "@/lib/trust-mode/trust-mode.service";
import type { TrustMode } from "@/types/trust-mode";
import type { NextRequest } from "next/server";

// ============================================================================
// GET - 获取托管模式设置
// ============================================================================

/**
 * GET /api/settings/trust-mode
 * 获取当前用户的托管模式设置
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 获取有效的托管模式配置（已包含统计信息）
    const effectiveConfig = await trustModeService.getEffectiveConfig(user.id);

    return successResponse({
      mode: effectiveConfig.mode,
      config: effectiveConfig.config,
      stats: effectiveConfig.stats,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage }, "GET /api/settings/trust-mode error");
    return internalError("获取托管模式设置失败");
  }
}

// ============================================================================
// PUT - 更新托管模式设置
// ============================================================================

interface UpdateTrustModeBody {
  mode: TrustMode;
  autoConfirmThreshold?: number;
  requireConfirmForNewFolder?: boolean;
  dailyAutoLimit?: number;
}

/**
 * PUT /api/settings/trust-mode
 * 更新用户的托管模式设置
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
    const body = (await request.json()) as UpdateTrustModeBody;

    // 验证模式值
    if (!body.mode || !["full_auto", "semi_auto", "manual"].includes(body.mode)) {
      return badRequestError("无效的托管模式");
    }

    // 验证阈值范围
    if (
      body.autoConfirmThreshold !== undefined &&
      (body.autoConfirmThreshold < 0 || body.autoConfirmThreshold > 100)
    ) {
      return badRequestError("自动确认阈值必须在 0-100 之间");
    }

    if (
      body.dailyAutoLimit !== undefined &&
      (body.dailyAutoLimit < 0 || body.dailyAutoLimit > 10000)
    ) {
      return badRequestError("每日自动分类限制必须在 0-10000 之间");
    }

    // 更新托管模式
    await trustModeService.updateTrustMode(user.id, body.mode);

    // 如果有配置覆盖，单独更新
    const hasOverrides =
      body.autoConfirmThreshold !== undefined ||
      body.requireConfirmForNewFolder !== undefined ||
      body.dailyAutoLimit !== undefined;

    if (hasOverrides) {
      const overrides: Record<string, unknown> = {};
      if (body.autoConfirmThreshold !== undefined) {
        overrides.classification = {
          autoConfirmThreshold: body.autoConfirmThreshold,
        };
      }
      if (body.requireConfirmForNewFolder !== undefined) {
        overrides.classification = {
          ...(overrides.classification as Record<string, unknown> || {}),
          requireConfirmForNewFolder: body.requireConfirmForNewFolder,
        };
      }
      if (body.dailyAutoLimit !== undefined) {
        overrides.folder = {
          dailyAutoLimit: body.dailyAutoLimit,
        };
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await trustModeService.updateOverrides(user.id, overrides as any);
    }

    // 获取更新后的配置
    const effectiveConfig = await trustModeService.getEffectiveConfig(user.id);

    logger.info(
      {
        userId: user.id,
        action: "trust_mode_updated",
        mode: body.mode,
      },
      "Trust mode settings updated",
    );

    return successResponse({
      mode: effectiveConfig.mode,
      config: effectiveConfig,
      message: "托管模式设置已更新",
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage }, "PUT /api/settings/trust-mode error");
    return internalError("更新托管模式设置失败");
  }
}
