/**
 * Knowledge Studio - Conversion Events API
 * @route POST /api/knowledge-studio/conversion/events
 * @description 转化事件追踪
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import { createConversionTracker } from "@/lib/knowledge-studio/conversion/conversion-tracker";
import type { ConversionTrigger } from "@/lib/knowledge-studio/conversion/types";

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
export async function POST(request: NextRequest) {
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
      { userId: user.id, trigger, userResponse },
      "Tracking conversion event",
    );

    const tracker = createConversionTracker();
    await tracker.trackEvent({
      userId: user.id,
      trigger,
      timestamp: new Date(),
      context,
      userResponse,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Track event failed",
    );
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "记录事件失败" } },
      { status: 500 },
    );
  }
}
