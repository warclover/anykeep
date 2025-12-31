/**
 * MD 收藏专用摘要服务
 *
 * 组合使用现有 AI Provider（DeepSeek/Aliyun/LocalFallback）
 * 与 MD 专用 Prompt，实现 Markdown 文档的智能摘要
 *
 * 核心特性：
 * 1. 使用 MD 专用 Prompt（识别代码块、标题层级）
 * 2. 支持长文档分块处理
 * 3. 超时控制（30秒）
 * 4. 自动重试（3次）
 * 5. Provider 故障转移
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import { logger } from "@/lib/logger";
import type {
  MdSummaryInput,
  MdSummaryResult,
  MdAIErrorCode,
  ChunkSummary,
  CancellableContext,
} from "./types";
import {
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_RETRIES,
  RETRY_DELAY_BASE_MS,
  MIN_CONTENT_LENGTH,
} from "./types";
import { MdAIError as MdAIErrorClass } from "./types";
import {
  MdContentChunker,
  needsChunking,
  chunkContent,
} from "./md-content-chunker";
import {
  getMdPromptConfig,
  buildMdSummaryUserPrompt,
  buildChunkSummaryUserPrompt,
  buildMergeSummaryPrompt,
} from "./prompts";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * Provider 配置
 */
interface ProviderConfig {
  name: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  priority: number;
}

/**
 * 摘要服务配置
 */
export interface MdSummaryServiceConfig {
  /** 超时时间（毫秒） */
  timeoutMs?: number;
  /** 最大重试次数 */
  maxRetries?: number;
  /** 强制使用指定 Provider */
  forceProvider?: string;
  /** 是否启用分块处理 */
  enableChunking?: boolean;
  /** 分块最大字符数 */
  chunkMaxChars?: number;
}

// ============================================================================
// Provider 配置
// ============================================================================

/**
 * 获取可用的 Providers（按优先级排序）
 */
function getAvailableProviders(): ProviderConfig[] {
  const providers: ProviderConfig[] = [];

  // DeepSeek (优先级 1)
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (deepseekKey) {
    providers.push({
      name: "deepseek",
      baseUrl: "https://api.deepseek.com/v1",
      model: "deepseek-chat",
      apiKey: deepseekKey,
      priority: 1,
    });
  }

  // Aliyun Bailian (优先级 2)
  const aliyunKey = process.env.DASHSCOPE_API_KEY;
  if (aliyunKey) {
    providers.push({
      name: "aliyun",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      model: "qwen-plus",
      apiKey: aliyunKey,
      priority: 2,
    });
  }

  // OpenAI (优先级 3 - 备用)
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    providers.push({
      name: "openai",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
      apiKey: openaiKey,
      priority: 3,
    });
  }

  return providers.sort((a, b) => a.priority - b.priority);
}

// ============================================================================
// 主服务类
// ============================================================================

/**
 * MD 文档专用摘要服务
 */
export class MdSummaryService {
  private config: Required<MdSummaryServiceConfig>;
  private providers: ProviderConfig[];

  constructor(config: MdSummaryServiceConfig = {}) {
    this.config = {
      timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
      forceProvider: config.forceProvider ?? "",
      enableChunking: config.enableChunking ?? true,
      chunkMaxChars: config.chunkMaxChars ?? 5000,
    };

    this.providers = getAvailableProviders();

    if (this.providers.length === 0) {
      logger.warn(
        { action: "md_summary_service_init" },
        "No AI providers configured",
      );
    }
  }

  /**
   * 生成 MD 文档摘要
   *
   * @param input - 摘要输入
   * @param context - 可取消上下文
   */
  async generate(
    input: MdSummaryInput,
    context?: CancellableContext,
  ): Promise<MdSummaryResult> {
    const _startTime = Date.now();

    // 验证输入
    this.validateInput(input);

    // 检查取消
    context?.cancellationToken?.throwIfCancelled();

    // 检查是否需要分块
    if (
      this.config.enableChunking &&
      needsChunking(input.content, this.config.chunkMaxChars)
    ) {
      return this.generateWithChunking(input, context);
    }

    // 单块处理
    return this.generateSingle(input, context);
  }

