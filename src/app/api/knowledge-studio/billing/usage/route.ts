/**
 * Knowledge Studio - Usage API
 * @route GET /api/knowledge-studio/billing/usage
 * @description 获取使用量记录
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import type { Database, Json } from "@/types/supabase";

const logger = createLogger("api:knowledge-studio:billing:usage");

// 类型定义
type UsageRecordInsert =
  Database["public"]["Tables"]["ks_usage_records"]["Insert"];
type UsageRecordRow = Database["public"]["Tables"]["ks_usage_records"]["Row"];

/**
 * GET /api/knowledge-studio/billing/usage
 * 获取用户使用量统计
 *
 * Query params:
 * - period: 统计周期 (daily|weekly|monthly|yearly, default: monthly)
 * - startDate: 开始日期 (ISO 格式)
 * - endDate: 结束日期 (ISO 格式)
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "monthly";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // 参数校验
    const validPeriods = ["daily", "weekly", "monthly", "yearly"];
    if (!validPeriods.includes(period)) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_PARAMS",
            message: `period 须为: ${validPeriods.join(", ")}`,
          },
        },
        { status: 400 },
      );
    }

    logger.info(
      { userId: user.id, period, startDate, endDate },
      "Fetching usage stats",
    );

    // 调用 RPC 获取使用统计 - 使用标准 Supabase 模式
    const { data, error } = await supabase.rpc("get_user_usage_stats", {
      p_user_id: user.id,
      p_period: period,
      p_start_date: startDate ?? undefined,
      p_end_date: endDate ?? undefined,
    });

    if (error) {
      logger.error({ error: error.message }, "Get usage stats failed");
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "获取使用统计失败" } },
        { status: 500 },
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Get usage stats failed",
    );
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "获取使用统计失败" } },
      { status: 500 },
    );
  }
}

/**
 * POST /api/knowledge-studio/billing/usage
 * 记录使用量
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

    const body = await request.json();
    const { usageType, amount = 1, resourceId, metadata = {} } = body;

    // 参数校验
    const validTypes = [
      "generation",
      "chat_edit",
      "ai_recommendation",
      "export",
      "storage",
    ];
    if (!usageType || !validTypes.includes(usageType)) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_PARAMS",
            message: `usageType 须为: ${validTypes.join(", ")}`,
          },
        },
        { status: 400 },
      );
    }

    logger.info(
      { userId: user.id, usageType, amount, resourceId },
      "Recording usage",
    );

    const insertData: UsageRecordInsert = {
      user_id: user.id,
      usage_type: usageType,
      amount,
      resource_id: resourceId || null,
      metadata: metadata as Json,
    };

    // 使用标准 Supabase 插入模式
    const { data, error } = await supabase
      .from("ks_usage_records")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      logger.error({ error: error.message }, "Record usage failed");
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "记录使用量失败" } },
        { status: 500 },
      );
    }

    // 类型断言在结果层
    const record = data as UsageRecordRow | null;

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Record usage failed",
    );
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "记录使用量失败" } },
      { status: 500 },
    );
  }
}
