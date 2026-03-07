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

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { withAuthMiddleware } from "@/lib/api/middleware";

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
export const GET = withAuthMiddleware<{ id: string }>(
  async (_request, { userId, params }) => {
    const supabase = await createClient();

    // 2. 获取规则 ID
    const { id } = await params;
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
      .eq("user_id", userId)
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
  },
);

/**
 * PUT /api/classification/v2/rules/[id]
 * 更新规则
 */
export const PUT = withAuthMiddleware<{ id: string }>(
  async (request, { userId, params }) => {
    const startTime = Date.now();

    const supabase = await createClient();

    // 2. 获取规则 ID
    const { id } = await params;
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
      .eq("user_id", userId);

    if (updateError) {
      throw new Error(`更新规则失败: ${updateError.message}`);
    }

    const latencyMs = Date.now() - startTime;

    logger.info(
      {
        userId,
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
  },
);

/**
 * DELETE /api/classification/v2/rules/[id]
 * 删除规则
 */
export const DELETE = withAuthMiddleware<{ id: string }>(
  async (_request, { userId, params }) => {
    const startTime = Date.now();

    const supabase = await createClient();

    // 2. 获取规则 ID
    const { id } = await params;
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
      .eq("user_id", userId);

    if (deleteError) {
      throw new Error(`删除规则失败: ${deleteError.message}`);
    }

    const latencyMs = Date.now() - startTime;

    logger.info(
      {
        userId,
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
  },
);
