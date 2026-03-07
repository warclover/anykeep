/**
 * Knowledge Studio - Templates API
 * @route GET/POST /api/knowledge-studio/templates
 * @description 模板列表和创建
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import type { Database, Json } from "@/types/supabase";

import { withAuthMiddleware } from "@/lib/api/middleware";
const logger = createLogger("api:knowledge-studio:templates");

// 类型定义
type TemplateRow = Database["public"]["Tables"]["ks_custom_templates"]["Row"];
type TemplateInsert =
  Database["public"]["Tables"]["ks_custom_templates"]["Insert"];

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
export const GET = withAuthMiddleware(async (request, { userId }) => {
  const supabase = await createClient();
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
    { userId: userId, status, visibility, search, includePublic },
    "Fetching templates",
  );

  // 使用标准 Supabase 查询模式
  let query = supabase
    .from("ks_custom_templates")
    .select("*", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  // 用户自己的模板或公开模板
  if (includePublic) {
    query = query.or(`user_id.eq.${userId},visibility.eq.public`);
  } else {
    query = query.eq("user_id", userId);
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

  // 类型断言在结果层
  const templates = data as TemplateRow[] | null;

  return NextResponse.json({
    data: templates,
    pagination: {
      total: count || 0,
      limit,
      offset,
    },
  });
});

/**
 * POST /api/knowledge-studio/templates
 * 创建新模板
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  const supabase = await createClient();
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
    { userId: userId, name, baseBlueprint, visibility },
    "Creating template",
  );

  const insertData: TemplateInsert = {
    user_id: userId,
    name: name.trim(),
    description,
    icon,
    base_blueprint: baseBlueprint,
    variables: variables as Json,
    prompt_sections: promptSections as Json,
    output_format: outputFormat,
    visibility,
    status: "draft",
    tags,
  };

  // 使用标准 Supabase 插入模式
  const { data, error } = await supabase
    .from("ks_custom_templates")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    logger.error({ error: error.message }, "Create template failed");
    return NextResponse.json(
      { error: { code: "DATABASE_ERROR", message: "创建模板失败" } },
      { status: 500 },
    );
  }

  // 类型断言在结果层
  const template = data as TemplateRow | null;

  return NextResponse.json({ data: template }, { status: 201 });
});