  /**
   * 验证输入
   */
  private validateInput(input: MdSummaryInput): void {
    if (!input.content || input.content.length < MIN_CONTENT_LENGTH) {
      throw new MdAIErrorClass(
        "MD_AI_CONTENT_TOO_SHORT" as MdAIErrorCode,
        `内容太短，至少需要 ${MIN_CONTENT_LENGTH} 个字符`,
        undefined,
        false,
      );
    }

    if (!input.title) {
      throw new MdAIErrorClass(
        "MD_AI_CONTENT_INVALID" as MdAIErrorCode,
        "缺少文档标题",
        undefined,
        false,
      );
    }
  }

  /**
   * 单块生成摘要
   */
  private async generateSingle(
    input: MdSummaryInput,
    context?: CancellableContext,
  ): Promise<MdSummaryResult> {
    const providers = this.getProvidersToTry();

    if (providers.length === 0) {
      throw new MdAIErrorClass(
        "MD_AI_PROVIDER_UNAVAILABLE" as MdAIErrorCode,
        "没有可用的 AI Provider",
        undefined,
        false,
      );
    }

    let lastError: Error | null = null;

    // 尝试每个 Provider
    for (const provider of providers) {
      try {
        const result = await this.callProvider(provider, input, context);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn(
          {
            provider: provider.name,
            error: lastError.message,
            collectionId: input.collectionId,
          },
          "MdSummaryService: Provider failed, trying next",
        );
      }
    }

    // 所有 Provider 都失败
    throw new MdAIErrorClass(
      "MD_AI_PROVIDER_ERROR" as MdAIErrorCode,
      lastError?.message || "所有 AI Provider 均不可用",
      lastError,
      false,
    );
  }

  /**
   * 分块生成摘要
   */
  private async generateWithChunking(
    input: MdSummaryInput,
    context?: CancellableContext,
  ): Promise<MdSummaryResult> {
    const chunkResult = chunkContent(input.content, {
      maxChars: this.config.chunkMaxChars,
      preserveCodeBlocks: true,
      splitByHeading: true,
    });

    logger.info(
      {
        collectionId: input.collectionId,
        totalChunks: chunkResult.chunks.length,
        strategy: chunkResult.strategy,
      },
      "MdSummaryService: Processing with chunking",
    );

    const chunkSummaries: ChunkSummary[] = [];
    let previousSummary: string | undefined;

    // 依次处理每个分块
    for (const chunk of chunkResult.chunks) {
      context?.cancellationToken?.throwIfCancelled();

      try {
        // Note: chunkInput prepared for future use with chunk metadata
        const _chunkInput: MdSummaryInput = {
          ...input,
          content: chunk.content,
        };

        // 构建分块 Prompt
        const userPrompt = buildChunkSummaryUserPrompt(
          chunk.index,
          chunkResult.chunks.length,
          chunk.content,
          { title: input.title, previousSummary },
        );

        const result = await this.callProviderWithCustomPrompt(
          this.getProvidersToTry()[0],
          userPrompt,
          context,
        );

        chunkSummaries.push({
          chunkIndex: chunk.index,
          summary: result.tldr,
          keyPoints: result.keyPoints,
          keywords: result.keywords,
        });

        previousSummary = result.tldr;
      } catch (error) {
        logger.warn(
          {
            collectionId: input.collectionId,
            chunkIndex: chunk.index,
            error: error instanceof Error ? error.message : String(error),
          },
          "MdSummaryService: Chunk processing failed",
        );
        // 继续处理下一个分块
      }
    }

    // 合并分块摘要
    if (chunkSummaries.length === 0) {
      throw new MdAIErrorClass(
        "MD_AI_CHUNK_ERROR" as MdAIErrorCode,
        "所有分块处理均失败",
        undefined,
        true,
      );
    }

    return this.mergeSummaries(chunkSummaries, input);
  }

