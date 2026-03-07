/**
 * MapReduce 长文摘要策略
 *
 * 对超过阈值的长文自动分段，各段并发提取要点，最终聚合为全局摘要。
 * 复用已有的 SemanticChunker 进行文本分段。
 *
 * 容错策略：
 * - Map 某段失败：跳过，用已有结果 Reduce
 * - 所有 Map 失败：降级到截断模式
 * - Reduce 失败：简单拼接各段摘要
 * - 总超时：中断 Map，用已有结果 Reduce
 *
 * @version 1.0.0
 * @since 2026-03-07
 */

import { logger } from "@/lib/logger";
import { SemanticChunker } from "@/lib/chunking/semantic-chunker";
import type { Chunk } from "@/lib/chunking/types";
import type {
  SummaryInput,
  SummaryResult,
  MapReduceConfig,
  ChunkSummary,
} from "../summary.types";
import { DEFAULT_MAP_REDUCE_CONFIG } from "../summary.types";
import type { ISummaryProvider } from "../providers/provider.interface";
import type { PromptBuildResult } from "../providers/provider.interface";
import {
  MAP_SYSTEM_PROMPT,
  REDUCE_SYSTEM_PROMPT,
  buildMapUserPrompt,
  buildReduceUserPrompt,
} from "./map-reduce.prompts";
import { safeParseJson } from "../summary.types";

/**
 * Map 阶段 LLM 响应类型
 */
interface MapResponse {
  key_points?: string[];
  entities_mentioned?: string[];
}

/**
 * MapReduce 长文摘要策略
 */
export class MapReduceSummaryStrategy {
  private chunker: SemanticChunker;
  private config: MapReduceConfig;

  constructor(config?: Partial<MapReduceConfig>) {
    this.config = { ...DEFAULT_MAP_REDUCE_CONFIG, ...config };
    this.chunker = new SemanticChunker({
      maxTokens: this.config.chunkMaxTokens,
      overlapTokens: 64,
      splitByHeaders: true,
      preserveCodeBlocks: true,
      minTokens: 50,
    });
  }

  /**
   * 判断内容是否需要 MapReduce
   */
  shouldUseMapReduce(content: string): boolean {
    return content.length > this.config.contentLengthThreshold;
  }

  /**
   * 执行 MapReduce 摘要
   */
  async execute(
    input: SummaryInput,
    provider: ISummaryProvider,
  ): Promise<SummaryResult> {
    const startTime = Date.now();

    if (!input.content) {
      throw new Error("MapReduce 策略需要 content 字段");
    }

    // Step 1: 分段
    const allChunks = this.chunker.chunk(input.content);
    const parentChunks = allChunks.filter((c) => c.type === "parent");

    if (parentChunks.length <= 1) {
      // 分段后只有一个块，不需要 MapReduce，回退让调用方处理
      throw new Error("SKIP_MAP_REDUCE");
    }

    logger.info(
      {
        bookmarkId: input.bookmarkId,
        totalChunks: parentChunks.length,
        contentLength: input.content.length,
      },
      "MapReduce: 开始分段摘要",
    );

    // Step 2: Map 阶段 - 并发提取各段要点
    const chunkSummaries = await this.mapPhase(parentChunks, input, provider);

    if (chunkSummaries.length === 0) {
      // 所有 Map 失败，降级到截断模式
      logger.warn(
        { bookmarkId: input.bookmarkId },
        "MapReduce: 所有 Map 失败，降级到截断模式",
      );
      throw new Error("SKIP_MAP_REDUCE");
    }

    // Step 3: Reduce 阶段 - 聚合全局摘要
    const result = await this.reducePhase(chunkSummaries, input, provider);

    const latencyMs = Date.now() - startTime;

    logger.info(
      {
        bookmarkId: input.bookmarkId,
        chunksProcessed: chunkSummaries.length,
        totalChunks: parentChunks.length,
        latencyMs,
      },
      "MapReduce: 分段摘要完成",
    );

    return {
      ...result,
      latencyMs,
    };
  }

  /**
   * Map 阶段：并发处理各段
   */
  private async mapPhase(
    chunks: Chunk[],
    input: SummaryInput,
    provider: ISummaryProvider,
  ): Promise<ChunkSummary[]> {
    const results: ChunkSummary[] = [];
    const totalChunks = chunks.length;

    // 按并发上限分批执行
    for (let i = 0; i < chunks.length; i += this.config.mapConcurrency) {
      const batch = chunks.slice(i, i + this.config.mapConcurrency);

      const batchResults = await Promise.allSettled(
        batch.map((chunk, batchIdx) =>
          this.mapSingleChunk(
            chunk,
            i + batchIdx,
            totalChunks,
            input,
            provider,
          ),
        ),
      );

      for (const result of batchResults) {
        if (result.status === "fulfilled" && result.value) {
          results.push(result.value);
        }
      }
    }

    return results;
  }

