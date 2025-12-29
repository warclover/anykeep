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

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  toHighlight,
  type UpdateHighlightRequest,
  type SynthesisHighlightRow,
} from "@/lib/synthesis/types/highlight";

interface RouteContext {
  params: Promise<{ id: string; highlightId: string }>;
}

/**
 * GET /api/synthesis/[id]/highlights/[highlightId]
 * 获取单个标注
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { highlightId } = await context.params;

    // 验证用户身份
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    // 查询标注
    // Note: synthesis_highlights 表类型待重新生成，使用类型断言
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("synthesis_highlights")
      .select("*")
      .eq("id", highlightId)
      .eq("user_id", user.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "标注不存在" }, { status: 404 });
    }

    const highlight = toHighlight(data as SynthesisHighlightRow);

    return NextResponse.json({ data: highlight });
  } catch (error) {
    console.error("[Highlight API] Unexpected error:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

/**
 * PATCH /api/synthesis/[id]/highlights/[highlightId]
 * 更新标注（note 或 color）
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { highlightId } = await context.params;

    // 验证用户身份
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

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
    // Note: synthesis_highlights 表类型待重新生成，使用 any 类型断言
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("synthesis_highlights")
      .update(updateData)
      .eq("id", highlightId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "标注不存在" }, { status: 404 });
      }
      console.error("[Highlight API] Update error:", error);
      return NextResponse.json({ error: "更新失败" }, { status: 500 });
    }

    const highlight = toHighlight(data as SynthesisHighlightRow);

    return NextResponse.json({ data: highlight });
  } catch (error) {
    console.error("[Highlight API] Unexpected error:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

/**
 * DELETE /api/synthesis/[id]/highlights/[highlightId]
 * 删除标注
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { highlightId } = await context.params;

    // 验证用户身份
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    // 删除标注
    // Note: synthesis_highlights 表类型待重新生成，使用 any 类型断言
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("synthesis_highlights")
      .delete()
      .eq("id", highlightId)
      .eq("user_id", user.id);

    if (error) {
      console.error("[Highlight API] Delete error:", error);
      return NextResponse.json({ error: "删除失败" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Highlight API] Unexpected error:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