  /**
   * 合并分块摘要
   */
  private async mergeSummaries(
    chunkSummaries: ChunkSummary[],
    input: MdSummaryInput,
  ): Promise<MdSummaryResult> {
    // 如果只有一个分块，直接返回
    if (chunkSummaries.length === 1) {
      const chunk = chunkSummaries[0];
      return {
        tldr: chunk.summary,
        keyPoints: chunk.keyPoints,
        keywords: chunk.keywords,
        contentType: "SUMMARY",
        contentTypeConfidence: 0.7,
        summary: chunk.summary,
        tags: chunk.keywords,
      };
    }

    // 使用 AI 合并多个分块摘要
    const mergePrompt = buildMergeSummaryPrompt(
      chunkSummaries.map((c) => ({
        summary: c.summary,
        keyPoints: c.keyPoints,
      })),
      input.title,
    );

    const providers = this.getProvidersToTry();
    if (providers.length === 0) {
      // 无 Provider 可用，使用本地合并
      const merged = MdContentChunker.mergeSummaries(chunkSummaries);
      return {
        tldr: merged.summary.substring(0, 100),
        keyPoints: merged.keyPoints,
        keywords: merged.keywords,
        contentType: "SUMMARY",
        contentTypeConfidence: 0.6,
        summary: merged.summary,
        tags: merged.keywords,
      };
    }

    try {
      const result = await this.callProviderWithCustomPrompt(
        providers[0],
        mergePrompt,
      );
      return result;
    } catch {
      // 合并失败，使用本地合并
      const merged = MdContentChunker.mergeSummaries(chunkSummaries);
      return {
        tldr: merged.summary.substring(0, 100),
        keyPoints: merged.keyPoints,
        keywords: merged.keywords,
        contentType: "SUMMARY",
        contentTypeConfidence: 0.6,
        summary: merged.summary,
        tags: merged.keywords,
      };
    }
  }

  /**
   * 获取要尝试的 Provider 列表
   */
  private getProvidersToTry(): ProviderConfig[] {
    if (this.config.forceProvider) {
      const forced = this.providers.find(
        (p) => p.name === this.config.forceProvider,
      );
      return forced ? [forced] : [];
    }
    return this.providers;
  }

  /**
   * 调用 Provider 生成摘要
   */
  private async callProvider(
    provider: ProviderConfig,
    input: MdSummaryInput,
    context?: CancellableContext,
  ): Promise<MdSummaryResult> {
    const promptConfig = getMdPromptConfig({
      hasCodeBlocks: input.metadata?.codeBlockCount
        ? input.metadata.codeBlockCount > 0
        : false,
    });

    const userPrompt = buildMdSummaryUserPrompt(input);

    return this.callProviderWithPrompt(
      provider,
      promptConfig.systemPrompt,
      userPrompt,
      promptConfig,
      context,
    );
  }

  /**
   * 使用自定义 Prompt 调用 Provider
   */
  private async callProviderWithCustomPrompt(
    provider: ProviderConfig,
    userPrompt: string,
    context?: CancellableContext,
  ): Promise<MdSummaryResult> {
    const promptConfig = getMdPromptConfig();

    return this.callProviderWithPrompt(
      provider,
      promptConfig.systemPrompt,
      userPrompt,
      promptConfig,
      context,
    );
  }

