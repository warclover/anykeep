/**
 * Tag Graph API
 * GET /api/tags/graph - 获取标签图谱可视化数据
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { tagGraphService } from "@/lib/classification/services/tag-graph.service";

/**
 * GET /api/tags/graph
 * 获取用户的标签图谱可视化数据
 */
export const GET = withAuthMiddleware(
  async (_request: NextRequest, { userId }) => {
    // 获取标签图谱
    const graphData = await tagGraphService.getGraphVisualization(userId);

    return NextResponse.json(
      {
        success: true,
        data: graphData,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=300, stale-while-revalidate=60",
        },
      },
    );
  },
);
