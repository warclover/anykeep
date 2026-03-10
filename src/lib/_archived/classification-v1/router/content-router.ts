/**
 * Content Router
 * V4.2 快慢路径路由器
 *
 * @description 根据内容特征决定使用快速路径还是慢速路径
 * - 快速路径：来源匹配、标题相似度、精确标签匹配
 * - 慢速路径：向量匹配、AI 推荐
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { sourceProfileService } from "@/lib/source-profile/source-profile.service";
import { logger } from "@/lib/logger";
import {
  FAST_PATH_THRESHOLDS,
  CONTENT_ROUTER_CONFIG,
  CONFIDENCE_THRESHOLDS,
} from "@/lib/trust-mode/config";
import { tagMatcher, type TagMatchResult } from "./tag-matcher";
import { titleMatcher, type TitleMatchResult } from "./title-matcher";
import type { SourceMatchResult } from "@/types/source-profile";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 路由路径类型
 */
export type RoutePath = "fast" | "slow" | "hybrid";

/**
 * 路由输入
 */
export interface RouteInput {
  userId: string;
  url: string;
  title: string;
  content?: string;
  tags?: string[];
  /** 已知来源名称（可选） */
  sourceName?: string;
}

/**
 * 路由决策
 */
export interface RouteDecision {
  /** 选择的路径 */
  path: RoutePath;
  /** 决策置信度 */
  confidence: number;
  /** 决策理由 */
  reason: string;
  /** 快速路径结果（如果走快速路径） */
  fastPathResult?: FastPathResult;
  /** 是否需要慢速路径验证 */
  needsSlowPathValidation: boolean;
  /** 预估处理时间（毫秒） */
  estimatedTimeMs: number;
}

/**
 * 快速路径结果
 */
export interface FastPathResult {
  /** 匹配类型 */
  matchType: "source" | "title" | "tag" | "none";
  /** 建议的文件夹 ID */
  suggestedFolderId: number | null;
  /** 置信度 */
  confidence: number;
  /** 匹配详情 */
  matchDetails: string;
  /** 来源匹配结果 */
  sourceMatch?: SourceMatchResult;
  /** 标签匹配结果 */
  tagMatch?: TagMatchResult;
  /** 标题匹配结果 */
  titleMatch?: TitleMatchResult;
}

/**
 * 内容复杂度分析
 */
export interface ContentComplexity {
  /** 估算 token 数 */
  estimatedTokens: number;
  /** 是否为复杂内容 */
  isComplex: boolean;
  /** 复杂度分数 (0-100) */
  complexityScore: number;
}

// ============================================================================
// 内容路由器
// ============================================================================

/**
 * 内容路由器
 * @description 决定内容应该走快速路径还是慢速路径
 */
export class ContentRouter {
  /**
   * 路由决策
   */
  async route(input: RouteInput): Promise<RouteDecision> {
    const { userId: _userId, url: _url, title, content, tags: _tags } = input;

    // 1. 尝试快速路径
    const fastPathResult = await this.tryFastPath(input);

    // 2. 分析内容复杂度
    const complexity = this.analyzeComplexity(title, content);

    // 3. 决策逻辑
    if (fastPathResult.matchType !== "none") {
      // 快速路径命中
      if (fastPathResult.confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
        // 高置信度：直接使用快速路径结果
        return {
          path: "fast",
          confidence: fastPathResult.confidence,
          reason: `Fast path hit: ${fastPathResult.matchDetails}`,
          fastPathResult,
          needsSlowPathValidation: false,
          estimatedTimeMs: CONTENT_ROUTER_CONFIG.FAST_PATH_TIMEOUT_MS,
        };
      }

      if (fastPathResult.confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) {
        // 中等置信度：使用混合路径（快速结果 + 慢速验证）
        return {
          path: "hybrid",
          confidence: fastPathResult.confidence,
          reason: `Hybrid path: ${fastPathResult.matchDetails} (needs validation)`,
          fastPathResult,
          needsSlowPathValidation: true,
          estimatedTimeMs:
            CONTENT_ROUTER_CONFIG.FAST_PATH_TIMEOUT_MS +
            CONTENT_ROUTER_CONFIG.SLOW_PATH_TIMEOUT_MS * 0.5,
        };
      }
    }

    // 4. 低置信度或无快速匹配：走慢速路径
    return {
      path: "slow",
      confidence: fastPathResult.confidence,
      reason: complexity.isComplex
        ? "Complex content requires deep analysis"
        : "No confident fast path match",
      fastPathResult:
        fastPathResult.matchType !== "none" ? fastPathResult : undefined,
      needsSlowPathValidation: false,
      estimatedTimeMs: CONTENT_ROUTER_CONFIG.SLOW_PATH_TIMEOUT_MS,
    };
  }

