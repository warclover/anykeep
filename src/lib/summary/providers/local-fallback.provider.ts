/**
 * Local Fallback Provider
 *
 * V4.2.7: 本地降级 Provider
 * 当所有云端 Provider 都不可用时，使用本地算法生成摘要
 *
 * 功能：
 * - 提取内容首段作为摘要
 * - 基于词频提取关键词作为标签
 * - 无需网络，始终可用
 *
 * @version 1.0.0
 * @since 2025-12-15
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
  ProviderName,
  SummaryVersion,
} from "../summary.types";

/**
 * 停用词列表（中文 + 英文常用词）
 */
const STOP_WORDS = new Set([
  // 中文停用词
  "的",
  "了",
  "和",
  "是",
  "在",
  "有",
  "这",
  "个",
  "我",
  "你",
  "他",
  "她",
  "它",
  "们",
  "也",
  "就",
  "不",
  "都",
  "而",
  "及",
  "与",
  "或",
  "但",
  "如果",
  "因为",
  "所以",
  "可以",
  "一个",
  "这个",
  "那个",
  "什么",
  "怎么",
  "为什么",
  "如何",
  "以及",
  "通过",
  "使用",
  "进行",
  "可能",
  "需要",
  "已经",
  "正在",
  "能够",
  "应该",
  "其中",
  "包括",
  "关于",
  "对于",
  "由于",
  "虽然",
  "然而",
  "因此",
  "同时",
  "并且",
  "或者",
  "以及",
  "之后",
  "之前",
  "以下",
  "以上",
  // 英文停用词
  "the",
  "a",
  "an",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "must",
  "shall",
  "can",
  "need",
  "dare",
  "ought",
  "used",
  "to",
  "of",
  "in",
  "for",
  "on",
  "with",
  "at",
  "by",
  "from",
  "up",
  "about",
  "into",
  "over",
  "after",
  "beneath",
  "under",
  "above",
  "and",
  "but",
  "or",
  "nor",
  "so",
  "yet",
  "both",
  "either",
  "neither",
  "not",
  "only",
  "own",
  "same",
  "than",
  "too",
  "very",
  "just",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "you",
  "your",
  "we",
  "our",
  "they",
  "their",
  "he",
  "she",
  "him",
  "her",
  "his",
]);

/**
 * 本地降级 Provider 配置
 */
const LOCAL_FALLBACK_CONFIG: ProviderConfig = {
  apiKey: "",
  baseUrl: "",
  model: "local-fallback",
  timeoutMs: 100, // 本地处理，几乎无延迟
  maxRetries: 0,
  temperature: 0,
  maxTokens: 0,
};

/**
 * 本地降级 Provider
 *
 * 特点：
 * - 优先级最低（100），只在所有云端 Provider 失败时使用
 * - 始终可用，无网络依赖
 * - 返回基础摘要和标签
 */
export class LocalFallbackProvider implements ISummaryProvider {
  readonly name: ProviderName = "local";
  readonly priority = 100; // 最低优先级

  /**
   * 生成摘要
   *
   * 策略：
   * 1. 优先使用 description，如果没有则使用 content
   * 2. 提取首段作为摘要（最多 200 字）
   * 3. 从标题和内容中提取关键词作为标签
   */
  async generateSummary(input: SummaryInput): Promise<SummaryResult> {
    const startTime = Date.now();

    logger.info(
      { bookmarkId: input.bookmarkId, title: input.title.slice(0, 30) },
      "LocalFallbackProvider: Generating summary locally",
    );

    // 1. 生成摘要
    const summary = this.extractSummary(input);

    // 2. 提取标签
    const tags = this.extractTags(input);

    const latencyMs = Date.now() - startTime;

    const result: SummaryResult = {
      summary,
      tags,
      version: 1 as SummaryVersion,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      },
      latencyMs,
      providerUsed: "local",
      modelUsed: "local-fallback",
    };

    logger.info(
      {
        bookmarkId: input.bookmarkId,
        summaryLength: summary.length,
        tagsCount: tags.length,
        latencyMs,
      },
      "LocalFallbackProvider: Summary generated",
    );

