/**
 * Knowledge Studio - Consumption API
 * @route GET /api/knowledge-studio/billing/consumption
 * @description 获取消费记录和汇总
 */

import { NextResponse } from "next/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import type { Database } from "@/types/supabase";

const logger = createLogger("api:knowledge-studio:billing:consumption");

// 类型定义
type ConsumptionRecordInsert =
  Database["public"]["Tables"]["ks_consumption_records"]["Insert"];
type ConsumptionRecordRow =
  Database["public"]["Tables"]["ks_consumption_records"]["Row"];

/**
 * GET /api/knowledge-studio/billing/consumption
 * 获取消费汇总
 *
 * Query params:
 * - startDate: 开始日期 (ISO 格式, required)
 * - endDate: 结束日期 (ISO 格式, required)
 */
export const GET = withAuthMiddleware(async (request, { userId }) => {
  const supabase = await createClient();

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  // 参数校验
  if (!startDate || !endDate) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_PARAMS",
          message: "startDate 和 endDate 参数必填",
        },
      },
      { status: 400 },
    );
  }

  logger.info({ userId, startDate, endDate }, "Fetching consumption summary");

  // 调用 RPC 获取消费汇总 - 使用标准 Supabase 模式
  const { data, error } = await supabase.rpc("get_consumption_summary", {
    p_user_id: userId,
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (error) {
    logger.error({ error: error.message }, "Get consumption summary failed");
    return NextResponse.json(
      { error: { code: "DATABASE_ERROR", message: "获取消费汇总失败" } },
      { status: 500 },
    );
  }

  return NextResponse.json({ data });
});

/**
 * POST /api/knowledge-studio/billing/consumption
 * 记录消费
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  const supabase = await createClient();

  const body = await request.json();
  const {
    usageType,
    description,
    amount = 1,
    cost = 0,
    reportId,
    blueprintType,
  } = body;

  // 参数校验
  if (!usageType || !description) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_PARAMS",
          message: "usageType 和 description 参数必填",
        },
      },
      { status: 400 },
    );
  }

  logger.info({ userId, usageType, amount, cost }, "Recording consumption");

  const insertData: ConsumptionRecordInsert = {
    user_id: userId,
    usage_type: usageType,
    description,
    amount,
    cost,
    report_id: reportId || null,
    blueprint_type: blueprintType || null,
  };

  // 使用标准 Supabase 插入模式
  const { data, error } = await supabase
    .from("ks_consumption_records")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    logger.error({ error: error.message }, "Record consumption failed");
    return NextResponse.json(
      { error: { code: "DATABASE_ERROR", message: "记录消费失败" } },
      { status: 500 },
    );
  }

  // 类型断言在结果层
  const record = data as ConsumptionRecordRow | null;

  return NextResponse.json({ data: record }, { status: 201 });
});