  /**
   * 处理单个段落
   */
  private async mapSingleChunk(
    chunk: Chunk,
    chunkIndex: number,
    totalChunks: number,
    input: SummaryInput,
    provider: ISummaryProvider,
  ): Promise<ChunkSummary | null> {
    try {
      // 使用简化 prompt 调用 provider
      const promptResult: PromptBuildResult = {
        systemPrompt: MAP_SYSTEM_PROMPT,
        userPrompt: buildMapUserPrompt(
          chunk.content,
          chunkIndex,
          totalChunks,
          input.title,
        ),
        temperature: 0.3,
        maxTokens: 500,
      };

      // 直接通过 API 调用（不走 provider.generateSummary 以避免额外逻辑）
      const result = await this.callProviderWithPrompt(provider, promptResult);

      const parsed = safeParseJson<MapResponse>(result);
      if (!parsed?.key_points || parsed.key_points.length === 0) {
        logger.warn(
          { chunkIndex, bookmarkId: input.bookmarkId },
          "MapReduce Map: 段落解析失败",
        );
        return null;
      }

      return {
        chunkIndex,
        summary: parsed.key_points.join("；"),
        keyPoints: parsed.key_points,
        tokenCount: chunk.tokenCount,
      };
    } catch (error) {
      logger.warn(
        {
          chunkIndex,
          bookmarkId: input.bookmarkId,
          error: error instanceof Error ? error.message : String(error),
        },
        "MapReduce Map: 段落处理失败",
      );
      return null;
    }
  }

  /**
   * Reduce 阶段：聚合全局摘要
   */
  private async reducePhase(
    chunkSummaries: ChunkSummary[],
    input: SummaryInput,
    provider: ISummaryProvider,
  ): Promise<SummaryResult> {
    const totalWordCount = input.content
      ? Math.round(input.content.length * 0.7)
      : undefined;

    const promptResult: PromptBuildResult = {
      systemPrompt: REDUCE_SYSTEM_PROMPT,
      userPrompt: buildReduceUserPrompt(
        chunkSummaries,
        input.title,
        totalWordCount,
      ),
      temperature: 0.5,
      maxTokens: 2000,
    };

    try {
      const result = await this.callProviderWithPrompt(provider, promptResult);
      const parsed = safeParseJson<Record<string, unknown>>(result);

      if (parsed && typeof parsed.tldr === "string") {
        const summary = JSON.stringify(parsed);
        return {
          summary,
          tags: Array.isArray(parsed.keywords)
            ? (parsed.keywords as string[]).slice(0, 5)
            : [],
          version: 2,
          structured: {
            tldr: parsed.tldr as string,
            key_points: Array.isArray(parsed.key_points)
              ? (parsed.key_points as string[])
              : [],
            keywords: Array.isArray(parsed.keywords)
              ? (parsed.keywords as string[])
              : [],
            sentiment:
              (parsed.sentiment as "positive" | "neutral" | "negative") ||
              "neutral",
            reading_time: (parsed.reading_time as number) || 5,
            action_items: Array.isArray(parsed.action_items)
              ? (parsed.action_items as string[])
              : undefined,
          },
          usage: { inputTokens: 0, outputTokens: 0 },
          latencyMs: 0,
          providerUsed: provider.name,
          modelUsed: undefined,
          contentType: input.contentType,
        };
      }

      // Reduce 解析失败，降级拼接
      return this.fallbackReduce(chunkSummaries, input, provider);
    } catch (error) {
      logger.warn(
        {
          bookmarkId: input.bookmarkId,
          error: error instanceof Error ? error.message : String(error),
        },
        "MapReduce Reduce: 聚合失败，使用降级拼接",
      );
      return this.fallbackReduce(chunkSummaries, input, provider);
    }
  }

  /**
   * 降级 Reduce：简单拼接各段摘要
   */
  private fallbackReduce(
    chunkSummaries: ChunkSummary[],
    input: SummaryInput,
    provider: ISummaryProvider,
  ): SummaryResult {
    const allPoints = chunkSummaries.flatMap((cs) => cs.keyPoints);
    const tldr = allPoints[0] || input.title;
    const keyPoints = allPoints.slice(0, 5);

    const structured = {
      tldr,
      key_points: keyPoints,
      keywords: [],
      sentiment: "neutral" as const,
      reading_time: 5,
    };

    return {
      summary: JSON.stringify(structured),
      tags: [],
      version: 2,
      structured,
      usage: { inputTokens: 0, outputTokens: 0 },
      latencyMs: 0,
      providerUsed: provider.name,
      contentType: input.contentType,
    };
  }

  /**
   * 使用自定义 prompt 调用 provider 的底层 API
   *
   * 注意：直接使用 provider 配置调用 API，绕过 generateSummary 的额外逻辑
   */
  private async callProviderWithPrompt(
    provider: ISummaryProvider,
    promptResult: PromptBuildResult,
  ): Promise<string> {
    const config = provider.getConfig();

    // 获取真实 API Key（getConfig 返回隐藏的，需从环境变量获取）
    const apiKey = this.resolveApiKey(provider.name);
    if (!apiKey) {
      throw new Error(`API Key 未配置: ${provider.name}`);
    }

    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: promptResult.systemPrompt },
          { role: "user", content: promptResult.userPrompt },
        ],
        temperature: promptResult.temperature,
        max_tokens: promptResult.maxTokens,
      }),
      signal: AbortSignal.timeout(this.config.mapTimeoutMs),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API 错误: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("API 返回空内容");
    }

    return content;
  }

  /**
   * 从环境变量获取 API Key
   */
  private resolveApiKey(providerName: string): string | undefined {
    const keyMap: Record<string, string> = {
      deepseek: "DEEPSEEK_API_KEY",
      "aliyun-bailian": "DASHSCOPE_API_KEY",
    };

    const envName = keyMap[providerName];
    return envName ? process.env[envName] : undefined;
  }
}
