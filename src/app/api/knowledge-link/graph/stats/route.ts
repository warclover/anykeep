/**
 * Knowledge Link - Graph Stats API
 *
 * GET /api/knowledge-link/graph/stats
 * 获取用户知识图谱统计
 *
 * @version 1.0.0
 * @since 2025-12-15
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLinkService } from "@/lib/knowledge-link";
import type { KnowledgeGraphStats } from "@/lib/knowledge-link";
import { logger } from "@/lib/logger";

// ============================================================================
// Types
// ============================================================================

interface GetStatsResponse {
  success: boolean;
  data?: KnowledgeGraphStats;
  error?: string;
}

// ============================================================================
// GET Handler
// ============================================================================

/**
 * GET /api/knowledge-link/graph/stats
 *
 * 获取用户知识图谱统计
 *
 * Response:
 * - totalBookmarks: number - 书签总数
 * - totalLinks: number - 关联总数
 * - avgLinksPerBookmark: number - 平均每书签关联数
 * - linksByType: { semantic, entity, tag, topic } - 按类型统计
 * - linksByStrength: { strong, medium, weak } - 按强度统计
 */
export async function GET(): Promise<NextResponse<GetStatsResponse>> {
  try {
    // 1. 认证检查
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    // 2. 获取统计数据
    const linkService = getLinkService();
    const stats = await linkService.getGraphStats(user.id);

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error({ error }, "[API] Failed to get graph stats");
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
