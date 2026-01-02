/**
 * Knowledge Studio - Templates API
 * @route GET/POST /api/knowledge-studio/templates
 * @description 模板列表和创建
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";

const logger = createLogger("api:knowledge-studio:templates");

/**
 * GET /api/knowledge-studio/templates
 * 获取用户模板列表
 *
 * Query params:
 * - status: 状态筛选 (draft|active|archived)
 * - visibility: 可见性筛选 (private|shared|public)
 * - search: 搜索关键词
 * - includePublic: 是否包含公开模板 (default: false)
 * - limit: 每页数量 (default: 20)
 * - offset: 偏移量 (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const visibility = searchParams.get("visibility");
    const search = searchParams.get("search");
    const includePublic = searchParams.get("includePublic") === "true";
    const limitParam = searchParams.get("limit") || "20";
    const offsetParam = searchParams.get("offset") || "0";

    // 参数验证
    const validStatuses = ["draft", "active", "archived"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_PARAMS",
            message: `状态必须是: ${validStatuses.join(", ")}`,
          },
        },
        { status: 400 },
      );
    }

    const validVisibilities = ["private", "shared", "public"];
    if (visibility && !validVisibilities.includes(visibility)) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_PARAMS",
            message: `可见性必须是: ${validVisibilities.join(", ")}`,
          },
        },
        { status: 400 },
      );
    }

    const limit = parseInt(limitParam, 10);
    const offset = parseInt(offsetParam, 10);

    if (isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_PARAMS",
            message: "limit 必须在 1-100 之间",
          },
        },
        { status: 400 },
      );
    }

    if (isNaN(offset) || offset < 0) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_PARAMS",
            message: "offset 必须是非负整数",
          },
        },
        { status: 400 },
      );
    }

    logger.info(
      { userId: user.id, status, visibility, search, includePublic },
      "Fetching templates",
    );

    // 构建查询
    let query = supabase
      .from("ks_custom_templates")
      .select("*", { count: "exact" })
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // 用户自己的模板或公开模板
    if (includePublic) {
      query = query.or(`user_id.eq.${user.id},visibility.eq.public`);
    } else {
      query = query.eq("user_id", user.id);
    }

    if (status) {
      query = query.eq("status", status);
    }

    if (visibility) {
      query = query.eq("visibility", visibility);
    }

    if (search) {
      // 转义特殊字符防止 SQL 注入
      const escapedSearch = search.replace(/[%_\\]/g, "\\$&");
      query = query.or(
        `name.ilike.%${escapedSearch}%,description.ilike.%${escapedSearch}%`,
      );
    }

    const { data, error, count } = await query;

    if (error) {
      logger.error({ error: error.message }, "Get templates failed");
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "获取模板列表失败" } },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data,
      pagination: {
        total: count || 0,
        limit,
        offset,
      },
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Get templates failed",
    );
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "获取模板列表失败" } },
      { status: 500 },
    );
  }
}

/**
 * POST /api/knowledge-studio/templates
 * 创建新模板
 */
export async function POST(request: NextRequest) {
  try {
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
      description = "",
      icon,
      baseBlueprint,
      variables = [],
      promptSections = [],
      outputFormat,
      visibility = "private",
      tags = [],
    } = body;

    // 参数校验
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: { code: "INVALID_PARAMS", message: "模板名称必填" } },
        { status: 400 },
      );
    }

    if (name.length > 100) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_PARAMS",
            message: "模板名称不能超过 100 字符",
          },
        },
        { status: 400 },
      );
    }

    // 校验 visibility
    const validVisibilities = ["private", "shared", "public"];
    if (!validVisibilities.includes(visibility)) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_PARAMS",
            message: `可见性必须是: ${validVisibilities.join(", ")}`,
          },
        },
        { status: 400 },
      );
    }

    // 校验数组类型
    if (!Array.isArray(variables)) {
      return NextResponse.json(
        { error: { code: "INVALID_PARAMS", message: "variables 必须是数组" } },
        { status: 400 },
      );
    }

    if (!Array.isArray(promptSections)) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_PARAMS",
            message: "promptSections 必须是数组",
          },
        },
        { status: 400 },
      );
    }

    if (!Array.isArray(tags)) {
      return NextResponse.json(
        { error: { code: "INVALID_PARAMS", message: "tags 必须是数组" } },
        { status: 400 },
      );
    }

    // 校验 tags 元素类型
    if (tags.some((tag: unknown) => typeof tag !== "string")) {
      return NextResponse.json(
        { error: { code: "INVALID_PARAMS", message: "tags 必须是字符串数组" } },
        { status: 400 },
      );
    }

    logger.info(
      { userId: user.id, name, baseBlueprint, visibility },
      "Creating template",
    );

    const { data, error } = await supabase
      .from("ks_custom_templates")
      .insert({
        user_id: user.id,
        name: name.trim(),
        description,
        icon,
        base_blueprint: baseBlueprint,
        variables,
        prompt_sections: promptSections,
        output_format: outputFormat,
        visibility,
        status: "draft",
        tags,
      })
      .select()
      .single();

    if (error) {
      logger.error({ error: error.message }, "Create template failed");
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "创建模板失败" } },
        { status: 500 },
      );
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Create template failed",
    );
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "创建模板失败" } },
      { status: 500 },
    );
  }
}
