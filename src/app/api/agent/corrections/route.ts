/**
 * User Corrections API
 *
 * POST /api/agent/corrections - 记录用户纠正（用于规则学习）
 * GET  /api/agent/corrections - 获取纠正历史
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
  internalError,
  handleValidationError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { createRuleExtractor } from "@/lib/ai-agent/preferences/rule-learning";

// =============================================================================
// 请求验证 Schema
// =============================================================================

/**
 * 记录纠正请求 Schema
 */
const RecordCorrectionSchema = z.object({
  /** 原始操作 */
  originalAction: z.object({
    tool: z.string().min(1, "工具名称不能为空"),
    params: z.record(z.string(), z.unknown()).optional(),
  }),
  /** 纠正后的操作 */
  correctedAction: z.object({
    tool: z.string().min(1, "工具名称不能为空"),
    params: z.record(z.string(), z.unknown()).optional(),
  }),
  /** 上下文信息 */
  context: z.record(z.string(), z.unknown()).optional(),
});

/**
 * GET 查询参数 Schema
 */
const GetCorrectionsQuerySchema = z.object({
  /** 限制返回数量 */
  limit: z
    .string()
    .nullish()
    .transform((v) => (v ? parseInt(v, 10) : 20)),
  /** 是否只获取未处理的 */
  unprocessedOnly: z
    .string()
    .nullish()
    .transform((v) => v === "true"),
});

// =============================================================================
// Response Types
// =============================================================================

interface RecordCorrectionResponse {
  success: boolean;
  correctionId: string;
  message: string;
  /** 是否触发了规则提取 */
  ruleExtractionTriggered: boolean;
}

interface CorrectionRecord {
  id: string;
  originalAction: {
    tool: string;
    params: Record<string, unknown>;
  };
  correctedAction: {
    tool: string;
    params: Record<string, unknown>;
  };
  context: Record<string, unknown>;
  ruleExtracted: boolean;
  extractedRuleId?: string;
  createdAt: string;
}

interface CorrectionsListResponse {
  corrections: CorrectionRecord[];
  total: number;
  hasMore: boolean;
}

// =============================================================================
// POST Handler - 记录纠正
// =============================================================================

/**
 * POST /api/agent/corrections
 * 记录用户纠正（用于规则学习）
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
    const parseResult = RecordCorrectionSchema.safeParse(body);

    if (!parseResult.success) {
      return handleValidationError(parseResult.error);
    }

    const { originalAction, correctedAction, context } = parseResult.data;

    // 确保 params 有默认值
    const originalActionData = {
      tool: originalAction.tool,
      params: originalAction.params ?? {},
    };
    const correctedActionData = {
      tool: correctedAction.tool,
      params: correctedAction.params ?? {},
    };
    const contextData = context ?? {};

    // 4. 插入纠正记录到数据库
    // 类型断言: 手动维护类型文件时需要此断言
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: correction, error: insertError } = await (supabase
      .from("user_corrections") as any)
      .insert({
        user_id: user.id,
        original_action: originalActionData as unknown as Json,
        corrected_action: correctedActionData as unknown as Json,
        context: contextData as unknown as Json,
        rule_extracted: false,
      })
      .select("id")
      .single() as { data: { id: string } | null; error: { message: string } | null };

    if (insertError) {
      logger.error(
        { userId: user.id, error: insertError.message },
        "Failed to insert correction",
      );
      return internalError("记录纠正失败");
    }

    // 5. 检查是否需要触发规则提取
    // 获取未处理的纠正记录数量
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: unprocessedCount } = await (supabase
      .from("user_corrections") as any)
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("rule_extracted", false) as { count: number | null };

    let ruleExtractionTriggered = false;

    // 如果积累了足够的纠正记录，触发规则提取
    if (unprocessedCount && unprocessedCount >= 5) {
      try {
        const ruleExtractor = createRuleExtractor();

        // 记录纠正到规则提取器
        ruleExtractor.recordCorrection(user.id, {
          originalIntent: originalActionData.tool,
          correctedIntent: correctedActionData.tool,
          context: contextData as Record<string, string | string[]>,
          timestamp: new Date(),
        });

        // 尝试提取规则
        const extractedRules = await ruleExtractor.extractRules(user.id);
        ruleExtractionTriggered = extractedRules.length > 0;

        if (ruleExtractionTriggered) {
          logger.info(
            {
              userId: user.id,
              extractedRulesCount: extractedRules.length,
            },
            "Rules extracted from corrections",
          );
        }
      } catch (extractError) {
        logger.warn(
          {
            userId: user.id,
            error:
              extractError instanceof Error
                ? extractError.message
                : String(extractError),
          },
          "Rule extraction failed (non-critical)",
        );
      }
    }

    const response: RecordCorrectionResponse = {
      success: true,
      correctionId: correction?.id ?? "",
      message: "纠正已记录",
      ruleExtractionTriggered,
    };

    logger.info(
      {
        userId: user.id,
        correctionId: correction?.id,
        originalTool: originalActionData.tool,
        correctedTool: correctedActionData.tool,
        ruleExtractionTriggered,
      },
      "POST /api/agent/corrections - Correction recorded",
    );

    return successResponse(response);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      "POST /api/agent/corrections error",
    );
    return internalError("记录纠正失败");
  }
}

// =============================================================================
// GET Handler - 获取纠正历史
// =============================================================================

/**
 * GET /api/agent/corrections
 * 获取用户的纠正历史
 */
export async function GET(request: NextRequest) {
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
    const parseResult = GetCorrectionsQuerySchema.safeParse({
      limit: searchParams.get("limit"),
      unprocessedOnly: searchParams.get("unprocessedOnly"),
    });

    if (!parseResult.success) {
      return handleValidationError(parseResult.error);
    }

    const { limit, unprocessedOnly } = parseResult.data;

    // 3. 构建查询
    // 类型断言: 手动维护类型文件时需要此断言
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase.from("user_corrections") as any)
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (unprocessedOnly) {
      query = query.eq("rule_extracted", false);
    }

    // 4. 执行查询
    type CorrectionRow = {
      id: string;
      original_action: unknown;
      corrected_action: unknown;
      context: unknown;
      rule_extracted: boolean;
      extracted_rule_id: string | null;
      created_at: string;
    };
    const { data: corrections, count, error: queryError } = await query as {
      data: CorrectionRow[] | null;
      count: number | null;
      error: { message: string } | null;
    };

    if (queryError) {
      logger.error(
        { userId: user.id, error: queryError.message },
        "Failed to fetch corrections",
      );
      return internalError("获取纠正历史失败");
    }

    // 5. 转换响应格式
    const formattedCorrections: CorrectionRecord[] = (corrections ?? []).map(
      (c) => ({
        id: c.id,
        originalAction: c.original_action as {
          tool: string;
          params: Record<string, unknown>;
        },
        correctedAction: c.corrected_action as {
          tool: string;
          params: Record<string, unknown>;
        },
        context: (c.context as Record<string, unknown>) ?? {},
        ruleExtracted: c.rule_extracted,
        extractedRuleId: c.extracted_rule_id ?? undefined,
        createdAt: c.created_at,
      }),
    );

    const response: CorrectionsListResponse = {
      corrections: formattedCorrections,
      total: count ?? 0,
      hasMore: (count ?? 0) > limit,
    };

    logger.debug(
      {
        userId: user.id,
        correctionCount: formattedCorrections.length,
        total: count,
      },
      "GET /api/agent/corrections",
    );

    return successResponse(response);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      "GET /api/agent/corrections error",
    );
    return internalError("获取纠正历史失败");
  }
}
