/**
 * AI Custom Rules API
 *
 * GET    /api/agent/rules     - 获取自定义规则列表
 * POST   /api/agent/rules     - 添加自定义规则
 * DELETE /api/agent/rules/:id - 删除规则（通过 query param）
 *
 * @version 1.0.0
 * @since 2025-12-31
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/supabase";
import {
  successResponse,
  unauthorizedError,
  badRequestError,
  notFoundError,
  internalError,
  handleValidationError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 自定义规则
 */
interface CustomRule {
  id: string;
  condition: string;
  action: string;
  source: "explicit" | "learned";
  confidence?: number;
  createdAt: string;
  lastAppliedAt?: string;
  applyCount: number;
}

/**
 * 添加规则请求 Schema
 */
const AddRuleSchema = z.object({
  /** 触发条件描述 */
  condition: z.string().min(1, "条件不能为空").max(500, "条件过长"),
  /** 执行动作描述 */
  action: z.string().min(1, "动作不能为空").max(500, "动作过长"),
  /** 规则来源 */
  source: z.literal("explicit").default("explicit"),
});

/**
 * 删除规则请求 Schema
 */
const DeleteRuleSchema = z.object({
  /** 规则 ID */
  ruleId: z.string().min(1, "规则 ID 不能为空"),
});

// =============================================================================
// Response Types
// =============================================================================

interface RulesListResponse {
  rules: CustomRule[];
  total: number;
}

interface AddRuleResponse {
  success: boolean;
  rule: CustomRule;
}

interface DeleteRuleResponse {
  success: boolean;
  message: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * 从 ai_preferences 中提取规则列表
 */
function extractRulesFromPreferences(
  aiPreferences: Record<string, unknown> | null,
): CustomRule[] {
  if (!aiPreferences) {
    return [];
  }

  const explicit = aiPreferences.explicit as
    | Record<string, unknown>
    | undefined;
  const customRules = explicit?.customRules as CustomRule[] | undefined;

  return customRules ?? [];
}

// =============================================================================
// GET Handler - 获取规则列表
// =============================================================================

/**
 * GET /api/agent/rules
 * 获取用户的自定义规则列表
 */
export async function GET(_request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // 2. 获取用户偏好设置
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("ai_preferences")
      .eq("id", user.id)
      .single();

    if (profileError) {
      logger.error(
        { userId: user.id, error: profileError.message },
        "Failed to fetch profile",
      );
      return internalError("获取用户设置失败");
    }

    // 3. 提取规则列表
    const rules = extractRulesFromPreferences(
      profile?.ai_preferences as Record<string, unknown> | null,
    );

    const response: RulesListResponse = {
      rules,
      total: rules.length,
    };

    logger.debug(
      { userId: user.id, ruleCount: rules.length },
      "GET /api/agent/rules",
    );

    return successResponse(response);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      "GET /api/agent/rules error",
    );
    return internalError("获取规则失败");
  }
}

// =============================================================================
// POST Handler - 添加规则
// =============================================================================

/**
 * POST /api/agent/rules
 * 添加自定义规则
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // 2. 解析请求体
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badRequestError("请求体格式错误");
    }

    // 3. 验证请求体
    const parseResult = AddRuleSchema.safeParse(body);

    if (!parseResult.success) {
      return handleValidationError(parseResult.error);
    }

    const { condition, action, source } = parseResult.data;

    // 4. 创建新规则
    const newRule: CustomRule = {
      id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      condition,
      action,
      source,
      createdAt: new Date().toISOString(),
      applyCount: 0,
    };

    // 5. 调用 RPC 函数添加规则
    const { error: rpcError } = await supabase.rpc("add_ai_custom_rule", {
      p_user_id: user.id,
      p_rule: newRule as unknown as Json,
    });

    if (rpcError) {
      logger.error(
        { userId: user.id, error: rpcError.message },
        "Failed to add rule",
      );
      return internalError("添加规则失败");
    }

    const response: AddRuleResponse = {
      success: true,
      rule: newRule,
    };

    logger.info(
      { userId: user.id, ruleId: newRule.id, condition, action },
      "POST /api/agent/rules - Rule added",
    );

    return successResponse(response);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      "POST /api/agent/rules error",
    );
    return internalError("添加规则失败");
  }
}

// =============================================================================
// DELETE Handler - 删除规则
// =============================================================================

/**
 * DELETE /api/agent/rules
 * 删除自定义规则（通过 query param: ruleId）
 */
export async function DELETE(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // 2. 解析查询参数
    const { searchParams } = new URL(request.url);
    const parseResult = DeleteRuleSchema.safeParse({
      ruleId: searchParams.get("ruleId"),
    });

    if (!parseResult.success) {
      return handleValidationError(parseResult.error);
    }

    const { ruleId } = parseResult.data;

    // 3. 先检查规则是否存在
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("ai_preferences")
      .eq("id", user.id)
      .single();

    if (profileError) {
      logger.error(
        { userId: user.id, error: profileError.message },
        "Failed to fetch profile",
      );
      return internalError("获取用户设置失败");
    }

    const rules = extractRulesFromPreferences(
      profile?.ai_preferences as Record<string, unknown> | null,
    );

    const ruleExists = rules.some((r) => r.id === ruleId);

    if (!ruleExists) {
      return notFoundError("规则不存在");
    }

    // 4. 调用 RPC 函数删除规则
    const { error: rpcError } = await supabase.rpc("remove_ai_custom_rule", {
      p_user_id: user.id,
      p_rule_id: ruleId,
    });

    if (rpcError) {
      logger.error(
        { userId: user.id, ruleId, error: rpcError.message },
        "Failed to remove rule",
      );
      return internalError("删除规则失败");
    }

    const response: DeleteRuleResponse = {
      success: true,
      message: "规则已删除",
    };

    logger.info(
      { userId: user.id, ruleId },
      "DELETE /api/agent/rules - Rule removed",
    );

    return successResponse(response);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      "DELETE /api/agent/rules error",
    );
    return internalError("删除规则失败");
  }
}
