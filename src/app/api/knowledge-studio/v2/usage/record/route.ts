/**
 * Knowledge Studio v2 - Usage Record API
 * @route POST /api/knowledge-studio/v2/usage/record
 * @description 记录蓝图使用情况，用于个性化推荐
 */

import type { NextRequest } from "next/server";
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
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  logger.info({ requestId }, "Usage record request received");

  try {
    // 1. Auth check
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({
          error: { code: "UNAUTHORIZED", message: "请先登录" },
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    // 2. Parse request body
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
      );
    }

    const { blueprintId, success, platformStyle, lengthMode } =
      parseResult.data;

    // 3. Call RPC function to record usage
    // Note: RPC function types will be available after migration is applied
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcError } = await (supabase.rpc as any)(
      "record_blueprint_usage",
      {
        p_user_id: user.id,
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
        userId: user.id,
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
    );
  } catch (error) {
    logger.error(
      {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      },
      "Usage record request failed",
    );

    return new Response(
      JSON.stringify({
        error: {
          code: "INTERNAL_ERROR",
          message: "服务器内部错误",
        },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
