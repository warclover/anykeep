/**
 * V4.0 分类追踪 API
 *
 * GET /api/classification/trace?traceId=xxx - 查询单个追踪
 * GET /api/classification/trace?recent=50 - 查询最近的追踪列表
 */

import { createClient } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createTraceStorageService } from "@/lib/classification/v3/services/trace.service";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 验证用户身份
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const traceId = searchParams.get("traceId");
    const recent = searchParams.get("recent");

    const traceService = createTraceStorageService(supabase);

    // 查询单个追踪
    if (traceId) {
      const trace = await traceService.getTrace(traceId);

      if (!trace) {
        return NextResponse.json({ error: "Trace not found" }, { status: 404 });
      }

      // 验证用户权限
      if (trace.userId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      return NextResponse.json({
        success: true,
        data: trace,
      });
    }

    // 查询最近的追踪列表
    if (recent) {
      const limit = Math.min(parseInt(recent, 10) || 50, 100);
      const traces = await traceService.getRecentTraces(user.id, limit);

      return NextResponse.json({
        success: true,
        data: traces,
        count: traces.length,
      });
    }

    return NextResponse.json(
      { error: "Missing traceId or recent parameter" },
      { status: 400 },
    );
  } catch (error) {
    console.error("Trace API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
