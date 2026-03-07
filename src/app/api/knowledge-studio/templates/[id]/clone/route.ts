/**
 * Knowledge Studio - Template Clone API
 * @route POST /api/knowledge-studio/templates/[id]/clone
 * @description 克隆模板
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import type { Database } from "@/types/supabase";

import { withAuthMiddleware } from "@/lib/api/middleware";
const logger = createLogger("api:knowledge-studio:templates:[id]:clone");

// 类型定义
type TemplateRow = Database["public"]["Tables"]["ks_custom_templates"]["Row"];

/**
 * POST /api/knowledge-studio/templates/[id]/clone
 * 克隆模板
 */
export const POST = withAuthMiddleware<{ id: string }>(
  async (request, { userId, params }) => {
    const { id } = await params;
    const supabase = await createClient();
    const body = await request.json().catch(() => ({}));
    const { newName } = body;

    logger.info(
      { userId: userId, templateId: id, newName },
      "Cloning template",
    );

    // 调用 RPC 克隆模板 - 使用标准 Supabase 模式
    const { data, error } = await supabase.rpc("clone_template", {
      p_template_id: id,
      p_new_name: newName || null,
    });

    if (error) {
      logger.error({ error: error.message }, "Clone template failed");
      if (error.message.includes("not found")) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "模板不存在或无权限访问" } },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "克隆模板失败" } },
        { status: 500 },
      );
    }

    // 获取克隆后的模板详情 - 使用标准 Supabase 模式
    const { data: clonedTemplate, error: fetchError } = await supabase
      .from("ks_custom_templates")
      .select("*")
      .eq("id", data as string)
      .single();

    if (fetchError) {
      logger.error(
        { error: fetchError.message },
        "Fetch cloned template failed",
      );
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "获取克隆模板失败" } },
        { status: 500 },
      );
    }

    // 类型断言在结果层
    const template = clonedTemplate as TemplateRow | null;

    return NextResponse.json({ data: template }, { status: 201 });
  },
);