  /**
   * 尝试快速路径
   */
  async tryFastPath(input: RouteInput): Promise<FastPathResult> {
    const { userId, url, title, tags, sourceName } = input;

    // 1. 来源匹配（最强信号）
    const sourceMatch = await this.trySourceMatch(userId, url, sourceName);
    if (
      sourceMatch.found &&
      sourceMatch.suggestedFolderId &&
      sourceMatch.confidence &&
      sourceMatch.confidence >= FAST_PATH_THRESHOLDS.MIN_SOURCE_CONFIDENCE
    ) {
      return {
        matchType: "source",
        suggestedFolderId: sourceMatch.suggestedFolderId,
        confidence: sourceMatch.confidence,
        matchDetails: sourceMatch.reason || "Source match",
        sourceMatch,
      };
    }

    // 2. 标签精确匹配
    if (tags && tags.length > 0) {
      const tagMatch = await tagMatcher.tryTagMatch(userId, tags);
      if (
        tagMatch.found &&
        tagMatch.suggestedFolderId &&
        tagMatch.confidence >= FAST_PATH_THRESHOLDS.MIN_TAG_MATCH_SCORE
      ) {
        return {
          matchType: "tag",
          suggestedFolderId: tagMatch.suggestedFolderId,
          confidence: tagMatch.confidence,
          matchDetails: tagMatch.reason,
          tagMatch,
          sourceMatch: sourceMatch.found ? sourceMatch : undefined,
        };
      }
    }

    // 3. 标题相似度匹配
    if (title && title.length >= 3) {
      const titleMatch = await titleMatcher.tryTitleMatch(userId, title);
      if (
        titleMatch.found &&
        titleMatch.suggestedFolderId &&
        titleMatch.confidence >= FAST_PATH_THRESHOLDS.MIN_TITLE_MATCH_SCORE
      ) {
        return {
          matchType: "title",
          suggestedFolderId: titleMatch.suggestedFolderId,
          confidence: titleMatch.confidence,
          matchDetails: titleMatch.reason,
          titleMatch,
          sourceMatch: sourceMatch.found ? sourceMatch : undefined,
        };
      }
    }

    // 无匹配
    return {
      matchType: "none",
      suggestedFolderId: null,
      confidence: sourceMatch.found ? sourceMatch.confidence || 30 : 0,
      matchDetails: "No fast path match",
      sourceMatch: sourceMatch.found ? sourceMatch : undefined,
    };
  }

  /**
   * 尝试来源匹配
   */
  private async trySourceMatch(
    userId: string,
    url: string,
    sourceName?: string,
  ): Promise<SourceMatchResult> {
    try {
      // 先尝试获取或创建来源画像
      await sourceProfileService.getOrCreateFromUrl(userId, url, sourceName);

      // 获取快速匹配结果
      return await sourceProfileService.getQuickMatch(userId, url);
    } catch (error) {
      logger.error({ error, url }, "Source match error");
      return { found: false };
    }
  }

