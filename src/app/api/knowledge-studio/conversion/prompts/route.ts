/**
 * Knowledge Studio - Upgrade Prompts API
 * @route GET/POST /api/knowledge-studio/conversion/prompts
 * @description 升级提示管理
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import { createConversionTracker } from "@/lib/knowledge-studio/conversion/conversion-tracker";
import type { UpgradePromptType } from "@/lib/knowledge-studio/conversion/types";

const logger = createLogger("api:knowledge-studio:conversion:prompts");

/**
 * GET /api/knowledge-studio/conversion/prompts
 * 检查是否应显示升级提示
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

    logger.info({ userId: user.id }, "Checking upgrade prompt");

    const tracker = createConversionTracker();
    const prompt = await tracker.shouldShowUpgradePrompt(user.id);

    return NextResponse.json({ data: prompt });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Check upgrade prompt failed",
    );
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "检查升级提示失败" } },
      { status: 500 },
    );
  }
}

interface RecordResponseBody {
  promptType: UpgradePromptType;
  response: "dismissed" | "clicked" | "converted" | "delayed";
}

/**
 * POST /api/knowledge-studio/conversion/prompts
 * 记录用户对升级提示的响应
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

    const body = (await request.json()) as RecordResponseBody;
    const { promptType, response } = body;

    // 参数校验
    const validTypes: UpgradePromptType[] = [
      "modal",
      "banner",
      "inline",
      "tooltip",
    ];
    const validResponses = ["dismissed", "clicked", "converted", "delayed"];

    if (!promptType || !validTypes.includes(promptType)) {
      return NextResponse.json(
        { error: { code: "INVALID_PARAMS", message: "无效的提示类型" } },
        { status: 400 },
      );
    }

    if (!response || !validResponses.includes(response)) {
      return NextResponse.json(
        { error: { code: "INVALID_PARAMS", message: "无效的响应类型" } },
        { status: 400 },
      );
    }

    logger.info(
      { userId: user.id, promptType, response },
      "Recording prompt response",
    );

    const tracker = createConversionTracker();
    await tracker.recordPromptResponse(user.id, promptType, response);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Record prompt response failed",
    );
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "记录响应失败" } },
      { status: 500 },
    );
  }
}
