/**
 * Knowledge Studio v2 - Usage Record API
 * @route POST /api/knowledge-studio/v2/usage/record
 * @description 记录蓝图使用情况，用于个性化推荐
 */

import type { NextResponse } from "next/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import { z } from "zod";

const logger = createLogger("api:knowledge-studio:v2:usage:record");

/**
 * Request schema
 */
const RecordUsageRequestSchema = z.object({
  /** 蓝图 ID */
  blueprintId: z.string().min(1),
  /** 是否成功完成生成 */
  success: z.boolean(),
  /** 使用的平台风格 */
  platformStyle: z.enum(["wechat", "xiaohongshu", "general"]).optional(),
  /** 使用的输出长度 */
  lengthMode: z.enum(["short", "medium", "long"]).optional(),
});

/**
 * POST /api/knowledge-studio/v2/usage/record
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  const requestId = crypto.randomUUID();
  const supabase = await createClient();
  logger.info({ requestId }, "Usage record request received");

  // 1. Parse request body
  const body = await request.json();
  const parseResult = RecordUsageRequestSchema.safeParse(body);

  if (!parseResult.success) {
    return new Response(
      JSON.stringify({
        error: {
          code: "INVALID_REQUEST",
          message: "请求参数无效",
          details: parseResult.error.flatten(),
        },
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    ) as unknown as NextResponse;
  }

  const { blueprintId, success, platformStyle, lengthMode } = parseResult.data;

  // 2. Call RPC function to record usage
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: rpcError } = await (supabase.rpc as any)(
    "record_blueprint_usage",
    {
      p_user_id: userId,
      p_blueprint_id: blueprintId,
      p_success: success,
      p_platform_style: platformStyle || null,
      p_length_mode: lengthMode || null,
    },
  );

  if (rpcError) {
    logger.error({ requestId, error: rpcError }, "Failed to record usage");
    throw rpcError;
  }

  logger.info(
    {
      requestId,
      userId,
      blueprintId,
      success,
    },
    "Usage recorded successfully",
  );

  return new Response(
    JSON.stringify({
      success: true,
      message: "使用记录已保存",
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  ) as unknown as NextResponse;
});