  /**
   * 调用 Provider API
   */
  private async callProviderWithPrompt(
    provider: ProviderConfig,
    systemPrompt: string,
    userPrompt: string,
    promptConfig: { temperature: number; maxTokens: number },
    context?: CancellableContext,
  ): Promise<MdSummaryResult> {
    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt <= this.config.maxRetries) {
      // 检查取消
      context?.cancellationToken?.throwIfCancelled();

      try {
        // 重试延迟
        if (attempt > 0) {
          const delayMs = RETRY_DELAY_BASE_MS * Math.pow(2, attempt - 1);
          await this.delay(delayMs);
        }

        // 创建超时信号
        const timeoutSignal = AbortSignal.timeout(this.config.timeoutMs);
        const signal = context?.abortSignal
          ? this.combineSignals(context.abortSignal, timeoutSignal)
          : timeoutSignal;

        const response = await fetch(`${provider.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${provider.apiKey}`,
          },
          body: JSON.stringify({
            model: provider.model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: promptConfig.temperature,
            max_tokens: promptConfig.maxTokens,
          }),
          signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          if (
            this.isRetryableStatus(response.status) &&
            attempt < this.config.maxRetries
          ) {
            lastError = new Error(
              `API 错误: ${response.status} - ${errorText}`,
            );
            attempt++;
            continue;
          }
          throw new Error(`API 错误: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const aiContent = data.choices?.[0]?.message?.content;

        if (!aiContent) {
          throw new Error("API 返回空内容");
        }

        return this.parseResponse(aiContent);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // 检查是否被取消
        if (lastError.name === "AbortError") {
          throw new MdAIErrorClass(
            "MD_AI_CANCELLED" as MdAIErrorCode,
            "操作已取消",
            lastError,
            false,
          );
        }

        // 检查是否可重试
        if (
          this.isRetryableError(lastError) &&
          attempt < this.config.maxRetries
        ) {
          attempt++;
          continue;
        }

        break;
      }
    }

    throw new MdAIErrorClass(
      "MD_AI_PROVIDER_ERROR" as MdAIErrorCode,
      lastError?.message || "摘要生成失败",
      lastError,
      false,
    );
  }

  /**
   * 解析 AI 响应
   */
  private parseResponse(content: string): MdSummaryResult {
    try {
      // 移除可能的 markdown 代码块标记
      const cleaned = content
        .replace(/```json\n?/gi, "")
        .replace(/```\n?/g, "")
        .trim();

      const parsed = JSON.parse(cleaned);

      // 验证必要字段
      if (!parsed.tldr) {
        throw new Error("缺少 tldr 字段");
      }

      const result: MdSummaryResult = {
        suggestedTitle: parsed.suggested_title
          ? String(parsed.suggested_title).trim()
          : undefined,
        tldr: String(parsed.tldr),
        keyPoints: Array.isArray(parsed.key_points) ? parsed.key_points : [],
        codeHighlights: Array.isArray(parsed.code_highlights)
          ? parsed.code_highlights
          : undefined,
        structureOverview: parsed.structure_overview,
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
        contentType: parsed.content_type || "OTHER",
        contentTypeConfidence:
          typeof parsed.content_type_confidence === "number"
            ? parsed.content_type_confidence
            : 0.7,
        entities: Array.isArray(parsed.entities) ? parsed.entities : undefined,
        difficulty: parsed.difficulty,
        summary: parsed.tldr,
        tags: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 5) : [],
      };

      return result;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          rawContent: content.substring(0, 200),
        },
        "MdSummaryService: Parse error",
      );

      throw new MdAIErrorClass(
        "MD_AI_PARSE_ERROR" as MdAIErrorCode,
        "解析 AI 响应失败",
        error,
        true,
      );
    }
  }

  /**
   * 判断状态码是否可重试
   */
  private isRetryableStatus(status: number): boolean {
    return status >= 500 || status === 429;
  }

  /**
   * 判断错误是否可重试
   */
  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes("timeout") ||
      message.includes("network") ||
      message.includes("fetch") ||
      message.includes("econnreset") ||
      message.includes("429") ||
      /api 错误: 5\d\d/.test(message)
    );
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 组合多个 AbortSignal
   */
  private combineSignals(...signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController();

    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort(signal.reason);
        return controller.signal;
      }
      signal.addEventListener("abort", () => controller.abort(signal.reason), {
        once: true,
      });
    }

    return controller.signal;
  }
}

// ============================================================================
// 导出
// ============================================================================

export { MdSummaryService as default };