    return result;
  }

  /**
   * 健康检查
   *
   * 本地 Provider 始终可用
   */
  async healthCheck(): Promise<ProviderHealth> {
    return {
      available: true,
      latencyMs: 0,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * 估算成本
   *
   * 本地处理无成本
   */
  estimateCost(_tokenCount: number): number {
    return 0;
  }

  /**
   * 获取配置
   */
  getConfig(): ProviderConfig {
    return { ...LOCAL_FALLBACK_CONFIG };
  }

  /**
   * 是否支持流式输出
   */
  supportsStreaming(): boolean {
    return false;
  }

  // ===========================================================================
  // 私有方法
  // ===========================================================================

  /**
   * 提取摘要
   *
   * 策略：
   * 1. 优先使用 description
   * 2. 如果没有 description，从 content 提取首段
   * 3. 限制最大长度 200 字
   */
  private extractSummary(input: SummaryInput): string {
    const maxLength = 200;

    // 优先使用 description
    if (input.description && input.description.trim().length > 10) {
      return this.truncateText(input.description.trim(), maxLength);
    }

    // 从 content 提取首段
    if (input.content) {
      const firstParagraph = this.extractFirstParagraph(input.content);
      if (firstParagraph.length > 10) {
        return this.truncateText(firstParagraph, maxLength);
      }
    }

    // 降级：使用标题
    return input.title.length > maxLength
      ? input.title.slice(0, maxLength) + "..."
      : input.title;
  }

  /**
   * 提取首段
   */
  private extractFirstParagraph(content: string): string {
    // 移除 HTML 标签
    const text = content.replace(/<[^>]+>/g, " ").trim();

    // 按段落分割
    const paragraphs = text.split(/\n\s*\n|\r\n\s*\r\n/);

    // 找到第一个有意义的段落
    for (const p of paragraphs) {
      const trimmed = p.trim();
      if (trimmed.length > 20) {
        return trimmed;
      }
    }

    // 如果没有段落，返回前 500 字
    return text.slice(0, 500);
  }

  /**
   * 截断文本
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }

    // 尝试在标点处截断
    const truncated = text.slice(0, maxLength);
    const lastPunctuation = Math.max(
      truncated.lastIndexOf("。"),
      truncated.lastIndexOf("！"),
      truncated.lastIndexOf("？"),
      truncated.lastIndexOf("."),
      truncated.lastIndexOf("!"),
      truncated.lastIndexOf("?"),
    );

    if (lastPunctuation > maxLength * 0.6) {
      return truncated.slice(0, lastPunctuation + 1);
    }

    return truncated + "...";
  }

  /**
   * 提取标签
   *
   * 策略：
   * 1. 分词（中英文混合）
   * 2. 过滤停用词
   * 3. 按词频排序
   * 4. 返回 Top 5 关键词
   */
  private extractTags(input: SummaryInput): string[] {
    const maxTags = 5;
    const minWordLength = 2;

    // 合并标题和内容
    const text = [input.title, input.description || "", input.content || ""]
      .join(" ")
      .toLowerCase();

    // 分词（支持中英文）
    const words = this.tokenize(text);

    // 计算词频
    const wordFreq = new Map<string, number>();
    for (const word of words) {
      // 过滤条件
      if (word.length < minWordLength) continue;
      if (STOP_WORDS.has(word)) continue;
      if (/^\d+$/.test(word)) continue; // 纯数字

      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }

    // 按词频排序，取 Top N
    const sortedWords = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxTags)
      .map(([word]) => word);

    // 如果标签太少，尝试从标题提取名词短语
    if (sortedWords.length < 3 && input.title) {
      const titleWords = this.tokenize(input.title).filter(
        (w) => w.length >= 2 && !STOP_WORDS.has(w),
      );
      for (const word of titleWords) {
        if (!sortedWords.includes(word)) {
          sortedWords.push(word);
          if (sortedWords.length >= maxTags) break;
        }
      }
    }

    return sortedWords;
  }

  /**
   * 分词
   *
   * 简单分词策略：
   * - 英文按空格和标点分割
   * - 中文按字符分割（简化处理，实际生产可使用分词库）
   */
  private tokenize(text: string): string[] {
    const words: string[] = [];

    // 英文单词
    const englishWords = text.match(/[a-z]+/gi) || [];
    words.push(...englishWords.map((w) => w.toLowerCase()));

    // 中文词汇（简单按 2-4 字词提取）
    const chineseChars = text.match(/[\u4e00-\u9fa5]+/g) || [];
    for (const chars of chineseChars) {
      if (chars.length >= 2) {
        // 提取 2-4 字词组
        for (let len = 2; len <= Math.min(4, chars.length); len++) {
          for (let i = 0; i <= chars.length - len; i++) {
            words.push(chars.slice(i, i + len));
          }
        }
      }
    }

    return words;
  }

  // ===========================================================================
  // 接口要求的辅助方法（本地 Provider 不需要实际实现）
  // ===========================================================================

  /**
   * 构建 Prompt（本地 Provider 不使用）
   */
  buildPrompts(_input: SummaryInput): PromptBuildResult {
    return {
      systemPrompt: "",
      userPrompt: "",
      temperature: 0,
      maxTokens: 0,
    };
  }

  /**
   * 解析响应（本地 Provider 不使用）
   */
  parseResponse(_content: string): ParsedResponse {
    return {
      summary: "",
      tags: [],
      version: 1,
    };
  }
}
