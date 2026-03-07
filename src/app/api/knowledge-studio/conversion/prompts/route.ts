/**
 * Knowledge Studio - Upgrade Prompts API
 * @route GET/POST /api/knowledge-studio/conversion/prompts
 * @description 升级提示管理
 */

import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { createConversionTracker } from "@/lib/knowledge-studio/conversion/conversion-tracker";
import type { UpgradePromptType } from "@/lib/knowledge-studio/conversion/types";

import { withAuthMiddleware } from "@/lib/api/middleware";
const logger = createLogger("api:knowledge-studio:conversion:prompts");

/**
 * GET /api/knowledge-studio/conversion/prompts
 * 检查是否应显示升级提示
 */
export const GET = withAuthMiddleware(async (_request, { userId }) => {
  logger.info({ userId: userId }, "Checking upgrade prompt");

  const tracker = createConversionTracker();
  const prompt = await tracker.shouldShowUpgradePrompt(userId);

  return NextResponse.json({ data: prompt });
});

interface RecordResponseBody {
  promptType: UpgradePromptType;
  response: "dismissed" | "clicked" | "converted" | "delayed";
}

/**
 * POST /api/knowledge-studio/conversion/prompts
 * 记录用户对升级提示的响应
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
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
    { userId: userId, promptType, response },
    "Recording prompt response",
  );

  const tracker = createConversionTracker();
  await tracker.recordPromptResponse(userId, promptType, response);

  return NextResponse.json({ success: true });
});
