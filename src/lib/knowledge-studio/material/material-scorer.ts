/**
 * Material Scorer - 素材健康度评分器
 * @module knowledge-studio/material
 * @description 评估素材质量，为蓝图生成提供优化建议
 */

import { createLogger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/client";
import { ERROR_CODES } from "../types";
import type {
  ScoreDimensions,
  MaterialScoreResult,
  MaterialAnalysisRequest,
  MaterialAnalysisResponse,
} from "./types";
import { DIMENSION_WEIGHTS, getQualityLevel, QUALITY_DISPLAY } from "./types";

const logger = createLogger("material-scorer");

/**
 * MaterialScorer - 素材健康度评分器
 *
 * 职责：
 * 1. 评估素材新鲜度
 * 2. 计算素材相关度
 * 3. 分析内容深度
 * 4. 评估来源可信度
 * 5. 生成优化建议
 */
export class MaterialScorer {
  /**
   * 分析素材（主入口）
   */
  async analyze(
    request: MaterialAnalysisRequest,
  ): Promise<MaterialAnalysisResponse> {
    logger.info(
      {
        userId: request.userId,
        bookmarkCount: request.bookmarkIds.length,
        targetBlueprint: request.targetBlueprintType,
      },
      "Starting material analysis",
    );

    try {
      // 1. 获取书签数据
      const bookmarks = await this.fetchBookmarks(
        request.bookmarkIds,
        request.userId,
      );

      if (bookmarks.length === 0) {
        return {
          success: false,
          error: {
            code: ERROR_CODES.INVALID_BOOKMARK_IDS,
            message: "未找到有效的书签",
            recoverable: false,
          },
        };
      }

      // 2. 对每个书签评分
      const scores: MaterialScoreResult[] = await Promise.all(
        bookmarks.map((bookmark) => this.scoreBookmark(bookmark)),
      );

      // 3. 生成整体建议
      const overallRecommendation = this.generateOverallRecommendation(scores);

      logger.info(
        {
          userId: request.userId,
          scoresCount: scores.length,
          averageScore:
            scores.reduce((sum, s) => sum + s.overallScore, 0) / scores.length,
        },
        "Material analysis completed",
      );

      return {
        success: true,
        scores,
        overallRecommendation,
      };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Material analysis failed",
      );

      return {
        success: false,
        error: {
          code: ERROR_CODES.GENERATION_FAILED,
          message: "素材分析失败",
          recoverable: true,
          retryAfterMs: 1000,
        },
      };
    }
  }

  /**
   * 获取书签数据
   */
  private async fetchBookmarks(
    bookmarkIds: string[],
    userId: string,
  ): Promise<BookmarkData[]> {
    const supabase = createClient();

    // Note: bookmarks.id is number type, need to convert
    const numericIds = bookmarkIds
      .map((id) => parseInt(id, 10))
      .filter((id) => !isNaN(id));

    const { data, error } = await supabase
      .from("bookmarks")
      .select("id, title, url, ai_summary, platform, created_at, updated_at")
      .eq("user_id", userId)
      .in("id", numericIds);

    if (error) {
      logger.error({ error }, "Failed to fetch bookmarks");
      throw error;
    }

    return (data || []) as BookmarkData[];
  }

  /**
   * 对单个书签评分
   */
  private async scoreBookmark(
    bookmark: BookmarkData,
  ): Promise<MaterialScoreResult> {
    const dimensions = await this.calculateDimensions(bookmark);
    const overallScore = this.calculateOverallScore(dimensions);
    const recommendations = this.generateRecommendations(bookmark, dimensions);

    return {
      bookmarkId: String(bookmark.id),
      overallScore,
      dimensions,
      recommendations,
      analyzedAt: new Date(),
    };
  }

  /**
   * 计算各维度分数
   */
  private async calculateDimensions(
    bookmark: BookmarkData,
  ): Promise<ScoreDimensions> {
    return {
      freshness: this.calculateFreshness(bookmark),
      relevance: await this.calculateRelevance(bookmark),
      depth: this.calculateDepth(bookmark),
      credibility: this.calculateCredibility(bookmark),
    };
  }

  /**
   * 计算新鲜度分数
   */
  private calculateFreshness(bookmark: BookmarkData): number {
    const now = new Date();
    const createdAt = new Date(bookmark.created_at);
    const daysSinceCreated =
      (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

    // 7天内 100分，30天 80分，90天 60分，超过180天 40分
    if (daysSinceCreated <= 7) return 100;
    if (daysSinceCreated <= 30) return 80;
    if (daysSinceCreated <= 90) return 60;
    if (daysSinceCreated <= 180) return 40;
    return 20;
  }

  /**
   * 计算相关度分数
   */
  private async calculateRelevance(bookmark: BookmarkData): Promise<number> {
    // TODO(@backlog): 使用向量相似度计算与其他素材的相关性
    // 临时基于摘要长度来评分
    let score = 50;

    if (bookmark.ai_summary && bookmark.ai_summary.length > 50) {
      score += 25;
    }

    if (bookmark.ai_summary && bookmark.ai_summary.length > 200) {
      score += 25;
    }

    return Math.min(100, score);
  }

  /**
   * 计算深度分数
   */
  private calculateDepth(bookmark: BookmarkData): number {
    // 基于摘要长度评分（无 content 字段）
    const summary = bookmark.ai_summary || "";
    const wordCount = this.countWords(summary);

    // 基于摘要长度评分
    if (wordCount >= 500) return 100;
    if (wordCount >= 300) return 80;
    if (wordCount >= 150) return 60;
    if (wordCount >= 50) return 40;
    return 20;
  }

  /**
   * 计算可信度分数
   */
  private calculateCredibility(bookmark: BookmarkData): number {
    // 基于平台评分
    const platformScores: Record<string, number> = {
      "github.com": 90,
      "stackoverflow.com": 85,
      "medium.com": 70,
      "zhihu.com": 75,
      "weixin.qq.com": 65,
      "juejin.cn": 70,
      "bilibili.com": 60,
      "xiaohongshu.com": 50,
    };

    try {
      const url = new URL(bookmark.url);
      const domain = url.hostname.replace("www.", "");

      for (const [key, score] of Object.entries(platformScores)) {
        if (domain.includes(key.replace("www.", ""))) {
          return score;
        }
      }
    } catch {
      // URL 解析失败
    }

    return 50; // 默认分数
  }

  /**
   * 计算总分
   */
  private calculateOverallScore(dimensions: ScoreDimensions): number {
    let score = 0;

    for (const [key, weight] of Object.entries(DIMENSION_WEIGHTS)) {
      score += dimensions[key as keyof ScoreDimensions] * weight;
    }

    return Math.round(score);
  }

  /**
   * 生成单个素材的建议
   */
  private generateRecommendations(
    bookmark: BookmarkData,
    dimensions: ScoreDimensions,
  ): string[] {
    const recommendations: string[] = [];

    if (dimensions.freshness < 60) {
      recommendations.push("这篇内容有些陈旧，建议查找更新的资料");
    }

    if (dimensions.depth < 60) {
      recommendations.push("内容较为简短，可以补充更深入的分析文章");
    }

    if (dimensions.credibility < 60) {
      recommendations.push("来源可信度一般，建议添加权威来源作为补充");
    }

    if (!bookmark.ai_summary) {
      recommendations.push("缺少摘要，建议先生成 AI 摘要");
    }

    return recommendations;
  }

  /**
   * 生成整体建议
   */
  private generateOverallRecommendation(scores: MaterialScoreResult[]): string {
    const avgScore =
      scores.reduce((sum, s) => sum + s.overallScore, 0) / scores.length;
    const quality = getQualityLevel(avgScore);
    const display = QUALITY_DISPLAY[quality];

    let recommendation = `素材整体质量${display.label}（${Math.round(avgScore)}分）。`;

    // 找出最需要改进的维度
    const avgDimensions = {
      freshness:
        scores.reduce((sum, s) => sum + s.dimensions.freshness, 0) /
        scores.length,
      relevance:
        scores.reduce((sum, s) => sum + s.dimensions.relevance, 0) /
        scores.length,
      depth:
        scores.reduce((sum, s) => sum + s.dimensions.depth, 0) / scores.length,
      credibility:
        scores.reduce((sum, s) => sum + s.dimensions.credibility, 0) /
        scores.length,
    };

    const weakest = Object.entries(avgDimensions).sort(
      ([, a], [, b]) => a - b,
    )[0];

    const dimensionNames: Record<string, string> = {
      freshness: "新鲜度",
      relevance: "相关度",
      depth: "深度",
      credibility: "可信度",
    };

    if (weakest[1] < 60) {
      recommendation += ` 建议重点提升素材的${dimensionNames[weakest[0]]}。`;
    }

    if (scores.length < 3) {
      recommendation += " 素材数量较少，建议添加更多相关内容以丰富生成效果。";
    }

    return recommendation;
  }

  /**
   * 统计词数
   */
  private countWords(text: string): number {
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    return chineseChars + englishWords;
  }
}

/**
 * 书签数据接口
 */
interface BookmarkData {
  id: number;
  title: string;
  url: string;
  ai_summary: string | null;
  platform: string | null;
  created_at: string;
  updated_at: string;
}

// 导出单例
export const materialScorer = new MaterialScorer();
