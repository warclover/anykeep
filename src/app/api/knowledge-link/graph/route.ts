/**
 * Knowledge Link - Graph API
 *
 * GET /api/knowledge-link/graph
 * 获取用户的知识图谱数据（用于可视化）
 *
 * @version 1.0.0
 * @since 2025-12-14
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGraphBuilderService } from "@/lib/knowledge-link";
import type { GraphData, GraphBuildOptions } from "@/lib/knowledge-link";
import type { LinkType } from "@/lib/knowledge-link";

// ============================================================================
// Types
// ============================================================================

interface GetGraphResponse {
  success: boolean;
  data?: GraphData;
  error?: string;
}

// ============================================================================
// GET Handler
// ============================================================================

/**
 * GET /api/knowledge-link/graph
 *
 * 获取用户的知识图谱数据
 *
 * Query Parameters:
 * - maxNodes: number (default: 100, max: 500) - 最大节点数
 * - minStrength: number (default: 0.3, range: 0-1) - 最小关联强度
 * - types: string (comma-separated) - 关联类型过滤
 * - includeIsolated: boolean (default: false) - 是否包含孤立节点
 */
export async function GET(
  request: NextRequest,
): Promise<NextResponse<GetGraphResponse>> {
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

    // 2. 解析查询参数
    const searchParams = request.nextUrl.searchParams;

    const maxNodes = Math.min(
      parseInt(searchParams.get("maxNodes") || "100", 10),
      500,
    );
    const minStrength = Math.max(
      0,
      Math.min(1, parseFloat(searchParams.get("minStrength") || "0.3")),
    );
    const typesParam = searchParams.get("types");
    const linkTypes = typesParam
      ? (typesParam.split(",").filter(Boolean) as LinkType[])
      : undefined;
    const includeIsolated = searchParams.get("includeIsolated") === "true";

    // 3. 构建选项
    const options: GraphBuildOptions = {
      maxNodes,
      minStrength,
      linkTypes,
      includeIsolated,
    };

    // 4. 获取图谱数据
    const graphBuilder = getGraphBuilderService();
    const graphData = await graphBuilder.getGraphData(user.id, options);

    return NextResponse.json({
      success: true,
      data: graphData,
    });
  } catch (error) {
    console.error("[API] Failed to get graph data:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
