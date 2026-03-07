/**
 * Knowledge Studio - Template Detail API
 * @route GET/PUT/DELETE /api/knowledge-studio/templates/[id]
 * @description 单个模板的读取、更新、删除
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import type { Database, Json } from "@/types/supabase";

import { withAuthMiddleware } from "@/lib/api/middleware";
const logger = createLogger("api:knowledge-studio:templates:[id]");

// 类型定义
type TemplateRow = Database["public"]["Tables"]["ks_custom_templates"]["Row"];
type TemplateUpdate =
  Database["public"]["Tables"]["ks_custom_templates"]["Update"];

/**
 * GET /api/knowledge-studio/templates/[id]
 * 获取单个模板详情
 */
export const GET = withAuthMiddleware<{ id: string }>(
  async (_request, { userId, params }) => {
    const { id } = await params;
    const supabase = await createClient();
    logger.info({ userId: userId, templateId: id }, "Fetching template");

    // 使用标准 Supabase 查询模式
    const { data, error } = await supabase
      .from("ks_custom_templates")
      .select("*")
      .eq("id", id)
      .or(`user_id.eq.${userId},visibility.eq.public`)
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

    // 类型断言在结果层
    const template = data as TemplateRow | null;

    return NextResponse.json({ data: template });
  },
);

/**
 * PUT /api/knowledge-studio/templates/[id]
 * 更新模板
 */
export const PUT = withAuthMiddleware<{ id: string }>(
  async (request, { userId, params }) => {
    const { id } = await params;
    const supabase = await createClient();
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
      { userId: userId, templateId: id, incrementVersion },
      "Updating template",
    );

    // 检查所有权 - 使用标准 Supabase 模式
    const { data: existing, error: checkError } = await supabase
      .from("ks_custom_templates")
      .select("id, version")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (checkError || !existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "模板不存在或无权限" } },
        { status: 404 },
      );
    }

    // 类型断言
    const existingTemplate = existing as { id: string; version: number };

    // 构建更新对象
    const updates: TemplateUpdate = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description;
    if (icon !== undefined) updates.icon = icon;
    if (baseBlueprint !== undefined) updates.base_blueprint = baseBlueprint;
    if (variables !== undefined) updates.variables = variables as Json;
    if (promptSections !== undefined)
      updates.prompt_sections = promptSections as Json;
    if (outputFormat !== undefined) updates.output_format = outputFormat;
    if (visibility !== undefined) updates.visibility = visibility;
    if (status !== undefined) updates.status = status;
    if (tags !== undefined) updates.tags = tags;
    if (incrementVersion) updates.version = existingTemplate.version + 1;

    // 使用标准 Supabase 更新模式
    const { data, error } = await supabase
      .from("ks_custom_templates")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      logger.error({ error: error.message }, "Update template failed");
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "更新模板失败" } },
        { status: 500 },
      );
    }

    // 类型断言在结果层
    const template = data as TemplateRow | null;

    return NextResponse.json({ data: template });
  },
);

/**
 * DELETE /api/knowledge-studio/templates/[id]
 * 删除模板
 */
export const DELETE = withAuthMiddleware<{ id: string }>(
  async (_request, { userId, params }) => {
    const { id } = await params;
    const supabase = await createClient();
    logger.info({ userId: userId, templateId: id }, "Deleting template");

    // 使用标准 Supabase 删除模式
    const { error } = await supabase
      .from("ks_custom_templates")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      logger.error({ error: error.message }, "Delete template failed");
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "删除模板失败" } },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  },
);
