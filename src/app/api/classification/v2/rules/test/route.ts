/**
 * 智能分类 v2 - 规则测试
 *
 * POST /api/classification/v2/rules/test - 测试规则匹配
 *
 * @version 2.1.0
 * @since 2026-01-24 Phase 3
 * @updated 2026-03-07 - 迁移到 withAuthMiddleware
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { ChatToRuleService } from "@/lib/classification/strategies/modern/chat-to-rule";
import { LLMService } from "@/lib/classification/infrastructure/shared-services/llm";
import { createLogger } from "@/lib/classification/infrastructure/shared-services/logger";
import { withAuthMiddleware } from "@/lib/api/middleware";

/**
 * 测试请求 Schema
 */
const testRuleSchema = z.object({
  ruleId: z.number().int().positive().optional(),
  bookmarkTitle: z.string().min(1, "标题不能为空").max(500),
  bookmarkUrl: z.string().url(),
  bookmarkTags: z.array(z.string()).optional(),
});

/**
 * POST /api/classification/v2/rules/test
 * 测试规则匹配效果
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  const startTime = Date.now();

  const supabase = await createClient();

  // 2. 解析并验证请求体
  const body = await request.json();
  const validation = testRuleSchema.safeParse(body);

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

  const { ruleId, bookmarkTitle, bookmarkUrl, bookmarkTags } = validation.data;

  // 3. 如果指定了 ruleId，测试单个规则
  if (ruleId) {
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

    const matched = matchRule(
      {
        type: rule.type || "keyword",
        pattern_type: rule.pattern_type || "keyword",
        pattern: rule.pattern,
      },
      bookmarkTitle,
      bookmarkUrl,
      bookmarkTags || [],
    );

    const latencyMs = Date.now() - startTime;

    logger.info(
      {
        userId,
        ruleId,
        matched,
        latencyMs,
      },
      "Classification v2 rules: Test single",
    );

    return NextResponse.json({
      success: true,
      data: {
        matched,
        rule: {
          id: rule.id,
          type: rule.type,
          patternType: rule.pattern_type,
          pattern: rule.pattern,
          targetFolderId: rule.target_folder_id,
          targetFolderName: rule.target_folder_name,
        },
      },
    });
  }

  // 4. 如果没有指定 ruleId，测试所有启用的规则
  const serviceLogger = createLogger("RulesTestAPI");
  const llmService = new LLMService(serviceLogger);
  const chatToRuleService = new ChatToRuleService(
    supabase,
    serviceLogger,
    llmService,
  );

  const rules = await chatToRuleService.getRules(true);
  const matchedRules = rules.filter((rule) =>
    matchRuleFromService(rule, bookmarkTitle, bookmarkUrl, bookmarkTags || []),
  );

  const latencyMs = Date.now() - startTime;

  logger.info(
    {
      userId,
      totalRules: rules.length,
      matchedCount: matchedRules.length,
      latencyMs,
    },
    "Classification v2 rules: Test all",
  );

  return NextResponse.json({
    success: true,
    data: {
      totalRules: rules.length,
      matchedCount: matchedRules.length,
      matchedRules: matchedRules.map((rule) => ({
        id: rule.id,
        type: rule.type,
        patternType: rule.patternType,
        pattern: rule.pattern,
        targetFolderId: rule.targetFolderId,
        targetFolderName: rule.targetFolderName,
        priority: rule.priority,
      })),
      // 返回最高优先级的匹配结果
      bestMatch:
        matchedRules.length > 0
          ? {
              ruleId: matchedRules[0].id,
              targetFolderId: matchedRules[0].targetFolderId,
              targetFolderName: matchedRules[0].targetFolderName,
              priority: matchedRules[0].priority,
            }
          : null,
    },
  });
});

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
  tags: string[],
): boolean {
  const _lowerTitle = title.toLowerCase();
  const lowerPattern = rule.pattern.toLowerCase();

  switch (rule.type) {
    case "title":
      return matchPattern(rule.pattern_type, rule.pattern, title);

    case "url":
      if (rule.pattern_type === "domain") {
        try {
          const urlObj = new URL(url);
          return urlObj.hostname.toLowerCase().includes(lowerPattern);
        } catch {
          return false;
        }
      }
      return matchPattern(rule.pattern_type, rule.pattern, url);

    case "tag":
      return tags.some((tag) =>
        matchPattern(rule.pattern_type, rule.pattern, tag),
      );

    case "content":
      // 内容匹配需要完整内容，这里简化为标题匹配
      return matchPattern(rule.pattern_type, rule.pattern, title);

    default:
      return false;
  }
}

/**
 * 模式匹配
 */
function matchPattern(
  patternType: string,
  pattern: string,
  text: string,
): boolean {
  const lowerText = text.toLowerCase();
  const lowerPattern = pattern.toLowerCase();

  switch (patternType) {
    case "keyword":
      return lowerText.includes(lowerPattern);

    case "exact":
      return lowerText === lowerPattern;

    case "regex":
      try {
        const regex = new RegExp(pattern, "i");
        return regex.test(text);
      } catch {
        return false;
      }

    case "domain":
      return lowerText.includes(lowerPattern);

    default:
      return false;
  }
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
  tags: string[],
): boolean {
  return matchRule(
    {
      type: rule.type,
      pattern_type: rule.patternType,
      pattern: rule.pattern,
    },
    title,
    url,
    tags,
  );
}
