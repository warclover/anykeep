/**
 * AI Recommender Strategy
 * Uses AI to recommend folder classification with enhanced context
 */

import type { IMatcher, MatcherOptions } from "./interfaces";
import type {
  MatchResult,
  MatcherContext,
  AIRecommendationContext,
  AIRecommendation,
  VectorMatchDetail,
  HistoryMatchDetail,
} from "../types";
import { CLASSIFICATION_WEIGHTS, AI_SERVICE_CONFIG } from "../constants";
import type { FolderProfileRepository } from "../repositories";
import { logger } from "@/lib/logger";
import {
  resilientFetch,
  FetchError,
  type ResilientFetchOptions,
} from "@/lib/utils/resilient-fetch";

// AI API configuration
const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";
const AI_MODEL = "deepseek-chat";

/**
 * V4.2.5: AI API 请求配置
 * 使用 resilientFetch 提供自动重试和指数退避
 * 配置值来自集中管理的 AI_SERVICE_CONFIG
 */
const AI_FETCH_CONFIG: Partial<ResilientFetchOptions> = {
  timeout: AI_SERVICE_CONFIG.DEEPSEEK_TIMEOUT_MS,
  maxRetries: AI_SERVICE_CONFIG.MAX_RETRIES,
  retryDelay: AI_SERVICE_CONFIG.RETRY_DELAY_MS,
  retryMultiplier: AI_SERVICE_CONFIG.RETRY_MULTIPLIER,
  maxRetryDelay: AI_SERVICE_CONFIG.MAX_RETRY_DELAY_MS,
  fallbackToCache: false, // AI 响应不使用缓存降级
};

/**
 * AI-based folder recommendation strategy
 * Provides rich context to AI for better classification decisions
 */
export class AIRecommender implements IMatcher {
  readonly name = "ai";
  readonly weight: number;

  private folderProfileRepo: FolderProfileRepository;

  constructor(
    folderProfileRepo: FolderProfileRepository,
    options?: MatcherOptions,
  ) {
    this.folderProfileRepo = folderProfileRepo;
    this.weight = options?.weight ?? CLASSIFICATION_WEIGHTS.AI;
  }

