/**
 * Chat-to-Rule 服务 — v2 内化版
 *
 * 从旧系统 classification/strategies/modern/chat-to-rule/ 精简迁入。
 * 改用 v2 infra/llm.ts 的 callLlm() 替代旧 LLMService，
 * 使用项目统一 logger 替代旧 LoggerService。
 *
 * 功能：
 * - 从用户反馈中提取分类规则（LLM 辅助）
 * - 验证规则有效性
 * - 管理用户自定义规则（CRUD）
 * - 应用规则到书签匹配
 *
 * @version 2.0.0
 * @since 2026-03-10
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { logger } from "@/lib/logger";
import { callLlm } from "../infra/llm";
import type {
  UserClassificationRule,
  ExtractedRule,
  RuleExtractionParams,
  RuleValidationResult,
  CreateRuleParams,
  RuleApplicationResult,
  RuleType,
  PatternType,
} from "./chat-to-rule.types";

export class ChatToRuleService {
  private supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  /**
   * 从用户反馈中提取规则
   */
  async extractRuleFromFeedback(
    params: RuleExtractionParams,
  ): Promise<ExtractedRule | null> {
    try {
      logger.debug(
        { userComment: params.userComment },
        "ChatToRule(v2): Extracting rule from feedback",
      );

      const prompt = this.buildRuleExtractionPrompt(params);
      const response = await callLlm({
        systemPrompt:
          "你是一个智能分类规则提取助手。请从用户反馈中提取可复用的分类规则，输出 JSON 格式。",
        userPrompt: prompt,
        temperature: 0.3,
        maxTokens: 500,
      });

      const extractedRule = this.parseRuleFromLLMResponse(
        response.content,
        params.actualFolderName,
      );

      if (!extractedRule) {
        logger.debug("ChatToRule(v2): No rule extracted from feedback");
        return null;
      }

      logger.info(
        {
          type: extractedRule.type,
          pattern: extractedRule.pattern,
          confidence: extractedRule.confidence,
        },
        "ChatToRule(v2): Rule extracted successfully",
      );

      return extractedRule;
    } catch (error) {
      logger.error(
        { err: error, params },
        "ChatToRule(v2): Failed to extract rule from feedback",
      );
      return null;
    }
  }

  /**
   * 验证规则有效性
   */
  validateRule(rule: CreateRuleParams): RuleValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!rule.pattern || rule.pattern.trim().length === 0) {
      errors.push("Pattern cannot be empty");
    }

    if (!rule.targetFolderName || rule.targetFolderName.trim().length === 0) {
      errors.push("Target folder name cannot be empty");
    }

    if (rule.patternType === "regex") {
      try {
        new RegExp(rule.pattern);
      } catch {
        errors.push("Invalid regex pattern");
      }
    }

    if (rule.patternType === "domain") {
      if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(rule.pattern)) {
        warnings.push("Domain pattern may be invalid");
      }
    }

    if (
      rule.priority !== undefined &&
      (rule.priority < 0 || rule.priority > 1000)
    ) {
      warnings.push("Priority should be between 0 and 1000");
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * 创建规则
   */
  async createRule(
    params: CreateRuleParams,
  ): Promise<UserClassificationRule | null> {
    try {
      logger.info(
        { type: params.type, pattern: params.pattern },
        "ChatToRule(v2): Creating rule",
      );

      const validation = this.validateRule(params);
      if (!validation.isValid) {
        throw new Error(`Invalid rule: ${validation.errors.join(", ")}`);
      }

      const {
        data: { user },
      } = await this.supabase.auth.getUser();
      if (!user) {
        throw new Error("User not authenticated");
      }

      const { data, error } = await this.supabase
        .from("user_classification_rules")
        .insert({
          user_id: user.id,
          type: params.type,
          pattern: params.pattern,
          pattern_type: params.patternType,
          target_folder_id: params.targetFolderId,
          target_folder_name: params.targetFolderName,
          priority: params.priority || 100,
          source_text: params.sourceText,
          description: params.description,
        })
        .select()
        .single();

      if (error || !data) {
        throw new Error(`Failed to create rule: ${error?.message}`);
      }

      logger.info({ ruleId: data.id }, "ChatToRule(v2): Rule created");

      return this.mapDatabaseRuleToModel(data);
    } catch (error) {
      logger.error(
        { err: error, params },
        "ChatToRule(v2): Failed to create rule",
      );
      return null;
    }
  }

  /**
   * 应用规则到书签
   */
  async applyRule(
    bookmarkTitle: string,
    bookmarkUrl: string,
  ): Promise<RuleApplicationResult> {
    try {
      const rules = await this.getRules(true);

      for (const rule of rules) {
        const matched = this.matchRule(rule, bookmarkTitle, bookmarkUrl);

        if (matched) {
          await this.incrementMatchCount(rule.id);

          logger.info(
            { ruleId: rule.id, pattern: rule.pattern },
            "ChatToRule(v2): Rule matched",
          );

          return {
            matched: true,
            ruleId: rule.id,
            ruleName: rule.description || rule.pattern,
            targetFolderId: rule.targetFolderId || undefined,
            targetFolderName: rule.targetFolderName,
          };
        }
      }

      return { matched: false };
    } catch (error) {
      logger.error(
        { err: error, bookmarkTitle, bookmarkUrl },
        "ChatToRule(v2): Failed to apply rules",
      );
      return { matched: false };
    }
  }

  /**
   * 获取用户的所有规则
   */
  async getRules(
    activeOnly: boolean = false,
  ): Promise<UserClassificationRule[]> {
    try {
      let query = this.supabase
        .from("user_classification_rules")
        .select("*")
        .order("priority", { ascending: false });

      if (activeOnly) {
        query = query.eq("is_active", true);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to get rules: ${error.message}`);
      }

      return (data || []).map(this.mapDatabaseRuleToModel);
    } catch (error) {
      logger.error({ err: error }, "ChatToRule(v2): Failed to get rules");
      return [];
    }
  }

  // ---- 私有方法 ----

  private buildRuleExtractionPrompt(params: RuleExtractionParams): string {
    return `用户在对书签分类时提供了反馈意见，请从中提取可复用的分类规则。

用户反馈：${params.userComment}
实际选择的文件夹：${params.actualFolderName}
${params.suggestedFolderName ? `系统建议的文件夹：${params.suggestedFolderName}` : ""}
${params.bookmarkTitle ? `书签标题：${params.bookmarkTitle}` : ""}
${params.bookmarkUrl ? `书签URL：${params.bookmarkUrl}` : ""}

请分析用户反馈，提取分类规则。规则应该是通用的、可复用的。

输出格式（JSON）：
{
  "hasRule": true/false,
  "type": "positive" 或 "negative",
  "pattern": "匹配模式（关键词、域名或正则表达式）",
  "patternType": "keyword" 或 "domain" 或 "regex",
  "description": "规则描述",
  "confidence": 0.0-1.0
}

示例：
- 用户说"所有GitHub的链接都放到开发工具"，提取：{"hasRule": true, "type": "positive", "pattern": "github.com", "patternType": "domain", "description": "GitHub链接分类到开发工具", "confidence": 0.9}
- 用户说"这个不应该在这里"，提取：{"hasRule": false}

请输出JSON：`;
  }

  private parseRuleFromLLMResponse(
    llmResponse: string,
    targetFolderName: string,
  ): ExtractedRule | null {
    try {
      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]);
      if (!parsed.hasRule) return null;

      return {
        type: parsed.type as RuleType,
        pattern: parsed.pattern,
        patternType: parsed.patternType as PatternType,
        targetFolderName,
        description: parsed.description,
        confidence: parsed.confidence,
      };
    } catch (error) {
      logger.error(
        { err: error, responsePreview: llmResponse.slice(0, 200) },
        "ChatToRule(v2): Failed to parse LLM response",
      );
      return null;
    }
  }

  private matchRule(
    rule: UserClassificationRule,
    bookmarkTitle: string,
    bookmarkUrl: string,
  ): boolean {
    const text = `${bookmarkTitle} ${bookmarkUrl}`.toLowerCase();

    switch (rule.patternType) {
      case "keyword":
        return text.includes(rule.pattern.toLowerCase());

      case "domain":
        try {
          const url = new URL(bookmarkUrl);
          return url.hostname.includes(rule.pattern.toLowerCase());
        } catch {
          return false;
        }

      case "regex":
        try {
          const regex = new RegExp(rule.pattern, "i");
          return regex.test(text);
        } catch {
          return false;
        }

      default:
        return false;
    }
  }

  private async incrementMatchCount(ruleId: number): Promise<void> {
    try {
      const { error } = await this.supabase.rpc("increment_rule_match_count", {
        p_rule_id: ruleId,
      });

      if (error) {
        throw new Error(`Failed to increment match count: ${error.message}`);
      }
    } catch (error) {
      logger.error(
        { err: error, ruleId },
        "ChatToRule(v2): Failed to increment match count",
      );
    }
  }

  private mapDatabaseRuleToModel(
    data: Database["public"]["Tables"]["user_classification_rules"]["Row"],
  ): UserClassificationRule {
    return {
      id: data.id,
      userId: data.user_id,
      type: data.type as RuleType,
      pattern: data.pattern,
      patternType: data.pattern_type as PatternType,
      targetFolderId: data.target_folder_id ?? 0,
      targetFolderName: data.target_folder_name,
      priority: data.priority ?? 0,
      isActive: data.is_active ?? true,
      sourceText: data.source_text,
      description: data.description,
      matchCount: data.match_count ?? 0,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}
