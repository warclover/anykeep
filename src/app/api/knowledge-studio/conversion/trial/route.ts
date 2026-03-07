/**
 * Knowledge Studio - Trial State API
 * @route GET/POST /api/knowledge-studio/conversion/trial
 * @description 用户试用状态管理
 */

import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { createConversionTracker } from "@/lib/knowledge-studio/conversion/conversion-tracker";

import { withAuthMiddleware } from "@/lib/api/middleware";
const logger = createLogger("api:knowledge-studio:conversion:trial");

/**
 * GET /api/knowledge-studio/conversion/trial
 * 获取当前用户的试用状态
 */
export const GET = withAuthMiddleware(async (_request, { userId }) => {
  logger.info({ userId: userId }, "Getting trial state");

  const tracker = createConversionTracker();
  const trialState = await tracker.getTrialState(userId);

  if (!trialState) {
    return NextResponse.json(
      { data: null, message: "尚未开始试用" },
      { status: 200 },
    );
  }

  return NextResponse.json({ data: trialState });
});

/**
 * POST /api/knowledge-studio/conversion/trial
 * 开始试用期
 */
export const POST = withAuthMiddleware(async (_request, { userId }) => {
  logger.info({ userId: userId }, "Starting trial");

  const tracker = createConversionTracker();

  // 检查是否已有试用
  const existingTrial = await tracker.getTrialState(userId);
  if (existingTrial && existingTrial.status === "active") {
    return NextResponse.json(
      { data: existingTrial, message: "试用已在进行中" },
      { status: 200 },
    );
  }

  const trialState = await tracker.startTrial(userId);

  return NextResponse.json({ data: trialState }, { status: 201 });
});
