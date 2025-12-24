/**
 * Summary Mode API
 * V3.0 摘要模式 API
 *
 * @description 摘要模式设置与获取
 * - GET: 获取当前摘要模式和可用模式列表
 * - PUT: 设置摘要模式
 *
 * @version 1.0.0
 * @since 2025-12-14
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getUserSummaryMode,
  setUserSummaryMode,
  getAISummaryConfig,
} from "@/lib/classification/config/ai-summary-config";
import type { SummaryMode } from "@/lib/classification/types/ai-summary";
import { logger } from "@/lib/logger";

// ============================================================================
// 摘要模式信息
// ============================================================================

/**
 * 摘要模式详情
 */
const SUMMARY_MODE_INFO: Record<
  SummaryMode,
  {
    label: string;
    description: string;
    features: string[];
    recommended?: boolean;
  }
> = {
  standard: {
    label: "标准模式",
    description: "生成摘要和标签，满足基本收藏需求",
    features: [
      "智能摘要（TLDR + 要点）",
      "自动标签推荐",
      "情感分析",
      "智能文件夹推荐",
    ],
  },
  enhanced: {
    label: "增强模式",
    description: "深度分析内容，提取实体和关键数据，构建知识关联",
    features: [
      "全部标准模式功能",
      "实体提取（人名、公司、技术等）",
      "关键数据识别（统计数字、指标等）",
      "内容难度评估",
      "内容类型识别",
      "知识图谱关联",
    ],
    recommended: true,
  },
};

/**
 * 验证摘要模式是否有效
 */
function isValidSummaryMode(mode: unknown): mode is SummaryMode {
  return mode === "standard" || mode === "enhanced";
}

// ============================================================================
// GET - 获取摘要模式
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

    const config = getAISummaryConfig();
    const currentMode = await getUserSummaryMode(user.id);

    return NextResponse.json({
      success: true,
      data: {
        mode: currentMode,
        modeInfo: SUMMARY_MODE_INFO[currentMode],
        availableModes: Object.entries(SUMMARY_MODE_INFO).map(
          ([key, info]) => ({
            value: key,
            ...info,
          }),
        ),
        allowModeSwitch: config.allowModeSwitch,
        enhancedConfig: config.enhancedMode,
      },
    });
  } catch (error) {
    logger.error({ error }, "Failed to get summary mode");
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "获取摘要模式失败",
        },
      },
      { status: 500 },
    );
  }
}

// ============================================================================
// PUT - 更新摘要模式
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

    // 检查是否允许切换模式
    const config = getAISummaryConfig();
    if (!config.allowModeSwitch) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "当前系统不允许切换摘要模式",
            code: "MODE_SWITCH_DISABLED",
          },
        },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { mode } = body as { mode?: SummaryMode };

    if (!mode || !isValidSummaryMode(mode)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "无效的摘要模式，有效值为 'standard' 或 'enhanced'",
            code: "INVALID_SUMMARY_MODE",
          },
        },
        { status: 400 },
      );
    }

    const success = await setUserSummaryMode(user.id, mode);

    if (!success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "更新摘要模式失败，请稍后重试",
            code: "UPDATE_FAILED",
          },
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        mode,
        modeInfo: SUMMARY_MODE_INFO[mode],
      },
      message: `已切换到「${SUMMARY_MODE_INFO[mode].label}」`,
    });
  } catch (error) {
    logger.error({ error }, "Failed to update summary mode");
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "更新摘要模式失败",
        },
      },
      { status: 500 },
    );
  }
}
