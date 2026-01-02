/**
 * Knowledge Studio - Consumption API
 * @route GET /api/knowledge-studio/billing/consumption
 * @description 获取消费记录和汇总
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";

const logger = createLogger("api:knowledge-studio:billing:consumption");

/**
 * GET /api/knowledge-studio/billing/consumption
 * 获取消费汇总
 *
 * Query params:
 * - startDate: 开始日期 (ISO 格式, required)
 * - endDate: 结束日期 (ISO 格式, required)
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

    logger.info(
      { userId: user.id, startDate, endDate },
      "Fetching consumption summary",
    );

    // 调用 RPC 获取消费汇总
    const { data, error } = await supabase.rpc("get_consumption_summary", {
      p_user_id: user.id,
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
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Get consumption summary failed",
    );
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "获取消费汇总失败" } },
      { status: 500 },
    );
  }
}

/**
 * POST /api/knowledge-studio/billing/consumption
 * 记录消费
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

    logger.info(
      { userId: user.id, usageType, amount, cost },
      "Recording consumption",
    );

    const { data, error } = await supabase
      .from("ks_consumption_records")
      .insert({
        user_id: user.id,
        usage_type: usageType,
        description,
        amount,
        cost,
        report_id: reportId,
        blueprint_type: blueprintType,
      })
      .select()
      .single();

    if (error) {
      logger.error({ error: error.message }, "Record consumption failed");
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "记录消费失败" } },
        { status: 500 },
      );
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Record consumption failed",
    );
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "记录消费失败" } },
      { status: 500 },
    );
  }
}
