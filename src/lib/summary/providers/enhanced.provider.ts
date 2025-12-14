/**
 * Enhanced Summary Provider (v3.0)
 *
 * 增强版摘要 Provider，支持实体提取、关键数据、难度评估
 * 复用 DeepSeek API，扩展输出格式
 *
 * @version 3.0.0
 * @since 2025-12-14
 */

import { logger } from "@/lib/logger";
import type {
  ISummaryProvider,
  PromptBuildResult,
  ParsedResponse,
} from "./provider.interface";
import type {
  SummaryInput,
  SummaryResult,
  ProviderConfig,
  ProviderHealth,
  ContentType as BaseContentType,
} from "../summary.types";
import { safeParseJson, detectContentType } from "../summary.types";
import type { ContentType as EnhancedContentType } from "@/lib/classification/types/ai-summary";

// 使用增强版内容类型
type ContentType = EnhancedContentType;
import { DEEPSEEK_DEFAULT_CONFIG } from "../summary.config";
import {
  getEnhancedPromptConfig,
  buildEnhancedUserPrompt,
} from "../prompts/enhanced.prompt";
import {
  getEnhancedModeConfig,
  type EnhancedModeConfig,
} from "@/lib/classification/config/ai-summary-config";
import type {
  EnhancedSummary,
  Entity,
  KeyDataItem,
  DifficultyLevel,
} from "@/lib/classification/types/ai-summary";

/**
 * 增强版响应解析结果
 */
export interface EnhancedParsedResponse extends ParsedResponse {
  version: 3;
  enhanced: EnhancedSummary;
}

/**
 * 增强版摘要 Provider
 *
 * 基于 DeepSeek API，扩展支持：
 * - 实体提取（人名、公司、技术等）
 * - 关键数据提取
 * - 难度评估
 * - 内容类型识别
 *
 * @example
 * ```typescript
 * const provider = new EnhancedSummaryProvider();
 * const result = await provider.generateSummary({
 *   bookmarkId: 123,
 *   userId: 'user-uuid',
 *   title: '深入理解 React Hooks',
 *   content: '文章内容...',
 * });
 *
 * // 访问增强字段
 * console.log(result.enhanced?.entities);
 * console.log(result.enhanced?.key_data);
 * console.log(result.enhanced?.difficulty);
 * ```
 */
export class EnhancedSummaryProvider implements ISummaryProvider {
  readonly name = "deepseek" as const; // 复用 DeepSeek API
  readonly priority = 1;

  private config: ProviderConfig;
  private enhancedConfig: EnhancedModeConfig;

  constructor(
    config?: Partial<ProviderConfig>,
    enhancedConfig?: EnhancedModeConfig,
  ) {
    this.config = {
      ...DEEPSEEK_DEFAULT_CONFIG,
      ...config,
      apiKey: config?.apiKey || process.env.DEEPSEEK_API_KEY || "",
      maxTokens: 2500, // 增强版需要更多输出空间
    };

    this.enhancedConfig = enhancedConfig || getEnhancedModeConfig();
  }

