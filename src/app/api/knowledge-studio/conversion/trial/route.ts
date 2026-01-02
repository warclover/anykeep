/**
 * Knowledge Studio - Trial State API
 * @route GET/POST /api/knowledge-studio/conversion/trial
 * @description 用户试用状态管理
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import { createConversionTracker } from "@/lib/knowledge-studio/conversion/conversion-tracker";

const logger = createLogger("api:knowledge-studio:conversion:trial");

/**
 * GET /api/knowledge-studio/conversion/trial
 * 获取当前用户的试用状态
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "请先登录" } },
        { status: 401 },
      );
    }

    logger.info({ userId: user.id }, "Getting trial state");

    const tracker = createConversionTracker();
    const trialState = await tracker.getTrialState(user.id);

    if (!trialState) {
      return NextResponse.json(
        { data: null, message: "尚未开始试用" },
        { status: 200 },
      );
    }

    return NextResponse.json({ data: trialState });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Get trial state failed",
    );
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "获取试用状态失败" } },
      { status: 500 },
    );
  }
}

/**
 * POST /api/knowledge-studio/conversion/trial
 * 开始试用期
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "请先登录" } },
        { status: 401 },
      );
    }

    logger.info({ userId: user.id }, "Starting trial");

    const tracker = createConversionTracker();

    // 检查是否已有试用
    const existingTrial = await tracker.getTrialState(user.id);
    if (existingTrial && existingTrial.status === "active") {
      return NextResponse.json(
        { data: existingTrial, message: "试用已在进行中" },
        { status: 200 },
      );
    }

    const trialState = await tracker.startTrial(user.id);

    return NextResponse.json({ data: trialState }, { status: 201 });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Start trial failed",
    );
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "开始试用失败" } },
      { status: 500 },
    );
  }
}
