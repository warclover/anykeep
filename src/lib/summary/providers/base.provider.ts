/**
 * Base Provider Abstract Class
 *
 * 提供所有 AI Provider 的公共实现，消除代码重复
 *
 * 继承此类的 Provider 只需实现：
 * - name / priority / config（属性）
 * - estimateCost()（定价逻辑不同）
 * - getApiKeyEnvName()（环境变量名不同）
 *
 * @version 2.1.0
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
  StructuredSummary,
  ContentType,
  ProviderName,
} from "../summary.types";
import {
  getPromptConfig,
  buildTypeSpecificPrompt,
  getPromptConfigV2,
  buildTypeSpecificPromptV2,
} from "../prompts";
import { isJsonOutputEnabled } from "../summary.config";
import { safeParseJson, detectContentType } from "../summary.types";
import { getAISummaryConfig } from "@/lib/classification/config/ai-summary-config";
import { isSummaryComplete } from "@/lib/utils/content-extractor";

/**
 * AI Provider 抽象基类
 *
 * 包含所有 Provider 共享的逻辑：
 * - Prompt 构建
 * - 响应解析（V1/V2）
 * - 内容类型检测
 * - API 调用（可选）
 * - 流式生成（可选）
 *
 * @example
 * ```typescript
 * class MyProvider extends BaseProvider {
 *   readonly name = 'my-provider' as const;
 *   readonly priority = 3;
 *
 *   constructor() {
 *     super({ baseUrl: '...', model: '...' });
 *   }
 *
 *   protected getApiKeyEnvName(): string {
 *     return 'MY_PROVIDER_API_KEY';
 *   }
 *
 *   estimateCost(tokenCount: number): number {
 *     return Math.ceil(tokenCount / 1000 * 0.1);
 *   }
 * }
 * ```
 */
export abstract class BaseProvider implements ISummaryProvider {
  // ============================================================================
  // Abstract Properties (子类必须定义)
  // ============================================================================

  /** Provider 名称 */
  abstract readonly name: ProviderName;

  /** Provider 优先级 (数字越小优先级越高) */
  abstract readonly priority: number;

  // ============================================================================
  // Protected Properties
  // ============================================================================

  /** Provider 配置 */
  protected config: ProviderConfig;

  // ============================================================================
  // Constructor
  // ============================================================================

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  // ============================================================================
  // Abstract Methods (子类必须实现)
  // ============================================================================

  /**
   * 获取 API Key 环境变量名
   * @returns 环境变量名 (如 'DEEPSEEK_API_KEY')
   */
  protected abstract getApiKeyEnvName(): string;

  /**
   * 估算成本 (各 Provider 定价不同)
   * @param tokenCount - Token 数量
   * @returns 估算成本（单位：分）
   */
  abstract estimateCost(tokenCount: number): number;

  // ============================================================================
  // Public Methods (ISummaryProvider 接口实现)
  // ============================================================================

