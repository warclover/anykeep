/**
 * Knowledge Studio - Bills API
 * @route GET /api/knowledge-studio/billing/bills
 * @description 获取账单列表
 */

import { NextResponse } from "next/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";

const logger = createLogger("api:knowledge-studio:billing:bills");

/**
 * GET /api/knowledge-studio/billing/bills
 * 获取用户账单列表
 *
 * Query params:
 * - status: 账单状态筛选 (pending|paid|overdue|cancelled|refunded)
 * - limit: 每页数量 (default: 20)
 * - offset: 偏移量 (default: 0)
 */
export const GET = withAuthMiddleware(async (request, { userId }) => {
  const supabase = await createClient();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  // 参数校验
  const validStatuses = ["pending", "paid", "overdue", "cancelled", "refunded"];
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_PARAMS",
          message: `status 须为: ${validStatuses.join(", ")}`,
        },
      },
      { status: 400 },
    );
  }

  logger.info({ userId, status, limit, offset }, "Fetching bills");

  let query = supabase
    .from("ks_bills")
    .select("*, ks_bill_line_items(*)", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error, count } = await query;

  if (error) {
    logger.error({ error: error.message }, "Get bills failed");
    return NextResponse.json(
      { error: { code: "DATABASE_ERROR", message: "获取账单列表失败" } },
      { status: 500 },
    );
  }

  return NextResponse.json({
    data,
    pagination: {
      total: count || 0,
      limit,
      offset,
    },
  });
});
