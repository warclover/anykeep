/**
 * 智能分类 v5.0 - 发布状态 API
 *
 * GET /api/classification/v5/rollout/status
 * 获取当前发布状态和监控指标
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getFeatureFlag } from "@/lib/classification/v5/rollout/feature-flag";
import { MonitoringService } from "@/lib/classification/v5/rollout/monitoring";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: NextRequest) {
  try {
    // 1. 验证用户身份（仅管理员可访问）
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    // TODO: 检查用户是否为管理员
    // const isAdmin = await checkUserIsAdmin(user.id);
    // if (!isAdmin) {
    //   return NextResponse.json({ error: '权限不足' }, { status: 403 });
    // }

    // 2. 获取 Feature Flag 状态
    const featureFlag = getFeatureFlag();
    const flagStats = featureFlag.getStats();

    // 3. 生成监控报告（最近 1 小时）
    const logger = console; // TODO: 使用实际 logger
    const monitoringService = new MonitoringService(logger);

    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 60 * 60 * 1000);
    const report = await monitoringService.generateReport(startTime, endTime);

    // 4. 返回状态
    return NextResponse.json({
      success: true,
      data: {
        featureFlag: flagStats,
        monitoring: report,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("获取发布状态失败:", error);
    return NextResponse.json(
      {
        error: "获取发布状态失败",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