  /**
   * 生成增强版摘要
   */
  async generateSummary(input: SummaryInput): Promise<SummaryResult> {
    const startTime = Date.now();

    if (!this.config.apiKey) {
      throw new Error("DEEPSEEK_API_KEY 环境变量未配置");
    }

    // 检测内容类型（使用基础类型检测，然后扩展为增强类型）
    const baseContentType: BaseContentType =
      (input.contentType as BaseContentType) || this.detectContentType(input);
    const contentType = baseContentType as ContentType;
    const contentTypeConfidence = input.contentTypeConfidence || 70;

    // 构建增强版 Prompt
    const promptResult = this.buildPrompts({
      ...input,
      contentType: baseContentType,
    });

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: "system", content: promptResult.systemPrompt },
            { role: "user", content: promptResult.userPrompt },
          ],
          temperature: promptResult.temperature,
          max_tokens: promptResult.maxTokens,
          response_format: { type: "json_object" }, // 强制 JSON 输出
        }),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DeepSeek API 错误: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const aiContent = data.choices?.[0]?.message?.content;

      if (!aiContent) {
        throw new Error("DeepSeek API 返回空内容");
      }

      // 解析增强版响应
      const parsed = this.parseResponse(aiContent) as EnhancedParsedResponse;
      const latencyMs = Date.now() - startTime;

      logger.info(
        {
          provider: "enhanced-summary",
          model: this.config.model,
          contentType,
          summaryLength: parsed.summary.length,
          tagsCount: parsed.tags.length,
          entitiesCount: parsed.enhanced?.entities?.length || 0,
          keyDataCount: parsed.enhanced?.key_data?.length || 0,
          difficulty: parsed.enhanced?.difficulty,
          latencyMs,
          inputTokens: data.usage?.prompt_tokens,
          outputTokens: data.usage?.completion_tokens,
        },
        "EnhancedSummaryProvider: Summary generated successfully",
      );

      return {
        summary: parsed.summary,
        tags: parsed.tags,
        version: 3,
        structured: parsed.enhanced,
        enhanced: parsed.enhanced, // 增强字段
        usage: {
          inputTokens: data.usage?.prompt_tokens || 0,
          outputTokens: data.usage?.completion_tokens || 0,
        },
        latencyMs,
        providerUsed: this.name,
        modelUsed: this.config.model,
        // 返回基础内容类型（兼容 SummaryResult 类型）
        contentType: (parsed.enhanced?.content_type ||
          baseContentType) as BaseContentType,
        contentTypeConfidence,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      logger.error(
        {
          provider: "enhanced-summary",
          error: error instanceof Error ? error.message : String(error),
          latencyMs,
        },
        "EnhancedSummaryProvider: generateSummary failed",
      );
      throw error;
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<ProviderHealth> {
    const startTime = Date.now();

    if (!this.config.apiKey) {
      return {
        available: false,
        error: "API Key not configured",
        checkedAt: new Date().toISOString(),
      };
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        signal: AbortSignal.timeout(5000),
      });

      return {
        available: response.ok,
        latencyMs: Date.now() - startTime,
        error: response.ok ? undefined : `HTTP ${response.status}`,
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        available: false,
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
        checkedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * 估算成本
   */
  estimateCost(tokenCount: number): number {
    // 增强版输出更多，成本略高
    const inputTokens = tokenCount * 0.7;
    const outputTokens = tokenCount * 0.3;
    return Math.ceil((inputTokens / 1000) * 0.1 + (outputTokens / 1000) * 0.2);
  }

  /**
   * 获取配置
   */
  getConfig(): ProviderConfig {
    return {
      ...this.config,
      apiKey: "***",
    };
  }

  /**
   * 是否支持流式输出
   */
  supportsStreaming(): boolean {
    return false; // 增强版暂不支持流式
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * 检测内容类型
   */
  private detectContentType(input: SummaryInput): ContentType {
    const result = detectContentType({
      url: input.url,
      title: input.title,
      description: input.description,
      content: input.content,
    });
    return result.type;
  }

  /**
   * 构建增强版 Prompt
   */
  buildPrompts(input: SummaryInput): PromptBuildResult {
    const contentType = input.contentType || "article";
    const promptConfig = getEnhancedPromptConfig(
      contentType,
      this.enhancedConfig,
    );

    return {
      systemPrompt: promptConfig.systemPrompt,
      userPrompt: buildEnhancedUserPrompt(
        input.title,
        input.description,
        input.content,
        input.existingFolderNames,
        this.enhancedConfig,
      ),
      temperature: promptConfig.temperature,
      maxTokens: promptConfig.maxTokens,
    };
  }

  /**
   * 解析增强版响应
   */
  parseResponse(content: string): EnhancedParsedResponse {
    try {
      // 移除可能的 markdown 代码块标记
      const cleaned = content
        .replace(/```json\n?/gi, "")
        .replace(/```\n?/g, "")
        .trim();

      // 安全解析 JSON
      const parsed = safeParseJson<EnhancedSummary>(cleaned);

      if (!parsed) {
        logger.warn(
          {
            rawContent: cleaned.substring(0, 200),
            provider: "enhanced-summary",
          },
          "EnhancedSummaryProvider: JSON parse failed",
        );
        throw new Error("Failed to parse enhanced response");
      }

      // 验证必要字段
      if (!parsed.tldr || !Array.isArray(parsed.key_points)) {
        throw new Error("Invalid enhanced response structure");
      }

      // 处理实体
      const entities: Entity[] = this.processEntities(parsed.entities);

      // 处理关键数据
      const keyData: KeyDataItem[] = this.processKeyData(parsed.key_data);

      // 提取标签
      const tags = this.extractTags(parsed.keywords);

      // 构建增强版摘要对象
      const enhanced: EnhancedSummary = {
        tldr: parsed.tldr,
        key_points: parsed.key_points.filter(
          (p): p is string => typeof p === "string",
        ),
        keywords: tags,
        sentiment: this.validateSentiment(parsed.sentiment),
        reading_time:
          typeof parsed.reading_time === "number" ? parsed.reading_time : 5,
        action_items: Array.isArray(parsed.action_items)
          ? parsed.action_items.filter(
              (a): a is string => typeof a === "string",
            )
          : undefined,
        // v3.0 增强字段
        entities,
        key_data: keyData,
        difficulty: this.validateDifficulty(parsed.difficulty),
        content_type: this.validateContentType(parsed.content_type),
        summary_version: 3,
      };

      // 将完整 JSON 作为 summary 存储
      const summaryJson = JSON.stringify(enhanced);

      return {
        summary: summaryJson,
        tags,
        version: 3,
        structured: enhanced,
        enhanced,
      };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          rawContent: content.substring(0, 200),
          provider: "enhanced-summary",
        },
        "EnhancedSummaryProvider: parse error",
      );
      throw new Error("解析增强版 AI 响应失败");
    }
  }

  /**
   * 处理实体列表
   */
  private processEntities(entities: unknown): Entity[] {
    if (!Array.isArray(entities)) {
      return [];
    }

    const validTypes = [
      "person",
      "company",
      "tech",
      "concept",
      "product",
      "place",
      "other",
    ];

    return entities
      .filter((e): e is Record<string, unknown> => {
        return (
          typeof e === "object" &&
          e !== null &&
          typeof (e as Record<string, unknown>).name === "string" &&
          typeof (e as Record<string, unknown>).type === "string"
        );
      })
      .filter((e) => {
        // 过滤低置信度实体
        const confidence =
          typeof e.confidence === "number" ? e.confidence : 1.0;
        return confidence >= this.enhancedConfig.entityConfidenceThreshold;
      })
      .map((e) => ({
        name: String(e.name).trim(),
        type: validTypes.includes(String(e.type))
          ? (String(e.type) as Entity["type"])
          : "other",
        normalized_name: String(e.name).toLowerCase().trim(),
        confidence: typeof e.confidence === "number" ? e.confidence : 1.0,
      }))
      .slice(0, this.enhancedConfig.maxEntities);
  }

  /**
   * 处理关键数据列表
   */
  private processKeyData(keyData: unknown): KeyDataItem[] {
    if (!Array.isArray(keyData)) {
      return [];
    }

    return keyData
      .filter((k): k is Record<string, unknown> => {
        return (
          typeof k === "object" &&
          k !== null &&
          typeof (k as Record<string, unknown>).label === "string" &&
          typeof (k as Record<string, unknown>).value === "string"
        );
      })
      .map((k) => ({
        label: String(k.label).trim(),
        value: String(k.value).trim(),
        unit: typeof k.unit === "string" ? k.unit.trim() : undefined,
        context: typeof k.context === "string" ? k.context.trim() : undefined,
      }))
      .slice(0, this.enhancedConfig.maxKeyData);
  }

  /**
   * 提取标签
   */
  private extractTags(keywords: unknown): string[] {
    if (!Array.isArray(keywords)) {
      return ["收藏", "阅读"]; // 回退标签
    }

    const tags = keywords
      .filter((k): k is string => typeof k === "string")
      .map((k) => k.trim())
      .filter((k) => k.length > 0)
      .slice(0, 5);

    return tags.length > 0 ? tags : ["收藏", "阅读"];
  }

  /**
   * 验证情感倾向
   */
  private validateSentiment(
    sentiment: unknown,
  ): "positive" | "neutral" | "negative" {
    const validSentiments = ["positive", "neutral", "negative"];
    if (typeof sentiment === "string" && validSentiments.includes(sentiment)) {
      return sentiment as "positive" | "neutral" | "negative";
    }
    return "neutral";
  }

  /**
   * 验证难度等级
   */
  private validateDifficulty(difficulty: unknown): DifficultyLevel | undefined {
    const validLevels = ["easy", "medium", "hard"];
    if (typeof difficulty === "string" && validLevels.includes(difficulty)) {
      return difficulty as DifficultyLevel;
    }
    return undefined;
  }

  /**
   * 验证内容类型
   */
  private validateContentType(contentType: unknown): ContentType | undefined {
    const validTypes = [
      "article",
      "tutorial",
      "news",
      "opinion",
      "reference",
      "video",
      "tool",
      "case_study",
      "unknown",
    ];
    if (typeof contentType === "string" && validTypes.includes(contentType)) {
      return contentType as ContentType;
    }
    return undefined;
  }
}
