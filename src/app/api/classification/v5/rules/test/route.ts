/**
 * 智能分类 v5.0 - 规则测试 API
 *
 * POST /api/classification/v5/rules/test - 测试规则匹配效果
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/classification/infrastructure/shared-services/logger";
import { ChatToRuleService } from "@/lib/classification/strategies/modern/chat-to-rule";
import { LLMService } from "@/lib/classification/infrastructure/shared-services/llm";

/**
 * 测试请求体
 */
interface TestRequest {
  ruleId?: number; // 测试现有规则
  bookmarkTitle: string;
  bookmarkUrl: string;
}

/**
 * POST /api/classification/v5/rules/test
 * 测试规则是否匹配给定的书签
 */
export async function POST(request: NextRequest) {
  const logger = createLogger("RuleTestAPI");

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
    const body: TestRequest = await request.json();

    // 3. 验证必需字段
    if (!body.bookmarkTitle || !body.bookmarkUrl) {
      logger.warn("缺少必需字段", { body });
      return NextResponse.json(
        { error: "缺少必需字段: bookmarkTitle, bookmarkUrl" },
        { status: 400 },
      );
    }

    const llmService = new LLMService(logger);
    const chatToRuleService = new ChatToRuleService(
      supabase,
      logger,
      llmService,
    );

    // 4. 如果提供了 ruleId，测试特定规则
    if (body.ruleId) {
      const { data: rule, error: ruleError } = await supabase
        .from("user_classification_rules")
        .select("*")
        .eq("id", body.ruleId)
        .eq("user_id", user.id)
        .single();

      if (ruleError || !rule) {
        return NextResponse.json({ error: "规则不存在" }, { status: 404 });
      }

      // 测试规则匹配
      const matched = matchRule(rule, body.bookmarkTitle, body.bookmarkUrl);

      logger.info("规则测试完成", {
        userId: user.id,
        ruleId: body.ruleId,
        matched,
      });

      return NextResponse.json({
        success: true,
        data: {
          matched,
          rule: {
            id: rule.id,
            ruleType: rule.type,
            patternType: rule.pattern_type,
            pattern: rule.pattern,
            targetFolderName: rule.target_folder_name,
          },
        },
      });
    }

    // 5. 如果没有提供 ruleId，测试所有启用的规则
    const rules = await chatToRuleService.getRules(true);
    const matchedRules = rules.filter((rule) =>
      matchRuleFromService(rule, body.bookmarkTitle, body.bookmarkUrl),
    );

    logger.info("批量规则测试完成", {
      userId: user.id,
      totalRules: rules.length,
      matchedCount: matchedRules.length,
    });

    return NextResponse.json({
      success: true,
      data: {
        totalRules: rules.length,
        matchedRules: matchedRules.map((rule) => ({
          id: rule.id,
          type: rule.type,
          patternType: rule.patternType,
          pattern: rule.pattern,
          targetFolderName: rule.targetFolderName,
        })),
      },
    });
  } catch (error) {
    logger.error(
      "规则测试失败",
      error instanceof Error ? error : new Error(String(error)),
    );

    return NextResponse.json(
      {
        error: "规则测试失败",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

/**
 * 匹配规则（数据库格式）
 */
function matchRule(
  rule: {
    type: string;
    pattern_type: string;
    pattern: string;
  },
  title: string,
  url: string,
): boolean {
  const lowerTitle = title.toLowerCase();
  const lowerPattern = rule.pattern.toLowerCase();

  switch (rule.type) {
    case "title":
      if (rule.pattern_type === "keyword") {
        return lowerTitle.includes(lowerPattern);
      }
      if (rule.pattern_type === "regex") {
        try {
          const regex = new RegExp(rule.pattern, "i");
          return regex.test(title);
        } catch {
          return false;
        }
      }
      break;

    case "url":
      if (rule.pattern_type === "domain") {
        try {
          const urlObj = new URL(url);
          return urlObj.hostname.includes(lowerPattern);
        } catch {
          return false;
        }
      }
      if (rule.pattern_type === "keyword") {
        return url.toLowerCase().includes(lowerPattern);
      }
      if (rule.pattern_type === "regex") {
        try {
          const regex = new RegExp(rule.pattern, "i");
          return regex.test(url);
        } catch {
          return false;
        }
      }
      break;
  }

  return false;
}

/**
 * 匹配规则（服务层格式）
 */
function matchRuleFromService(
  rule: {
    type: string;
    patternType: string;
    pattern: string;
  },
  title: string,
  url: string,
): boolean {
  return matchRule(
    {
      type: rule.type,
      pattern_type: rule.patternType,
      pattern: rule.pattern,
    },
    title,
    url,
  );
}
