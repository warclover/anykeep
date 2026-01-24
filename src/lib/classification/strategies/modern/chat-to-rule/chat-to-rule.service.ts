/**
 * 智能分类 v5.0 - Chat-to-Rule 服务
 *
 * 功能说明：
 * - 从用户反馈中提取分类规则
 * - 验证规则有效性
 * - 管理用户自定义规则
 * - 应用规则到分类流程
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { LoggerService } from "../shared/logger";
import type { LLMService } from "../shared/llm";
import type {
  UserClassificationRule,
  ExtractedRule,
  RuleExtractionParams,
  RuleValidationResult,
  CreateRuleParams,
  RuleApplicationResult,
  RuleType,
  PatternType,
} from "./types";

export class ChatToRuleService {
  private supabase: SupabaseClient<Database>;
  private logger: LoggerService;
  private llmService: LLMService;

  constructor(
    supabase: SupabaseClient<Database>,
    logger: LoggerService,
    llmService: LLMService,
  ) {
    this.supabase = supabase;
    this.logger = logger.child({ service: "ChatToRuleService" });
    this.llmService = llmService;
  }

  /**
   * 从用户反馈中提取规则
   */
  async extractRuleFromFeedback(
    params: RuleExtractionParams,
  ): Promise<ExtractedRule | null> {
    try {
      this.logger.debug("Extracting rule from feedback", {
        userComment: params.userComment,
      });

      // 1. 使用 LLM 提取规则
      const prompt = this.buildRuleExtractionPrompt(params);
      const llmResponse = await this.llmService.complete(prompt, {
        temperature: 0.3,
        maxTokens: 500,
      });

      // 2. 解析 LLM 响应
      const extractedRule = this.parseRuleFromLLMResponse(
        llmResponse,
        params.actualFolderName,
      );

      if (!extractedRule) {
        this.logger.debug("No rule extracted from feedback");
        return null;
      }

      this.logger.info("Rule extracted successfully", {
        type: extractedRule.type,
        pattern: extractedRule.pattern,
        confidence: extractedRule.confidence,
      });

      return extractedRule;
    } catch (error) {
      this.logger.error(
        "Failed to extract rule from feedback",
        error instanceof Error ? error : new Error(String(error)),
        { params },
      );
      return null;
    }
  }

  /**
   * 构建规则提取 Prompt
   */
  private buildRuleExtractionPrompt(params: RuleExtractionParams): string {
    return `你是一个智能分类规则提取助手。用户在对书签分类时提供了反馈意见，请从中提取可复用的分类规则。

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
- 用户说"包含'教程'的都放到学习资料"，提取：{"hasRule": true, "type": "positive", "pattern": "教程", "patternType": "keyword", "description": "包含'教程'的内容分类到学习资料", "confidence": 0.85}
- 用户说"这个不应该在这里"，提取：{"hasRule": false}

请输出JSON：`;
  }

  /**
   * 解析 LLM 响应
   */
  private parseRuleFromLLMResponse(
    llmResponse: string,
    targetFolderName: string,
  ): ExtractedRule | null {
    try {
      // 尝试提取 JSON
      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (!parsed.hasRule) {
        return null;
      }

      return {
        type: parsed.type as RuleType,
        pattern: parsed.pattern,
        patternType: parsed.patternType as PatternType,
        targetFolderName,
        description: parsed.description,
        confidence: parsed.confidence,
      };
    } catch (error) {
      this.logger.error(
        "Failed to parse LLM response",
        error instanceof Error ? error : new Error(String(error)),
        { llmResponse },
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

    // 1. 验证必需字段
    if (!rule.pattern || rule.pattern.trim().length === 0) {
      errors.push("Pattern cannot be empty");
    }

    if (!rule.targetFolderName || rule.targetFolderName.trim().length === 0) {
      errors.push("Target folder name cannot be empty");
    }

    // 2. 验证模式类型
    if (rule.patternType === "regex") {
      try {
        new RegExp(rule.pattern);
      } catch {
        errors.push("Invalid regex pattern");
      }
    }

    if (rule.patternType === "domain") {
      // 简单的域名验证
      if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(rule.pattern)) {
        warnings.push("Domain pattern may be invalid");
      }
    }

    // 3. 验证优先级
    if (
      rule.priority !== undefined &&
      (rule.priority < 0 || rule.priority > 1000)
    ) {
      warnings.push("Priority should be between 0 and 1000");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 创建规则
   */
  async createRule(
    params: CreateRuleParams,
  ): Promise<UserClassificationRule | null> {
    try {
      this.logger.info("Creating rule", {
        type: params.type,
        pattern: params.pattern,
      });

      // 1. 验证规则
      const validation = this.validateRule(params);
      if (!validation.isValid) {
        throw new Error(`Invalid rule: ${validation.errors.join(", ")}`);
      }

      // 2. 获取当前用户ID
      const {
        data: { user },
      } = await this.supabase.auth.getUser();
      if (!user) {
        throw new Error("User not authenticated");
      }

      // 3. 插入规则
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

      this.logger.info("Rule created successfully", {
        ruleId: data.id,
      });

      return this.mapDatabaseRuleToModel(data);
    } catch (error) {
      this.logger.error(
        "Failed to create rule",
        error instanceof Error ? error : new Error(String(error)),
        { params },
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
      this.logger.debug("Applying rules", {
        bookmarkTitle,
        bookmarkUrl,
      });

      // 1. 获取用户的所有活跃规则（按优先级排序）
      const rules = await this.getRules(true);

      // 2. 遍历规则，找到第一个匹配的
      for (const rule of rules) {
        const matched = this.matchRule(rule, bookmarkTitle, bookmarkUrl);

        if (matched) {
          // 3. 增加匹配计数
          await this.incrementMatchCount(rule.id);

          this.logger.info("Rule matched", {
            ruleId: rule.id,
            pattern: rule.pattern,
          });

          return {
            matched: true,
            ruleId: rule.id,
            ruleName: rule.description || rule.pattern,
            targetFolderId: rule.targetFolderId || undefined,
            targetFolderName: rule.targetFolderName,
          };
        }
      }

      // 4. 没有匹配的规则
      return { matched: false };
    } catch (error) {
      this.logger.error(
        "Failed to apply rules",
        error instanceof Error ? error : new Error(String(error)),
        { bookmarkTitle, bookmarkUrl },
      );
      return { matched: false };
    }
  }

  /**
   * 匹配规则
   */
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
      this.logger.error(
        "Failed to get rules",
        error instanceof Error ? error : new Error(String(error)),
      );
      return [];
    }
  }

  /**
   * 增加规则匹配计数
   */
  private async incrementMatchCount(ruleId: number): Promise<void> {
    try {
      const { error } = await this.supabase.rpc("increment_rule_match_count", {
        p_rule_id: ruleId,
      });

      if (error) {
        throw new Error(`Failed to increment match count: ${error.message}`);
      }
    } catch (error) {
      this.logger.error(
        "Failed to increment match count",
        error instanceof Error ? error : new Error(String(error)),
        { ruleId },
      );
    }
  }

  /**
   * 映射数据库记录到模型
   */
  private mapDatabaseRuleToModel(
    data: Database["public"]["Tables"]["user_classification_rules"]["Row"],
  ): UserClassificationRule {
    return {
      id: data.id,
      userId: data.user_id,
      type: data.type as RuleType,
      pattern: data.pattern,
      patternType: data.pattern_type as PatternType,
      targetFolderId: data.target_folder_id,
      targetFolderName: data.target_folder_name,
      priority: data.priority,
      isActive: data.is_active,
      sourceText: data.source_text,
      description: data.description,
      matchCount: data.match_count,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}