  /**
   * 生成摘要
   */
  async generateSummary(input: SummaryInput): Promise<SummaryResult> {
    const startTime = Date.now();

    if (!this.config.apiKey) {
      throw new Error(`${this.getApiKeyEnvName()} 环境变量未配置`);
    }

    // 检测内容类型（如果未提供）
    const contentType = input.contentType || this.detectContentType(input);
    const contentTypeConfidence = input.contentTypeConfidence || 70;

    // 构建 Prompt
    const promptResult = this.buildPrompts({
      ...input,
      contentType,
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
        }),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `${this.name} API 错误: ${response.status} - ${errorText}`,
        );
      }

      const data = await response.json();
      const aiContent = data.choices?.[0]?.message?.content;

      if (!aiContent) {
        throw new Error(`${this.name} API 返回空内容`);
      }

      // 解析响应
      const parsed = this.parseResponse(aiContent);
      const latencyMs = Date.now() - startTime;

      logger.info(
        {
          provider: this.name,
          model: this.config.model,
          contentType,
          summaryLength: parsed.summary.length,
          tagsCount: parsed.tags.length,
          latencyMs,
          inputTokens: data.usage?.prompt_tokens,
          outputTokens: data.usage?.completion_tokens,
        },
        `${this.name}: Summary generated successfully`,
      );

      return {
        summary: parsed.summary,
        tags: parsed.tags,
        version: parsed.version,
        structured: parsed.structured,
        usage: {
          inputTokens: data.usage?.prompt_tokens || 0,
          outputTokens: data.usage?.completion_tokens || 0,
        },
        latencyMs,
        providerUsed: this.name,
        modelUsed: this.config.model,
        contentType,
        contentTypeConfidence,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      logger.error(
        {
          provider: this.name,
          error: error instanceof Error ? error.message : String(error),
          latencyMs,
        },
        `${this.name}: generateSummary failed`,
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
   * 获取配置
   */
  getConfig(): ProviderConfig {
    return {
      ...this.config,
      apiKey: "***", // 隐藏 API Key
    };
  }

  /**
   * 是否支持流式输出
   */
  supportsStreaming(): boolean {
    return true;
  }

  /**
   * 流式生成摘要
   */
  async *generateSummaryStream(
    input: SummaryInput,
  ): AsyncGenerator<string, SummaryResult, unknown> {
    const startTime = Date.now();

    if (!this.config.apiKey) {
      throw new Error(`${this.getApiKeyEnvName()} 环境变量未配置`);
    }

    const contentType = input.contentType || this.detectContentType(input);
    const promptResult = this.buildPrompts({ ...input, contentType });

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
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Stream error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";
    let usage = { inputTokens: 0, outputTokens: 0 };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk
          .split("\n")
          .filter((line) => line.startsWith("data: "));

        for (const line of lines) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || "";
            if (content) {
              fullContent += content;
              yield content;
            }

            if (parsed.usage) {
              usage = {
                inputTokens: parsed.usage.prompt_tokens || 0,
                outputTokens: parsed.usage.completion_tokens || 0,
              };
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    const result = this.parseResponse(fullContent);
    const latencyMs = Date.now() - startTime;

    return {
      summary: result.summary,
      tags: result.tags,
      version: result.version,
      structured: result.structured,
      usage,
      latencyMs,
      providerUsed: this.name,
      modelUsed: this.config.model,
      contentType,
    };
  }

  // ============================================================================
  // Protected Methods (Prompt 构建和响应解析)
  // ============================================================================

  /**
   * 检测内容类型
   */
  protected detectContentType(input: SummaryInput): ContentType {
    const result = detectContentType({
      url: input.url,
      title: input.title,
      description: input.description,
      content: input.content,
    });
    return result.type;
  }

  /**
   * 构建 Prompt
   */
  buildPrompts(input: SummaryInput): PromptBuildResult {
    const useJsonOutput = isJsonOutputEnabled();
    const contentType = input.contentType || "article";

    if (useJsonOutput) {
      // V2: JSON 结构化输出
      const promptConfigV2 = getPromptConfigV2(contentType);
      return {
        systemPrompt: promptConfigV2.systemPrompt,
        userPrompt: buildTypeSpecificPromptV2(
          contentType,
          input.title,
          input.description,
          input.content,
          input.existingFolderNames,
        ),
        temperature: promptConfigV2.temperature,
        maxTokens: this.config.maxTokens,
      };
    } else {
      // V1: 纯文本输出
      const promptConfig = getPromptConfig(contentType);
      return {
        systemPrompt: promptConfig.systemPrompt,
        userPrompt: buildTypeSpecificPrompt(
          contentType,
          input.title,
          input.description,
          input.content,
          input.existingFolderNames,
        ),
        temperature: promptConfig.temperature,
        maxTokens: this.config.maxTokens,
      };
    }
  }

  /**
   * 解析响应
   */
  parseResponse(content: string): ParsedResponse {
    const useJsonOutput = isJsonOutputEnabled();

    if (useJsonOutput) {
      return this.parseResponseV2(content);
    } else {
      return this.parseResponseV1(content);
    }
  }

  /**
   * 解析 V2 结构化 JSON 响应
   */
  protected parseResponseV2(content: string): ParsedResponse {
    try {
      // 移除可能的 markdown 代码块标记
      const cleaned = content
        .replace(/```json\n?/gi, "")
        .replace(/```\n?/g, "")
        .trim();

      // 安全解析 JSON（带修复尝试）
      const parsed = safeParseJson<StructuredSummary>(cleaned);

      if (!parsed) {
        logger.warn(
          {
            rawContent: cleaned.substring(0, 200),
            provider: this.name,
          },
          `${this.name}: V2 JSON parse failed, falling back to V1`,
        );
        return this.parseResponseV1(content);
      }

      // 验证必要字段
      if (!parsed.tldr || !Array.isArray(parsed.key_points)) {
        logger.warn(
          {
            hasTldr: !!parsed.tldr,
            hasKeyPoints: Array.isArray(parsed.key_points),
            provider: this.name,
          },
          `${this.name}: V2 structure invalid, falling back to V1`,
        );
        return this.parseResponseV1(content);
      }

      // 提取标签
      let tags: string[] = [];
      if (Array.isArray(parsed.keywords) && parsed.keywords.length > 0) {
        tags = parsed.keywords
          .filter((k): k is string => typeof k === "string")
          .map((k) => k.trim())
          .filter((k) => k.length > 0)
          .slice(0, 5);
      }

      // 如果没有 keywords，使用配置中的回退标签
      if (tags.length === 0 && parsed.key_points.length > 0) {
        tags = getAISummaryConfig().fallbackTags;
      }

      // 构建结构化摘要
      const structured: StructuredSummary = {
        tldr: parsed.tldr,
        key_points: parsed.key_points.filter(
          (p): p is string => typeof p === "string",
        ),
        keywords: tags,
        sentiment: parsed.sentiment || "neutral",
        reading_time:
          typeof parsed.reading_time === "number" ? parsed.reading_time : 5,
        action_items: Array.isArray(parsed.action_items)
          ? parsed.action_items.filter(
              (a): a is string => typeof a === "string",
            )
          : undefined,
      };

      // 将完整 JSON 作为 summary 存储
      const summaryJson = JSON.stringify(structured);

      return {
        summary: summaryJson,
        tags,
        version: 2,
        structured,
      };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          rawContent: content.substring(0, 200),
          provider: this.name,
        },
        `${this.name}: V2 parse error, falling back to V1`,
      );
      return this.parseResponseV1(content);
    }
  }

  /**
   * 解析 V1 纯文本响应
   */
  protected parseResponseV1(content: string): ParsedResponse {
    try {
      // 移除可能的 markdown 代码块标记
      const cleaned = content
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      const result = JSON.parse(cleaned);

      // 验证结果格式
      if (!result.summary || typeof result.summary !== "string") {
        throw new Error("Invalid summary format");
      }

      if (!Array.isArray(result.tags) || result.tags.length === 0) {
        throw new Error("Invalid tags format");
      }

      // 确保标签是字符串数组
      const tags = (result.tags as unknown[])
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
        .slice(0, 5);

      if (tags.length === 0) {
        throw new Error("No valid tags found");
      }

      const trimmedSummary = result.summary.trim();

      // 检测摘要完整性
      if (!isSummaryComplete(trimmedSummary)) {
        logger.warn(
          {
            summaryLength: trimmedSummary.length,
            lastChars: trimmedSummary.slice(-20),
            provider: this.name,
          },
          `${this.name}: Summary may be truncated`,
        );
      }

      return {
        summary: trimmedSummary,
        tags,
        version: 1,
      };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          rawContent: content.substring(0, 200),
          provider: this.name,
        },
        `${this.name}: V1 parse error`,
      );
      throw new Error("解析 AI 响应失败");
    }
  }
}
