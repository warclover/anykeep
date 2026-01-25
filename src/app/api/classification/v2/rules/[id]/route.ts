/**
 * 智能分类 v2 - 单个规则操作
 *
 * GET    /api/classification/v2/rules/[id] - 获取单个规则
 * PUT    /api/classification/v2/rules/[id] - 更新规则
 * DELETE /api/classification/v2/rules/[id] - 删除规则
 *
 * @version 2.0.0
 * @since 2026-01-24 Phase 3
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * 更新规则 Schema
 */
const updateRuleSchema = z.object({
  isActive: z.boolean().optional(),
  pattern: z.string().min(1).max(500).optional(),
  description: z.string().max(500).optional(),
  confidence: z.number().min(0).max(100).optional(),
  targetFolderId: z
    .union([z.string(), z.number()])
    .transform(String)
    .optional(),
  targetFolderName: z.string().max(100).optional(),
});

/**
 * GET /api/classification/v2/rules/[id]
 * 获取单个规则详情
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "未授权" },
        { status: 401 },
      );
    }

    // 2. 获取规则 ID
    const { id } = await context.params;
    const ruleId = parseInt(id, 10);

    if (isNaN(ruleId)) {
      return NextResponse.json(
        { success: false, error: "无效的规则 ID" },
        { status: 400 },
      );
    }

    // 3. 获取规则
    const { data: rule, error: ruleError } = await supabase
      .from("user_classification_rules")
      .select("*")
      .eq("id", ruleId)
      .eq("user_id", user.id)
      .single();

    if (ruleError || !rule) {
      return NextResponse.json(
        { success: false, error: "规则不存在" },
        { status: 404 },
      );
    }

    // 4. 返回结果
    return NextResponse.json({
      success: true,
      data: {
        id: rule.id,
        type: rule.type,
        patternType: rule.pattern_type,
        pattern: rule.pattern,
        targetFolderId: rule.target_folder_id,
        targetFolderName: rule.target_folder_name,
        description: rule.description,
        priority: rule.priority,
        isActive: rule.is_active,
        matchCount: rule.match_count,
        createdAt: rule.created_at,
        updatedAt: rule.updated_at,
      },
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      "Classification v2 rules: GET [id] failed",
    );

    return NextResponse.json(
      {
        success: false,
        error: "获取规则失败",
        message: error instanceof Error ? error.message : "未知错误",
      },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/classification/v2/rules/[id]
 * 更新规则
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  const startTime = Date.now();

  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "未授权" },
        { status: 401 },
      );
    }

    // 2. 获取规则 ID
    const { id } = await context.params;
    const ruleId = parseInt(id, 10);

    if (isNaN(ruleId)) {
      return NextResponse.json(
        { success: false, error: "无效的规则 ID" },
        { status: 400 },
      );
    }

    // 3. 解析并验证请求体
    const body = await request.json();
    const validation = updateRuleSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "请求参数无效",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const {
      isActive,
      pattern,
      description,
      confidence,
      targetFolderId,
      targetFolderName,
    } = validation.data;

    // 4. 构建更新数据
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (isActive !== undefined) {
      updateData.is_active = isActive;
    }
    if (pattern !== undefined) {
      updateData.pattern = pattern;
    }
    if (description !== undefined) {
      updateData.description = description;
    }
    if (confidence !== undefined) {
      updateData.confidence = confidence;
    }
    if (targetFolderId !== undefined) {
      updateData.target_folder_id = parseInt(targetFolderId, 10);
    }
    if (targetFolderName !== undefined) {
      updateData.target_folder_name = targetFolderName;
    }

    // 5. 更新规则
    const { error: updateError } = await supabase
      .from("user_classification_rules")
      .update(updateData)
      .eq("id", ruleId)
      .eq("user_id", user.id);

    if (updateError) {
      throw new Error(`更新规则失败: ${updateError.message}`);
    }

    const latencyMs = Date.now() - startTime;

    logger.info(
      {
        userId: user.id,
        ruleId,
        updates: Object.keys(updateData).filter((k) => k !== "updated_at"),
        latencyMs,
      },
      "Classification v2 rules: Updated",
    );

    // 6. 返回结果
    return NextResponse.json({
      success: true,
      data: {
        ruleId,
        updated: Object.keys(updateData).filter((k) => k !== "updated_at"),
      },
    });
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        latencyMs,
      },
      "Classification v2 rules: PUT failed",
    );

    return NextResponse.json(
      {
        success: false,
        error: "更新规则失败",
        message: error instanceof Error ? error.message : "未知错误",
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/classification/v2/rules/[id]
 * 删除规则
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const startTime = Date.now();

  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "未授权" },
        { status: 401 },
      );
    }

    // 2. 获取规则 ID
    const { id } = await context.params;
    const ruleId = parseInt(id, 10);

    if (isNaN(ruleId)) {
      return NextResponse.json(
        { success: false, error: "无效的规则 ID" },
        { status: 400 },
      );
    }

    // 3. 删除规则
    const { error: deleteError } = await supabase
      .from("user_classification_rules")
      .delete()
      .eq("id", ruleId)
      .eq("user_id", user.id);

    if (deleteError) {
      throw new Error(`删除规则失败: ${deleteError.message}`);
    }

    const latencyMs = Date.now() - startTime;

    logger.info(
      {
        userId: user.id,
        ruleId,
        latencyMs,
      },
      "Classification v2 rules: Deleted",
    );

    // 4. 返回结果
    return NextResponse.json({
      success: true,
      data: {
        ruleId,
        deleted: true,
      },
    });
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        latencyMs,
      },
      "Classification v2 rules: DELETE failed",
    );

    return NextResponse.json(
      {
        success: false,
        error: "删除规则失败",
        message: error instanceof Error ? error.message : "未知错误",
      },
      { status: 500 },
    );
  }
}
