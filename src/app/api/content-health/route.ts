/**
 * 内容健康检测概览 API
 *
 * GET /api/content-health - 获取健康概览
 * POST /api/content-health - 触发健康检测
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { logger } from "@/lib/logger";
import type { HealthOverview } from "@/lib/ai-skills/skills/health-check/types";

// ============================================
// GET - 获取健康概览
// ============================================

export const GET = withAuthMiddleware(
  async (_request: NextRequest, { userId }) => {
    const supabase = await createClient();

    // 使用 RPC 函数获取健康概览
    const { data, error } = await supabase.rpc("get_health_overview", {
      p_user_id: userId,
    });

    if (error) {
      logger.error(
        { error: error.message, userId },
        "ContentHealth API: Failed to get overview",
      );
      return NextResponse.json(
        { success: false, error: "获取健康概览失败" },
        { status: 500 },
      );
    }

    const row = data?.[0];

    // 计算健康分数
    const brokenLinks = Number(row?.broken_links_count || 0);
    const duplicates = Number(row?.duplicates_count || 0);
    const staleContent = Number(row?.stale_count || 0);
    const totalIssues = Number(row?.total_issues || 0);

    const deduction = Math.min(
      100,
      brokenLinks * 3 + duplicates * 2 + staleContent * 0.5,
    );
    const healthScore = Math.max(0, Math.round(100 - deduction));

    const overview: HealthOverview = {
      brokenLinks,
      duplicates,
      staleContent,
      totalIssues,
      healthScore,
      lastCheckedAt: row?.last_checked_at || null,
    };

    return NextResponse.json({
      success: true,
      data: overview,
    });
  },
);

// ============================================
// POST - 触发健康检测
// ============================================

export const POST = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const supabase = await createClient();

    const body = await request.json().catch(() => ({}));
    const {
      checkTypes = ["broken_link", "duplicate", "stale"],
      scope = "all",
      folderId,
    } = body;

    // 创建检测运行记录
    const { data: run, error: runError } = await supabase
      .from("health_check_runs")
      .insert({
        user_id: userId,
        check_types: checkTypes,
        scope,
        folder_id: folderId,
        status: "running",
        progress: 0,
      })
      .select("id")
      .single();

    if (runError) {
      logger.error(
        { error: runError.message, userId },
        "ContentHealth API: Failed to create run",
      );
      return NextResponse.json(
        { success: false, error: "创建检测任务失败" },
        { status: 500 },
      );
    }

    // 返回运行 ID，前端可以轮询进度
    return NextResponse.json({
      success: true,
      data: {
        runId: run.id,
        status: "running",
        message: "健康检测已启动",
      },
    });
  },
);
