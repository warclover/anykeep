/**
 * Knowledge Studio - Template Clone API
 * @route POST /api/knowledge-studio/templates/[id]/clone
 * @description 克隆模板
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import type { Database } from "@/types/supabase";

const logger = createLogger("api:knowledge-studio:templates:[id]:clone");

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/knowledge-studio/templates/[id]/clone
 * 克隆模板
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "请先登录" } },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const { newName } = body;

    logger.info(
      { userId: user.id, templateId: id, newName },
      "Cloning template",
    );

    // 调用 RPC 克隆模板
    // 注意：RPC 函数类型可能未在 Database 类型中定义，使用类型断言
    // 但确保参数类型安全
    type CloneTemplateParams = {
      p_template_id: string;
      p_new_name: string | null;
    };
    const { data, error } = await (
      supabase.rpc as {
        (
          fnName: "clone_template",
          params: CloneTemplateParams,
        ): Promise<{
          data: string | null; // 返回新模板 ID
          error: { message: string } | null;
        }>;
      }
    )("clone_template", {
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

    // 获取克隆后的模板详情
    type TemplateRow =
      Database["public"]["Tables"]["ks_custom_templates"]["Row"];
    const { data: clonedTemplate, error: fetchError } = await (
      supabase.from("ks_custom_templates") as {
        select: (columns: string) => {
          eq: (
            column: string,
            value: string,
          ) => {
            single: () => Promise<{
              data: TemplateRow | null;
              error: { message: string } | null;
            }>;
          };
        };
      }
    )
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

    return NextResponse.json({ data: clonedTemplate }, { status: 201 });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Clone template failed",
    );
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "克隆模板失败" } },
      { status: 500 },
    );
  }
}
