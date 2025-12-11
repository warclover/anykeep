/**
 * Tag Graph API
 * GET /api/tags/graph - 获取标签图谱可视化数据
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tagGraphService } from "@/lib/classification/services/tag-graph.service";
import { logger } from "@/lib/logger";

/**
 * GET /api/tags/graph
 * 获取用户的标签图谱可视化数据
 */
export async function GET() {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. 获取标签图谱
    const graphData = await tagGraphService.getGraphVisualization(user.id);

    return NextResponse.json({
      success: true,
      data: graphData,
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Failed to get tag graph",
    );

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
