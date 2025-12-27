/**
 * Trust Mode Tools 类型定义
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import type { TrustMode } from "@/types/trust-mode";

// ============================================
// get-trust-mode 类型
// ============================================

/**
 * 信任模式行为摘要
 */
export interface TrustModeBehavior {
  /** 是否启用自动分类 */
  autoClassify: boolean;
  /** 是否需要确认 */
  requiresConfirmation: boolean;
  /** 低置信度处理策略 */
  lowConfidenceAction: string;
  /** 确认阈值（仅 semi_auto 有值） */
  confirmationThreshold?: number;
}

/**
 * 信任模式统计信息
 */
export interface TrustModeStats {
  /** 自动决策次数 */
  autoDecisions: number;
  /** 用户纠正次数 */
  userCorrections: number;
  /** 纠正率 (0-1) */
  correctionRate: number;
  /** 待确认数量 */
  pendingConfirmations: number;
}

/**
 * get_trust_mode 返回结果
 */
export interface GetTrustModeResult {
  /** 当前模式 */
  mode: TrustMode;
  /** 模式标签（中文） */
  label: string;
  /** 模式描述 */
  description: string;
  /** 核心行为配置 */
  behavior: TrustModeBehavior;
  /** 使用统计（可选） */
  stats?: TrustModeStats;
  /** 响应消息 */
  message: string;
}

// ============================================
// recommend-trust-mode 类型
// ============================================

/**
 * 推荐影响因素
 */
export interface RecommendationFactor {
  /** 因素名称 */
  name: string;
  /** 因素值 */
  value: number | string;
  /** 影响方向 */
  impact: "positive" | "negative" | "neutral";
  /** 权重 (0-1) */
  weight: number;
  /** 因素描述 */
  description: string;
}

/**
 * 推荐理由
 */
export interface RecommendationReasoning {
  /** 主要理由 */
  primary: string;
  /** 决策因素 */
  factors: RecommendationFactor[];
}

/**
 * 推荐结果
 */
export interface RecommendationResult {
  /** 推荐模式 */
  mode: TrustMode;
  /** 模式标签 */
  label: string;
  /** 推荐置信度 (0-100) */
  confidence: number;
  /** 是否建议切换 */
  isChange: boolean;
}

/**
 * 推荐指标
 */
export interface RecommendationMetrics {
  /** 纠正率 (%) */
  correctionRate: number;
  /** 自动决策次数 */
  autoDecisions: number;
  /** 用户纠正次数 */
  userCorrections: number;
  /** 待确认数量 */
  pendingConfirmations: number;
  /** 最近切换距今天数 */
  daysSinceLastChange?: number;
  /** 数据样本是否充足 */
  hasSufficientData: boolean;
}

/**
 * recommend_trust_mode 返回结果
 */
export interface RecommendTrustModeResult {
  /** 当前状态 */
  current: {
    mode: TrustMode;
    label: string;
  };
  /** 推荐结果 */
  recommendation: RecommendationResult;
  /** 推荐理由 */
  reasoning: RecommendationReasoning;
  /** 使用指标 */
  metrics: RecommendationMetrics;
  /** 响应消息 */
  message: string;
}

// ============================================
// 常量配置
// ============================================

/**
 * 模式显示配置
 */
export const TRUST_MODE_DISPLAY: Record<
  TrustMode,
  { label: string; description: string }
> = {
  full_auto: {
    label: "完全托管",
    description: "AI 全权负责分类和整理，无需您的干预",
  },
  semi_auto: {
    label: "半托管",
    description: "AI 处理大部分工作，不确定时会询问您的意见",
  },
  manual: {
    label: "不托管",
    description: "您完全掌控，AI 仅在您请求时提供辅助",
  },
};

/**
 * 推荐算法阈值配置
 */
export const RECOMMENDATION_THRESHOLDS = {
  /** 高纠正率阈值：建议降低自动化 (%) */
  HIGH_CORRECTION_RATE: 30,

  /** 低纠正率阈值：建议提升自动化 (%) */
  LOW_CORRECTION_RATE: 5,

  /** 最小样本数：需要足够决策样本才给出建议 */
  MIN_DECISION_SAMPLES: 20,

  /** 待确认积压阈值 */
  PENDING_CONFIRMATION_THRESHOLD: 20,

  /** 模式稳定期（天）：切换后多久才考虑再次推荐 */
  MODE_STABILITY_DAYS: 7,

  /** 推荐置信度阈值：高于此值才建议切换 */
  RECOMMEND_CONFIDENCE_THRESHOLD: 70,
} as const;
