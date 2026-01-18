/**
 * 智能分类 v5.0 - 规则管理 API
 *
 * GET    /api/classification/v5/rules - 获取用户的所有规则
 * POST   /api/classification/v5/rules - 创建新规则
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/classification/v5/shared/logger";
import { ChatToRuleService } from "@/lib/classification/v5/chat-to-rule";

/**
 * GET /api/classification/v5/rules
 * 获取用户的所有规则
 */
export async function GET(request: NextRequest) {
  const logger = createLogger("RulesAPI");

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

    // 2. 获取查询参数
    const searchParams = request.nextUrl.searchParams;
    const activeOnly = searchParams.get("activeOnly") === "true";

    // 3. 获取规则列表
    const chatToRuleService = new ChatToRuleService(supabase, logger);
    const rules = await chatToRuleService.getRules(activeOnly);

    logger.info("规则列表获取成功", {
      userId: user.id,
      count: rules.length,
      activeOnly,
    });

    // 4. 返回结果
    return NextResponse.json({
      success: true,
      data: {
        rules,
        total: rules.length,
      },
    });
  } catch (error) {
    logger.error("获取规则列表失败", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: "获取规则列表失败",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/classification/v5/rules
 * 创建新规则
 */
export async function POST(request: NextRequest) {
  const logger = createLogger("RulesAPI");

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

    // 2. 解析请求体
    const body = await request.json();

    // 3. 验证必需字段
    if (
      !body.ruleType ||
      !body.patternType ||
      !body.pattern ||
      !body.targetFolderId
    ) {
      logger.warn("缺少必需字段", { body });
      return NextResponse.json(
        {
          error: "缺少必需字段: ruleType, patternType, pattern, targetFolderId",
        },
        { status: 400 },
      );
    }

    // 4. 创建规则
    const chatToRuleService = new ChatToRuleService(supabase, logger);
    const ruleId = await chatToRuleService.createRule({
      ruleType: body.ruleType,
      patternType: body.patternType,
      pattern: body.pattern,
      targetFolderId: body.targetFolderId,
      targetFolderName: body.targetFolderName,
      description: body.description,
      confidence: body.confidence || 0.8,
    });

    logger.info("规则创建成功", {
      userId: user.id,
      ruleId,
      ruleType: body.ruleType,
    });

    // 5. 返回结果
    return NextResponse.json({
      success: true,
      data: {
        ruleId,
      },
    });
  } catch (error) {
    logger.error("创建规则失败", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: "创建规则失败",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
