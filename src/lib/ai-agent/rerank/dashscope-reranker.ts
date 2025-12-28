/**
 * 阿里百炼 DashScope Rerank 服务
 *
 * 使用 GTE Rerank 模型对搜索结果进行语义重排序，
 * 提升搜索结果的相关性。
 *
 * @module ai-agent/rerank
 * @version 1.0.0
 * @since 2025-12-28
 */

import { logger } from "@/lib/logger";
import type {
  DashScopeRerankConfig,
  DashScopeRerankResponse,
  RerankResult,
  RerankUsageStats,
} from "./types";
import { DEFAULT_DASHSCOPE_RERANK_CONFIG, DAILY_TOKEN_LIMIT } from "./types";

const DASHSCOPE_RERANK_URL =
  "https://dashscope.aliyuncs.com/api/v1/services/rerank/text-rerank/rerank";

/**
 * DashScope Reranker
 *
 * 功能：
 * - 使用交叉编码器对搜索结果进行语义重排序
 * - 支持中文、英文、日语等 50+ 语言
 * - 内置用量追踪和限额控制
 * - 优雅降级（API 失败时返回原始顺序）
 */
export class DashScopeReranker {
  private apiKey: string;
  private config: DashScopeRerankConfig;
  private usageStats: RerankUsageStats;

  constructor(config?: Partial<DashScopeRerankConfig>) {
    this.apiKey = process.env.DASHSCOPE_API_KEY || "";
    this.config = { ...DEFAULT_DASHSCOPE_RERANK_CONFIG, ...config };

    // 初始化使用量统计
    this.usageStats = {
      dailyTokens: 0,
      dailyRequests: 0,
      lastResetDate: new Date().toISOString().split("T")[0],
    };

    // C3: 安全日志 - 仅记录 API Key 是否存在，不记录实际值
    logger.debug(
      {
        apiKeyPresent: !!this.apiKey,
        model: this.config.model,
        topK: this.config.topK,
      },
      "DashScopeReranker: Initialized",
    );
  }

  /**
   * 对文档列表进行重排序
   *
   * @param query - 查询文本
   * @param documents - 待排序的文档列表
   * @param topK - 可选，返回的 Top N 结果
   * @returns 重排序后的结果
   */
  async rerank(
    query: string,
    documents: string[],
    topK?: number,
  ): Promise<RerankResult[]> {
    if (documents.length === 0) {
      return [];
    }

    // API Key 检查
    if (!this.apiKey) {
      logger.warn("DashScopeReranker: DASHSCOPE_API_KEY not configured");
      return this.createFallbackResults(documents);
    }

    // 用量检查
    if (!this.canMakeRequest()) {
      logger.warn("DashScopeReranker: Daily token limit reached, fallback");
      return this.createFallbackResults(documents);
    }

    // 重置每日统计（如果跨天）
    this.resetDailyStatsIfNeeded();

    try {
      const startTime = Date.now();
      const results = await this.callAPI(query, documents, topK);
      const latencyMs = Date.now() - startTime;

      logger.debug(
        {
          query: query.slice(0, 50),
          inputCount: documents.length,
          outputCount: results.length,
          latencyMs,
        },
        "DashScopeReranker: Rerank completed",
      );

      return results;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          query: query.slice(0, 50),
        },
        "DashScopeReranker: API call failed, fallback",
      );
      return this.createFallbackResults(documents);
    }
  }

  /**
   * 调用 DashScope Rerank API
   */
  private async callAPI(
    query: string,
    documents: string[],
    topK?: number,
  ): Promise<RerankResult[]> {
    // DashScope 限制: 每个文档最多 4000 token
    // 保守估计：中文 2 字符/token，英文 4 字符/token
    const truncatedDocs = documents.map((doc) =>
      doc.length > 8000 ? doc.slice(0, 8000) : doc,
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.config.timeoutMs,
    );

    try {
      const response = await fetch(DASHSCOPE_RERANK_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.config.model,
          input: {
            query,
            documents: truncatedDocs,
          },
          parameters: {
            top_n: topK ?? this.config.topK,
            return_documents: this.config.returnDocuments,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `DashScope API error: ${response.status} - ${errorText}`,
        );
      }

      const data: DashScopeRerankResponse = await response.json();

      // 更新使用量统计
      this.trackUsage(data.usage.total_tokens);

      return data.output.results.map((r) => ({
        index: r.index,
        relevanceScore: r.relevance_score,
        document: r.document?.text,
      }));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 创建降级结果（保持原始顺序，线性衰减分数）
   */
  private createFallbackResults(documents: string[]): RerankResult[] {
    return documents.map((_, index) => ({
      index,
      relevanceScore: 1 - index / documents.length,
    }));
  }

  /**
   * 追踪使用量
   */
  private trackUsage(tokensUsed: number): void {
    this.usageStats.dailyTokens += tokensUsed;
    this.usageStats.dailyRequests++;

    // 警告阈值：80%
    if (this.usageStats.dailyTokens >= DAILY_TOKEN_LIMIT * 0.8) {
      logger.warn(
        {
          dailyTokens: this.usageStats.dailyTokens,
          dailyLimit: DAILY_TOKEN_LIMIT,
          percentage: Math.round(
            (this.usageStats.dailyTokens / DAILY_TOKEN_LIMIT) * 100,
          ),
        },
        "DashScopeReranker: Daily token usage at 80%+",
      );
    }
  }

  /**
   * 检查是否可以发起请求
   */
  private canMakeRequest(): boolean {
    this.resetDailyStatsIfNeeded();
    return this.usageStats.dailyTokens < DAILY_TOKEN_LIMIT;
  }

  /**
   * 跨天重置统计
   */
  private resetDailyStatsIfNeeded(): void {
    const today = new Date().toISOString().split("T")[0];
    if (this.usageStats.lastResetDate !== today) {
      this.usageStats = {
        dailyTokens: 0,
        dailyRequests: 0,
        lastResetDate: today,
      };
      logger.info("DashScopeReranker: Daily stats reset");
    }
  }

  /**
   * 获取使用量统计
   */
  getUsageStats(): RerankUsageStats {
    this.resetDailyStatsIfNeeded();
    return { ...this.usageStats };
  }

  /**
   * 获取剩余可用 Token
   */
  getRemainingTokens(): number {
    this.resetDailyStatsIfNeeded();
    return Math.max(0, DAILY_TOKEN_LIMIT - this.usageStats.dailyTokens);
  }
}

// 单例实例
let rerankerInstance: DashScopeReranker | null = null;

/**
 * 获取 DashScopeReranker 单例
 */
export function getDashScopeReranker(): DashScopeReranker {
  if (!rerankerInstance) {
    rerankerInstance = new DashScopeReranker();
  }
  return rerankerInstance;
}