  /**
   * Get AI recommendation for bookmark classification
   */
  async match(context: MatcherContext): Promise<MatchResult[]> {
    const apiKey = process.env.DEEPSEEK_API_KEY;

    if (!apiKey) {
      logger.warn(
        { action: "ai_recommender_no_api_key" },
        "AI Recommender: No API key configured",
      );
      return [];
    }

    try {
      // Build AI context from previous matcher results
      const aiContext = await this.buildAIContext(context);

      if (
        aiContext.vectorMatches.length === 0 &&
        aiContext.historyMatches.length === 0
      ) {
        // No candidates to recommend from
        return [];
      }

      const prompt = this.buildEnhancedPrompt(aiContext);
      const recommendation = await this.callAI(prompt, apiKey);

      if (!recommendation || recommendation.folderId === null) {
        return [];
      }

      return [
        {
          folderId: recommendation.folderId,
          folderName: recommendation.folderName,
          score: recommendation.confidence,
          confidence: recommendation.confidence,
          reason: recommendation.reason,
          metadata: {
            aiSuggestNew: recommendation.suggestNew,
          },
        },
      ];
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : "Unknown error",
          action: "ai_recommender_failed",
        },
        "AI Recommender: Failed",
      );
      return [];
    }
  }

  /**
   * Check if AI recommendation is available
   */
  async isAvailable(_context: MatcherContext): Promise<boolean> {
    return process.env.DEEPSEEK_API_KEY != null;
  }

  /**
   * Set context from other matchers (called by service layer)
   */
  setMatcherResults(
    vectorResults: VectorMatchDetail[],
    historyResults: HistoryMatchDetail[],
  ): void {
    this._cachedVectorResults = vectorResults;
    this._cachedHistoryResults = historyResults;
  }

  private _cachedVectorResults: VectorMatchDetail[] = [];
  private _cachedHistoryResults: HistoryMatchDetail[] = [];

  /**
   * Build AI context from matcher results
   */
  private async buildAIContext(
    context: MatcherContext,
  ): Promise<AIRecommendationContext> {
    // Get all user folders for reference
    const folderProfiles = await this.folderProfileRepo.findByUserId(
      context.userId,
    );
    const allFolders = folderProfiles.map((fp) => ({
      id: fp.folderId,
      name: fp.folderName || "",
    }));

    return {
      title: context.title,
      summary: context.summary,
      tags: context.tags,
      vectorMatches: this._cachedVectorResults,
      historyMatches: this._cachedHistoryResults,
      allFolders,
    };
  }

  /**
   * Build enhanced prompt with rich context
   */
  private buildEnhancedPrompt(context: AIRecommendationContext): string {
    let candidateFolders = "";

    // Add vector match context
    if (context.vectorMatches.length > 0) {
      candidateFolders += "\n【内容相似度最高的文件夹】\n";
      for (const match of context.vectorMatches.slice(0, 3)) {
        candidateFolders += `- "${match.folderName}" (相似度: ${match.score}%)\n`;
        candidateFolders += `  已有 ${match.bookmarkCount} 个书签\n`;
        candidateFolders += `  高频标签: ${match.topTags.slice(0, 5).join(", ") || "无"}\n`;
        candidateFolders += `  示例内容: ${match.sampleTitles.slice(0, 2).join("; ") || "无"}\n`;
      }
    }

    // Add history match context
    if (context.historyMatches.length > 0) {
      candidateFolders += "\n【用户历史偏好（相似书签的去向）】\n";
      for (const match of context.historyMatches.slice(0, 3)) {
        candidateFolders += `- "${match.folderName}": ${match.similarBookmarkCount} 个相似书签\n`;
        candidateFolders += `  相似书签: ${match.similarTitles.slice(0, 2).join("; ")}\n`;
      }
    }

    // Add other available folders
    if (context.allFolders.length > 0) {
      const otherFolders = context.allFolders
        .filter((f) => {
          const inVector = context.vectorMatches.some(
            (v) => v.folderId === f.id,
          );
          const inHistory = context.historyMatches.some(
            (h) => h.folderId === f.id,
          );
          return !inVector && !inHistory;
        })
        .slice(0, 5);

      if (otherFolders.length > 0) {
        candidateFolders += "\n【其他可用文件夹】\n";
        candidateFolders += otherFolders.map((f) => `- "${f.name}"`).join("\n");
        candidateFolders += "\n";
      }
    }

    return `请为以下书签选择最合适的文件夹。

【书签信息】
标题：${context.title}
摘要：${context.summary || "无"}
标签：${context.tags.join(", ") || "无"}
${candidateFolders}

【决策要求】
1. 优先考虑"内容相似度最高"的文件夹
2. 参考"用户历史偏好"了解用户的分类习惯
3. 只有完全不匹配时，才建议新建文件夹

【返回格式】(JSON)
{
  "folderId": 123,
  "folderName": "文件夹名",
  "confidence": 85,
  "reason": "选择理由（简短）"
}

只返回 JSON，不要其他内容。`;
  }

  /**
   * Call AI API
   *
   * V4.2.5: 使用 resilientFetch 提供自动重试和错误恢复
   */
  private async callAI(
    prompt: string,
    apiKey: string,
  ): Promise<AIRecommendation | null> {
    try {
      // 使用 resilientFetch 进行带重试的请求
      const result = await resilientFetch<{
        choices?: Array<{ message?: { content?: string } }>;
      }>(`${DEEPSEEK_BASE_URL}/chat/completions`, {
        ...AI_FETCH_CONFIG,
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [
            {
              role: "system",
              content:
                "你是一个书签分类助手。请根据提供的上下文，为书签选择最合适的文件夹。只返回 JSON 格式的结果。",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: AI_SERVICE_CONFIG.TEMPERATURE,
          max_tokens: AI_SERVICE_CONFIG.MAX_TOKENS,
        }),
        // 重试时记录日志
        onRetry: (attempt, error) => {
          logger.warn(
            {
              attempt,
              errorType: error.type,
              errorMessage: error.message,
              action: "ai_recommender_retry",
            },
            `AI Recommender: Retrying (attempt ${attempt})`,
          );
        },
      });

      // 如果有重试，记录成功信息
      if (result.retryCount > 0) {
        logger.info(
          {
            retryCount: result.retryCount,
            duration: result.duration,
            action: "ai_recommender_recovered",
          },
          "AI Recommender: Recovered after retries",
        );
      }

      const content = result.data.choices?.[0]?.message?.content;

      if (!content) {
        return null;
      }

      // Parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.warn(
          { content, action: "ai_recommender_parse_failed" },
          "AI Recommender: Failed to parse JSON",
        );
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        folderId: parsed.folderId,
        folderName: parsed.folderName || "",
        confidence: parsed.confidence || 50,
        reason: parsed.reason || "AI recommendation",
        suggestNew: parsed.suggestNew || false,
      };
    } catch (error) {
      // V4.2.5: 增强的错误处理 - 区分错误类型
      if (error instanceof FetchError) {
        logger.error(
          {
            errorType: error.type,
            status: error.status,
            retryCount: error.retryCount,
            isRetryable: error.isRetryable,
            action: "ai_recommender_fetch_error",
          },
          `AI Recommender: ${error.type} error after ${error.retryCount} retries`,
        );
      } else if (error instanceof Error) {
        if (error.name === "TimeoutError" || error.name === "AbortError") {
          logger.warn(
            { action: "ai_recommender_timeout" },
            "AI Recommender: Timeout",
          );
        } else {
          logger.error(
            { error: error.message, action: "ai_recommender_error" },
            "AI Recommender: API error",
          );
        }
      }
      return null;
    }
  }
}
