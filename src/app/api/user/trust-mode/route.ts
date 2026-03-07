/**
 * Trust Mode API
 * V4.2 托管模式 API
 *
 * @description 托管模式设置与获取
 * - GET: 获取当前托管模式和配置
 * - PUT: 更新托管模式
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { trustModeService } from "@/lib/trust-mode/trust-mode.service";
import { isValidTrustMode, TRUST_MODE_INFO } from "@/types/trust-mode";
import type { TrustMode } from "@/types/trust-mode";

// ============================================================================
// GET - 获取托管模式
// ============================================================================

export const GET = withAuthMiddleware(async (_request, { userId }) => {
  const effectiveConfig = await trustModeService.getEffectiveConfig(userId);

  return NextResponse.json({
    success: true,
    data: {
      mode: effectiveConfig.mode,
      modeInfo: TRUST_MODE_INFO[effectiveConfig.mode],
      config: effectiveConfig.config,
      stats: effectiveConfig.stats,
    },
  });
});

// ============================================================================
// PUT - 更新托管模式
// ============================================================================

export const PUT = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const body = await request.json();
    const { mode, reason } = body as { mode?: TrustMode; reason?: string };

    if (!mode || !isValidTrustMode(mode)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "无效的托管模式",
            code: "INVALID_TRUST_MODE",
          },
        },
        { status: 400 },
      );
    }

    const updatedRecord = await trustModeService.updateTrustMode(
      userId,
      mode,
      reason,
    );

    return NextResponse.json({
      success: true,
      data: {
        mode: updatedRecord.trust_mode,
        modeInfo: TRUST_MODE_INFO[updatedRecord.trust_mode],
        updatedAt: updatedRecord.updated_at,
      },
      message: `已切换到「${TRUST_MODE_INFO[mode].label}」模式`,
    });
  },
);
