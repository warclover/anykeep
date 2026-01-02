/**
 * Material Scorer - 素材健康度评分类型
 * @module knowledge-studio/material
 */

import type { RecoverableError } from "../types";

/**
 * 评分维度
 */
export interface ScoreDimensions {
  /** 新鲜度（0-100）- 基于收藏时间和内容更新时间 */
  freshness: number;

  /** 相关度（0-100）- 与其他素材的语义相关性 */
  relevance: number;

  /** 深度（0-100）- 内容的深度和丰富程度 */
  depth: number;

  /** 可信度（0-100）- 来源的权威性 */
  credibility: number;
}

/**
 * 素材评分结果
 */
export interface MaterialScoreResult {
  bookmarkId: string;
  overallScore: number;
  dimensions: ScoreDimensions;
  recommendations: string[];
  analyzedAt: Date;
}

/**
 * 素材分析请求
 */
export interface MaterialAnalysisRequest {
  bookmarkIds: string[];
  userId: string;
  targetBlueprintType?: string;
}

/**
 * 素材分析响应
 */
export interface MaterialAnalysisResponse {
  success: boolean;
  scores?: MaterialScoreResult[];
  overallRecommendation?: string;
  error?: RecoverableError;
}

/**
 * 素材质量等级
 */
export type MaterialQuality = "excellent" | "good" | "fair" | "poor";

/**
 * 质量等级阈值
 */
export const QUALITY_THRESHOLDS: Record<MaterialQuality, number> = {
  excellent: 80,
  good: 60,
  fair: 40,
  poor: 0,
};

/**
 * 维度权重
 */
export const DIMENSION_WEIGHTS: Record<keyof ScoreDimensions, number> = {
  freshness: 0.2,
  relevance: 0.35,
  depth: 0.3,
  credibility: 0.15,
};

/**
 * 获取质量等级
 */
export function getQualityLevel(score: number): MaterialQuality {
  if (score >= QUALITY_THRESHOLDS.excellent) return "excellent";
  if (score >= QUALITY_THRESHOLDS.good) return "good";
  if (score >= QUALITY_THRESHOLDS.fair) return "fair";
  return "poor";
}

/**
 * 质量等级显示配置
 */
export const QUALITY_DISPLAY: Record<
  MaterialQuality,
  {
    label: string;
    color: string;
    icon: string;
  }
> = {
  excellent: {
    label: "优秀",
    color: "green",
    icon: "🌟",
  },
  good: {
    label: "良好",
    color: "blue",
    icon: "👍",
  },
  fair: {
    label: "一般",
    color: "yellow",
    icon: "📝",
  },
  poor: {
    label: "待改进",
    color: "red",
    icon: "⚠️",
  },
};