  /**
   * 分析内容复杂度
   */
  analyzeComplexity(title: string, content?: string): ContentComplexity {
    // 估算 token 数（粗略：中文约 1.5 字符/token，英文约 4 字符/token）
    const text = `${title} ${content || ""}`;
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    const estimatedTokens = Math.ceil(chineseChars / 1.5 + otherChars / 4);

    // 复杂度因素
    const factors = {
      length: estimatedTokens > 500 ? 20 : estimatedTokens > 200 ? 10 : 0,
      hasCode: /```|<code|function\s|class\s|const\s|let\s|var\s/.test(text)
        ? 15
        : 0,
      hasTable: /\|.*\|.*\||\t.*\t/.test(text) ? 10 : 0,
      hasMath: /\$.*\$|\\[|\\]/.test(text) ? 15 : 0,
      multiTopic: (text.match(/[。！？\.\!\?]/g) || []).length > 10 ? 10 : 0,
    };

    const complexityScore = Math.min(
      100,
      factors.length +
        factors.hasCode +
        factors.hasTable +
        factors.hasMath +
        factors.multiTopic,
    );

    return {
      estimatedTokens,
      isComplex:
        estimatedTokens > CONTENT_ROUTER_CONFIG.COMPLEXITY_THRESHOLD ||
        complexityScore > 40,
      complexityScore,
    };
  }

  /**
   * 批量路由
   */
  async batchRoute(inputs: RouteInput[]): Promise<Map<string, RouteDecision>> {
    const results = new Map<string, RouteDecision>();

    // 批量获取来源匹配
    const urls = inputs.map((i) => i.url);
    const sourceMatches = await sourceProfileService.getBatchQuickMatches(
      inputs[0]?.userId || "",
      urls,
    );

    // 为每个输入生成路由决策
    for (const input of inputs) {
      const sourceMatch = sourceMatches.get(input.url);
      const complexity = this.analyzeComplexity(input.title, input.content);

      let decision: RouteDecision;

      if (
        sourceMatch?.found &&
        sourceMatch.suggestedFolderId &&
        sourceMatch.confidence &&
        sourceMatch.confidence >= FAST_PATH_THRESHOLDS.MIN_SOURCE_CONFIDENCE
      ) {
        // 快速路径
        const fastPathResult: FastPathResult = {
          matchType: "source",
          suggestedFolderId: sourceMatch.suggestedFolderId,
          confidence: sourceMatch.confidence,
          matchDetails: sourceMatch.reason || "Source match",
          sourceMatch,
        };

        if (sourceMatch.confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
          decision = {
            path: "fast",
            confidence: sourceMatch.confidence,
            reason: `Fast path: ${sourceMatch.reason}`,
            fastPathResult,
            needsSlowPathValidation: false,
            estimatedTimeMs: CONTENT_ROUTER_CONFIG.FAST_PATH_TIMEOUT_MS,
          };
        } else {
          decision = {
            path: "hybrid",
            confidence: sourceMatch.confidence,
            reason: `Hybrid: ${sourceMatch.reason}`,
            fastPathResult,
            needsSlowPathValidation: true,
            estimatedTimeMs: CONTENT_ROUTER_CONFIG.FAST_PATH_TIMEOUT_MS * 2,
          };
        }
      } else {
        // 慢速路径
        decision = {
          path: "slow",
          confidence: sourceMatch?.confidence || 0,
          reason: complexity.isComplex
            ? "Complex content"
            : "No fast path match",
          needsSlowPathValidation: false,
          estimatedTimeMs: CONTENT_ROUTER_CONFIG.SLOW_PATH_TIMEOUT_MS,
        };
      }

      results.set(input.url, decision);
    }

    return results;
  }
}

// ============================================================================
// 单例导出
// ============================================================================

/**
 * 内容路由器单例
 */
export const contentRouter = new ContentRouter();

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 判断是否应该走快速路径
 */
export function shouldUseFastPath(decision: RouteDecision): boolean {
  return decision.path === "fast" || decision.path === "hybrid";
}

/**
 * 判断是否需要慢速路径
 */
export function shouldUseSlowPath(decision: RouteDecision): boolean {
  return decision.path === "slow" || decision.needsSlowPathValidation;
}

/**
 * 获取路径显示名称
 */
export function getPathDisplayName(path: RoutePath): string {
  switch (path) {
    case "fast":
      return "快速路径";
    case "slow":
      return "慢速路径";
    case "hybrid":
      return "混合路径";
    default:
      return "未知路径";
  }
}
