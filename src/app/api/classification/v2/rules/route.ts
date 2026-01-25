/**
 * 智能分类 v2 - 规则管理入口
 *
 * GET  /api/classification/v2/rules - 获取规则列表
 * POST /api/classification/v2/rules - 创建新规则
 *
 * 合并原有端点：
 * - /api/classification/v5/rules
 *
 * @version 2.0.0
 * @since 2026-01-24 Phase 3
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { ChatToRuleService } from "@/lib/classification/strategies/modern/chat-to-rule";
import { LLMService } from "@/lib/classification/infrastructure/shared-services/llm";
import { createLogger } from "@/lib/classification/infrastructure/shared-services/logger";

/**
 * 规则类型枚举 - 与新 RuleType 同步
 */
const RULE_TYPES = ["positive", "negative"] as const;
type _RuleType = (typeof RULE_TYPES)[number];

/**
 * 模式类型枚举 - 与新 PatternType 同步
 */
const PATTERN_TYPES = ["keyword", "regex", "domain"] as const;
type _PatternType = (typeof PATTERN_TYPES)[number];

/**
 * 创建规则 Schema
 */
const createRuleSchema = z.object({
  type: z.enum(RULE_TYPES),
  patternType: z.enum(PATTERN_TYPES),
  pattern: z.string().min(1, "模式不能为空").max(500),
  targetFolderId: z.union([z.string(), z.number()]).transform(String),
  targetFolderName: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  confidence: z.number().min(0).max(100).optional().default(80),
});

/**
 * GET /api/classification/v2/rules
 * 获取用户的规则列表
 */
export async function GET(request: NextRequest) {
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

    // 2. 获取查询参数
    const searchParams = request.nextUrl.searchParams;
    const activeOnly = searchParams.get("activeOnly") === "true";
    const type = searchParams.get("type") as (typeof RULE_TYPES)[number] | null;

    // 3. 获取规则列表
    const serviceLogger = createLogger("RulesAPI");
    const llmService = new LLMService(serviceLogger);
    const chatToRuleService = new ChatToRuleService(
      supabase,
      serviceLogger,
      llmService,
    );
    const rules = await chatToRuleService.getRules(activeOnly);

    // 4. 按类型过滤（如果指定）
    const filteredRules = type
      ? rules.filter((rule) => rule.type === type)
      : rules;

    const latencyMs = Date.now() - startTime;

    logger.info(
      {
        userId: user.id,
        count: filteredRules.length,
        activeOnly,
        type,
        latencyMs,
      },
      "Classification v2 rules: List fetched",
    );

    // 5. 返回结果
    return NextResponse.json({
      success: true,
      data: {
        rules: filteredRules,
        total: filteredRules.length,
        filters: {
          activeOnly,
          type,
        },
      },
    });
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        latencyMs,
      },
      "Classification v2 rules: GET failed",
    );

    return NextResponse.json(
      {
        success: false,
        error: "获取规则列表失败",
        message: error instanceof Error ? error.message : "未知错误",
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/classification/v2/rules
 * 创建新规则
 */
export async function POST(request: NextRequest) {
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

    // 2. 解析并验证请求体
    const body = await request.json();
    const validation = createRuleSchema.safeParse(body);

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
      type,
      patternType,
      pattern,
      targetFolderId,
      targetFolderName,
      description,
    } = validation.data;

    // 3. 验证目标文件夹存在且属于用户
    const { data: folder, error: folderError } = await supabase
      .from("folders")
      .select("id, name")
      .eq("id", parseInt(String(targetFolderId), 10))
      .eq("user_id", user.id)
      .single();

    if (folderError || !folder) {
      return NextResponse.json(
        { success: false, error: "目标文件夹不存在或无权访问" },
        { status: 400 },
      );
    }

    // 4. 创建规则
    const serviceLogger = createLogger("RulesAPI");
    const llmService = new LLMService(serviceLogger);
    const chatToRuleService = new ChatToRuleService(
      supabase,
      serviceLogger,
      llmService,
    );

    const ruleId = await chatToRuleService.createRule({
      type,
      patternType,
      pattern,
      targetFolderId: parseInt(String(targetFolderId), 10),
      targetFolderName: targetFolderName || folder.name,
      description,
    });

    const latencyMs = Date.now() - startTime;

    logger.info(
      {
        userId: user.id,
        ruleId,
        type,
        patternType,
        targetFolderId,
        latencyMs,
      },
      "Classification v2 rules: Created",
    );

    // 5. 返回结果
    return NextResponse.json({
      success: true,
      data: {
        ruleId,
        type,
        patternType,
        pattern,
        targetFolderId,
        targetFolderName: targetFolderName || folder.name,
      },
    });
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        latencyMs,
      },
      "Classification v2 rules: POST failed",
    );

    return NextResponse.json(
      {
        success: false,
        error: "创建规则失败",
        message: error instanceof Error ? error.message : "未知错误",
      },
      { status: 500 },
    );
  }
}
