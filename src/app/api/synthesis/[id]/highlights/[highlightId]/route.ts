/**
 * 单个标注 API 路由
 *
 * GET    /api/synthesis/[id]/highlights/[highlightId] - 获取单个标注
 * PATCH  /api/synthesis/[id]/highlights/[highlightId] - 更新标注
 * DELETE /api/synthesis/[id]/highlights/[highlightId] - 删除标注
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { logger } from "@/lib/logger";
import {
  toHighlight,
  type UpdateHighlightRequest,
  type SynthesisHighlightRow,
} from "@/lib/synthesis/types/highlight";

/**
 * GET /api/synthesis/[id]/highlights/[highlightId]
 * 获取单个标注
 */
export const GET = withAuthMiddleware<{ id: string; highlightId: string }>(
  async (_request, { userId, params }) => {
    const supabase = await createClient();
    const { highlightId } = await params;

    // 查询标注
    const { data, error } = await supabase
      .from("synthesis_highlights")
      .select("*")
      .eq("id", highlightId)
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "标注不存在" }, { status: 404 });
    }

    const highlight = toHighlight(data as SynthesisHighlightRow);

    return NextResponse.json({ data: highlight });
  },
);

/**
 * PATCH /api/synthesis/[id]/highlights/[highlightId]
 * 更新标注（note 或 color）
 */
export const PATCH = withAuthMiddleware<{ id: string; highlightId: string }>(
  async (request, { userId, params }) => {
    const supabase = await createClient();
    const { highlightId } = await params;

    // 解析请求体
    const body: UpdateHighlightRequest = await request.json();

    // 构建更新数据
    const updateData: Record<string, unknown> = {};
    if (body.note !== undefined) {
      updateData.note = body.note;
    }
    if (body.color !== undefined) {
      updateData.color = body.color;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "没有需要更新的字段" },
        { status: 400 },
      );
    }

    // 更新标注
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = (await (
      supabase.from("synthesis_highlights") as any
    )
      .update(updateData)
      .eq("id", highlightId)
      .eq("user_id", userId)
      .select()
      .single()) as {
      data: SynthesisHighlightRow | null;
      error: { code?: string; message: string } | null;
    };

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "标注不存在" }, { status: 404 });
      }
      logger.error({ error, highlightId }, "Highlight API: Update error");
      return NextResponse.json({ error: "更新失败" }, { status: 500 });
    }

    const highlight = toHighlight(data as SynthesisHighlightRow);

    return NextResponse.json({ data: highlight });
  },
);

/**
 * DELETE /api/synthesis/[id]/highlights/[highlightId]
 * 删除标注
 */
export const DELETE = withAuthMiddleware<{ id: string; highlightId: string }>(
  async (_request, { userId, params }) => {
    const supabase = await createClient();
    const { highlightId } = await params;

    // 删除标注
    const { error } = await supabase
      .from("synthesis_highlights")
      .delete()
      .eq("id", highlightId)
      .eq("user_id", userId);

    if (error) {
      logger.error({ error, highlightId }, "Highlight API: Delete error");
      return NextResponse.json({ error: "删除失败" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  },
);
