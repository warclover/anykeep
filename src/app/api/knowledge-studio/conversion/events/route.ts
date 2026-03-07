/**
 * Knowledge Studio - Conversion Events API
 * @route POST /api/knowledge-studio/conversion/events
 * @description 转化事件追踪
 */

import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { createConversionTracker } from "@/lib/knowledge-studio/conversion/conversion-tracker";
import type { ConversionTrigger } from "@/lib/knowledge-studio/conversion/types";

import { withAuthMiddleware } from "@/lib/api/middleware";
const logger = createLogger("api:knowledge-studio:conversion:events");

interface TrackEventBody {
  trigger: ConversionTrigger;
  context?: {
    sourcePage?: string;
    featureId?: string;
    remainingDays?: number;
    remainingQuota?: number;
  };
  userResponse?: "dismissed" | "clicked" | "converted" | "delayed";
}

/**
 * POST /api/knowledge-studio/conversion/events
 * 记录转化事件
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  const body = (await request.json()) as TrackEventBody;
  const { trigger, context = {}, userResponse } = body;

  // 参数校验
  const validTriggers: ConversionTrigger[] = [
    "quota_exhausted",
    "feature_locked",
    "trial_ending",
    "trial_expired",
    "manual_upgrade",
    "promo_offer",
  ];

  if (!trigger || !validTriggers.includes(trigger)) {
    return NextResponse.json(
      { error: { code: "INVALID_PARAMS", message: "无效的触发类型" } },
      { status: 400 },
    );
  }

  logger.info(
    { userId: userId, trigger, userResponse },
    "Tracking conversion event",
  );

  const tracker = createConversionTracker();
  await tracker.trackEvent({
    userId: userId,
    trigger,
    timestamp: new Date(),
    context,
    userResponse,
  });

  return NextResponse.json({ success: true });
});
