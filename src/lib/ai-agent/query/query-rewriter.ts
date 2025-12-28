/**
 * LLM 查询改写器
 *
 * 使用 DeepSeek 对用户查询进行语义扩展和同义词补充，
 * 提升搜索召回率。
 *
 * @module ai-agent/query
 * @version 1.0.0
 * @since 2025-12-28
 */

import { logger } from "@/lib/logger";
import { LRUCache } from "lru-cache";
import type {
  QueryRewriteResult,
  QueryRewriterConfig,
  UserContext,
} from "./types";
import { DEFAULT_QUERY_REWRITER_CONFIG } from "./types";

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

/**
 * 查询改写器
 *
 * 功能：
 * - 识别用户真实意图
 * - 扩展同义词和相关术语
 * - 生成更精确的搜索查询
 * - 支持 LRU 缓存减少重复调用
 */
export class QueryRewriter {
  private config: QueryRewriterConfig;
  private cache: LRUCache<string, QueryRewriteResult>;
  private apiKey: string;

  constructor(config?: Partial<QueryRewriterConfig>) {
    this.config = { ...DEFAULT_QUERY_REWRITER_CONFIG, ...config };
    this.apiKey = process.env.DEEPSEEK_API_KEY || "";

    // 初始化 LRU 缓存
    this.cache = new LRUCache<string, QueryRewriteResult>({
      max: 1000, // 最多缓存 1000 个查询
      ttl: this.config.cacheTtlMs,
    });
  }

  /**
   * 改写用户查询
   *
   * @param query - 原始查询
   * @param context - 可选的用户上下文
   * @returns 改写结果
   */
  async rewrite(
    query: string,
    context?: UserContext,
  ): Promise<QueryRewriteResult> {
    const startTime = Date.now();

    // 查询过短，不改写
    if (query.length < this.config.minQueryLength) {
      return this.createPassthroughResult(query, startTime);
    }

    // 检查缓存
    const cacheKey = this.buildCacheKey(query, context);
    if (this.config.enableCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        logger.debug({ query, cached: true }, "QueryRewriter: Cache hit");
        return {
          ...cached,
          cached: true,
          latencyMs: Date.now() - startTime,
        };
      }
    }

    // API Key 检查
    if (!this.apiKey) {
      logger.warn(
        "QueryRewriter: DEEPSEEK_API_KEY not configured, passthrough",
      );
      return this.createPassthroughResult(query, startTime);
    }

    try {
      const result = await this.callLLM(query, context);
      result.latencyMs = Date.now() - startTime;

      // 存入缓存
      if (this.config.enableCache) {
        this.cache.set(cacheKey, result);
      }

      logger.debug(
        {
          original: query,
          rewritten: result.rewritten,
          synonyms: result.synonyms,
          latencyMs: result.latencyMs,
        },
        "QueryRewriter: Rewrite completed",
      );

      return result;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          query,
        },
        "QueryRewriter: LLM call failed, fallback to passthrough",
      );
      return this.createPassthroughResult(query, startTime);
    }
  }

  /**
   * 调用 LLM 进行查询改写
   */
  private async callLLM(
    query: string,
    context?: UserContext,
  ): Promise<QueryRewriteResult> {
    const prompt = this.buildPrompt(query, context);

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.config.timeoutMs,
    );

    try {
      const response = await fetch(DEEPSEEK_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: "system",
              content: this.getSystemPrompt(),
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 300,
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `DeepSeek API error: ${response.status} - ${errorText}`,
        );
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error("DeepSeek API returned empty content");
      }

      return this.parseResponse(query, content);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 获取 System Prompt
   */
  private getSystemPrompt(): string {
    return `你是一个专业的搜索查询优化专家。你的任务是改写用户的搜索查询，使其更加精确，同时扩展相关的同义词和术语。

规则：
1. 保持原始查询的核心意图
2. 扩展技术术语的同义词（如：React Hooks → useState, useEffect）
3. 将口语化表达转为专业术语
4. 同义词数量不超过 ${this.config.maxSynonyms} 个
5. 如果查询已经足够清晰，保持原样

输出 JSON 格式：
{
  "intent": "用户意图的简短描述",
  "rewritten": "改写后的查询（如果不需要改写则保持原样）",
  "synonyms": ["同义词1", "同义词2"],
  "confidence": 0.85
}`;
  }

  /**
   * 构建用户 Prompt
   */
  private buildPrompt(query: string, context?: UserContext): string {
    let prompt = `用户查询：「${query}」`;

    if (context) {
      const contextParts: string[] = [];

      if (context.totalBookmarks > 0) {
        contextParts.push(`收藏数量：${context.totalBookmarks} 条`);
      }

      if (context.topPlatforms?.length > 0) {
        contextParts.push(
          `常用平台：${context.topPlatforms.slice(0, 3).join("、")}`,
        );
      }

      if (context.topTags?.length > 0) {
        contextParts.push(
          `常用标签：${context.topTags.slice(0, 5).join("、")}`,
        );
      }

      if (contextParts.length > 0) {
        prompt += `\n\n用户上下文：\n${contextParts.join("\n")}`;
      }
    }

    return prompt;
  }

  /**
   * 解析 LLM 响应
   */
  private parseResponse(original: string, content: string): QueryRewriteResult {
    try {
      const parsed = JSON.parse(content);

      return {
        original,
        rewritten: parsed.rewritten || original,
        synonyms: Array.isArray(parsed.synonyms)
          ? parsed.synonyms.slice(0, this.config.maxSynonyms)
          : [],
        intent: parsed.intent || "unknown",
        confidence:
          typeof parsed.confidence === "number"
            ? Math.min(1, Math.max(0, parsed.confidence))
            : 0.5,
        cached: false,
      };
    } catch {
      // JSON 解析失败，尝试提取关键信息
      logger.warn({ content }, "QueryRewriter: Failed to parse JSON response");

      return {
        original,
        rewritten: original,
        synonyms: [],
        intent: "parse_error",
        confidence: 0.3,
        cached: false,
      };
    }
  }

  /**
   * 创建直通结果（不改写）
   */
  private createPassthroughResult(
    query: string,
    startTime: number,
  ): QueryRewriteResult {
    return {
      original: query,
      rewritten: query,
      synonyms: [],
      intent: "passthrough",
      confidence: 1.0,
      cached: false,
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * 构建缓存键
   */
  private buildCacheKey(query: string, _context?: UserContext): string {
    // 只使用查询本身作为缓存键，上下文变化不影响缓存
    return `qr:${query.toLowerCase().trim()}`;
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: 1000,
    };
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// 单例实例
let rewriterInstance: QueryRewriter | null = null;

/**
 * 获取 QueryRewriter 单例
 */
export function getQueryRewriter(): QueryRewriter {
  if (!rewriterInstance) {
    rewriterInstance = new QueryRewriter();
  }
  return rewriterInstance;
}
