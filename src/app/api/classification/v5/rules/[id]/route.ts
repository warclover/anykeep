/**
 * 智能分类 v5.0 - 单个规则操作 API
 *
 * PUT    /api/classification/v5/rules/[id] - 更新规则
 * DELETE /api/classification/v5/rules/[id] - 删除规则
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/classification/infrastructure/shared-services/logger";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PUT /api/classification/v5/rules/[id]
 * 更新规则（启用/禁用、编辑）
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  const logger = createLogger("RuleUpdateAPI");

  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.warn("未授权访问", { error: authError?.message });
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    // 2. 获取规则 ID
    const { id } = await context.params;
    const ruleId = parseInt(id, 10);

    if (isNaN(ruleId)) {
      return NextResponse.json({ error: "无效的规则 ID" }, { status: 400 });
    }

    // 3. 解析请求体
    const body = await request.json();

    // 4. 构建更新数据
    const updateData: Record<string, unknown> = {};

    if (body.isActive !== undefined) {
      updateData.is_active = body.isActive;
    }
    if (body.pattern !== undefined) {
      updateData.pattern = body.pattern;
    }
    if (body.description !== undefined) {
      updateData.description = body.description;
    }
    if (body.confidence !== undefined) {
      updateData.confidence = body.confidence;
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

    logger.info("规则更新成功", {
      userId: user.id,
      ruleId,
      updates: Object.keys(updateData),
    });

    // 6. 返回结果
    return NextResponse.json({
      success: true,
      data: {
        ruleId,
      },
    });
  } catch (error) {
    logger.error(
      "更新规则失败",
      error instanceof Error ? error : new Error(String(error)),
    );

    return NextResponse.json(
      {
        error: "更新规则失败",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/classification/v5/rules/[id]
 * 删除规则
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const logger = createLogger("RuleDeleteAPI");

  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.warn("未授权访问", { error: authError?.message });
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    // 2. 获取规则 ID
    const { id } = await context.params;
    const ruleId = parseInt(id, 10);

    if (isNaN(ruleId)) {
      return NextResponse.json({ error: "无效的规则 ID" }, { status: 400 });
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

    logger.info("规则删除成功", {
      userId: user.id,
      ruleId,
    });

    // 4. 返回结果
    return NextResponse.json({
      success: true,
      data: {
        ruleId,
      },
    });
  } catch (error) {
    logger.error(
      "删除规则失败",
      error instanceof Error ? error : new Error(String(error)),
    );

    return NextResponse.json(
      {
        error: "删除规则失败",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
