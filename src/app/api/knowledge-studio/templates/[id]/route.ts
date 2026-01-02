/**
 * Knowledge Studio - Template Detail API
 * @route GET/PUT/DELETE /api/knowledge-studio/templates/[id]
 * @description 单个模板的读取、更新、删除
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";

const logger = createLogger("api:knowledge-studio:templates:[id]");

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/knowledge-studio/templates/[id]
 * 获取单个模板详情
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    logger.info({ userId: user.id, templateId: id }, "Fetching template");

    const { data, error } = await supabase
      .from("ks_custom_templates")
      .select("*")
      .eq("id", id)
      .or(`user_id.eq.${user.id},visibility.eq.public`)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "模板不存在" } },
          { status: 404 },
        );
      }
      logger.error({ error: error.message }, "Get template failed");
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "获取模板失败" } },
        { status: 500 },
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Get template failed",
    );
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "获取模板失败" } },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/knowledge-studio/templates/[id]
 * 更新模板
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
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

    const body = await request.json();
    const {
      name,
      description,
      icon,
      baseBlueprint,
      variables,
      promptSections,
      outputFormat,
      visibility,
      status,
      tags,
      incrementVersion = false,
    } = body;

    logger.info(
      { userId: user.id, templateId: id, incrementVersion },
      "Updating template",
    );

    // 检查所有权
    const { data: existing, error: checkError } = await supabase
      .from("ks_custom_templates")
      .select("id, version")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (checkError || !existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "模板不存在或无权限" } },
        { status: 404 },
      );
    }

    // 构建更新对象
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description;
    if (icon !== undefined) updates.icon = icon;
    if (baseBlueprint !== undefined) updates.base_blueprint = baseBlueprint;
    if (variables !== undefined) updates.variables = variables;
    if (promptSections !== undefined) updates.prompt_sections = promptSections;
    if (outputFormat !== undefined) updates.output_format = outputFormat;
    if (visibility !== undefined) updates.visibility = visibility;
    if (status !== undefined) updates.status = status;
    if (tags !== undefined) updates.tags = tags;
    if (incrementVersion) updates.version = existing.version + 1;

    const { data, error } = await supabase
      .from("ks_custom_templates")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      logger.error({ error: error.message }, "Update template failed");
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "更新模板失败" } },
        { status: 500 },
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Update template failed",
    );
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "更新模板失败" } },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/knowledge-studio/templates/[id]
 * 删除模板
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    logger.info({ userId: user.id, templateId: id }, "Deleting template");

    const { error } = await supabase
      .from("ks_custom_templates")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      logger.error({ error: error.message }, "Delete template failed");
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "删除模板失败" } },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Delete template failed",
    );
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "删除模板失败" } },
      { status: 500 },
    );
  }
}
