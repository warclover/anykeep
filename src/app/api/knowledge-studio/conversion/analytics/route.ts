/**
 * Knowledge Studio - Conversion Analytics API
 * @route GET /api/knowledge-studio/conversion/analytics
 * @description 转化漏斗分析
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import { createConversionAnalytics } from "@/lib/knowledge-studio/conversion/conversion-analytics";

const logger = createLogger("api:knowledge-studio:conversion:analytics");

/**
 * GET /api/knowledge-studio/conversion/analytics
 * 获取转化漏斗指标
 *
 * Query params:
 * - startDate: 开始日期 (ISO string)
 * - endDate: 结束日期 (ISO string)
 * - type: 分析类型 (funnel | insight | expiring | prospects)
 * - limit: 数量限制 (for prospects)
 * - withinDays: 过期天数 (for expiring)
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
    const type = searchParams.get("type") || "funnel";

    const analytics = createConversionAnalytics();

    switch (type) {
      case "funnel": {
        // 获取漏斗指标
        const startDateStr = searchParams.get("startDate");
        const endDateStr = searchParams.get("endDate");

        const endDate = endDateStr ? new Date(endDateStr) : new Date();
        const startDate = startDateStr
          ? new Date(startDateStr)
          : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 默认30天

        logger.info(
          { userId: user.id, startDate, endDate },
          "Getting funnel metrics",
        );

        const metrics = await analytics.getFunnelMetrics(startDate, endDate);
        return NextResponse.json({ data: metrics });
      }

      case "insight": {
        // 获取用户洞察
        logger.info({ userId: user.id }, "Getting user insight");

        const insight = await analytics.getUserInsight(user.id);
        return NextResponse.json({ data: insight });
      }

      case "expiring": {
        // 获取即将过期的试用
        const withinDays = parseInt(searchParams.get("withinDays") || "3", 10);

        logger.info({ userId: user.id, withinDays }, "Getting expiring trials");

        const trials = await analytics.getExpiringTrials(withinDays);
        return NextResponse.json({ data: trials });
      }

      case "prospects": {
        // 获取高价值潜在用户
        const limit = parseInt(searchParams.get("limit") || "10", 10);

        logger.info({ userId: user.id, limit }, "Getting high value prospects");

        const prospects = await analytics.getHighValueProspects(limit);
        return NextResponse.json({ data: prospects });
      }

      default:
        return NextResponse.json(
          { error: { code: "INVALID_PARAMS", message: "无效的分析类型" } },
          { status: 400 },
        );
    }
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Analytics request failed",
    );
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "获取分析数据失败" } },
      { status: 500 },
    );
  }
}
