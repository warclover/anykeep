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
import { createClient } from "@/lib/supabase/server";
import { trustModeService } from "@/lib/trust-mode/trust-mode.service";
import { isValidTrustMode, TRUST_MODE_INFO } from "@/types/trust-mode";
import type { TrustMode } from "@/types/trust-mode";

// ============================================================================
// GET - 获取托管模式
// ============================================================================

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: "未登录" } },
        { status: 401 },
      );
    }

    const effectiveConfig = await trustModeService.getEffectiveConfig(user.id);

    return NextResponse.json({
      success: true,
      data: {
        mode: effectiveConfig.mode,
        modeInfo: TRUST_MODE_INFO[effectiveConfig.mode],
        config: effectiveConfig.config,
        stats: effectiveConfig.stats,
      },
    });
  } catch (error) {
    console.error("Failed to get trust mode:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "获取托管模式失败",
        },
      },
      { status: 500 },
    );
  }
}

// ============================================================================
// PUT - 更新托管模式
// ============================================================================

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: "未登录" } },
        { status: 401 },
      );
    }

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
      user.id,
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
  } catch (error) {
    console.error("Failed to update trust mode:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "更新托管模式失败",
        },
      },
      { status: 500 },
    );
  }
}
