/**
 * AI 自我进化模块 - 类型定义
 *
 * @module ai-learning
 * @version 1.1.0
 * @since 2025-12-25
 * @updated 2025-12-26 - 统一 IntentType 从 router/types 导入
 */

import type { IntentType } from "@/lib/ai-skills/router/types";

// =============================================================================
// 意图类型 - 从路由层统一导入
// =============================================================================

/**
 * 意图类型（从路由层统一导入，确保单一数据源）
 * @see {@link @/lib/ai-skills/router/types} IntentType
 */
export type { IntentType };

// =============================================================================
// 纠正信号类型
// =============================================================================

/**
 * 纠正信号类型
 */
export type CorrectionSignalType =
  | "explicit_wrong" // 直接否定："不对"、"错了"
  | "correction_follow" // 纠正句式："我要的是...不是..."
  | "reformulation" // 重新表述：换种说法重试
  | "negative_feedback"; // 负面反馈：👎 按钮

/**
 * 纠正信号
 */
export interface CorrectionSignal {
  /** 信号类型 */
  signal: CorrectionSignalType;
  /** 置信度 (0-1) */
  confidence: number;
  /** 原始输入（被误判的） */
  originalInput: string;
  /** 错误的意图 */
  wrongIntent: IntentType;
  /** 纠正输入（用户的纠正话语） */
  correctionInput: string;
  /** 推断的正确意图（可选） */
  inferredCorrectIntent?: IntentType;
}

/**
 * 纠正模式（用于匹配检测）
 */
export interface CorrectionPattern {
  /** 匹配正则 */
  pattern: RegExp;
  /** 信号类型 */
  signal: CorrectionSignalType;
  /** 基础置信度 */
  confidence: number;
}

// =============================================================================
// AI 输出上下文
// =============================================================================

/**
 * AI 输出信息（用于纠正检测）
 */
export interface AIOutput {
  /** 消息 ID */
  messageId: string;
  /** 识别的意图 */
  intent: IntentType;
  /** 是否成功执行 */
  wasSuccessful: boolean;
  /** 响应内容摘要 */
  responseSummary?: string;
  /** 执行的技能 ID */
  skillId?: string;
}

/**
 * 对话状态（用于上下文感知）
 */
export interface ConversationState {
  /** 会话 ID */
  conversationId: string;
  /** 上一条用户输入 */
  lastUserInput?: string;
  /** 上一条 AI 输出 */
  lastAIOutput?: AIOutput;
  /** 连续失败次数 */
  consecutiveFailures: number;
  /** 会话轮次 */
  turnCount: number;
}

// =============================================================================
// 纠正记录
// =============================================================================

/**
 * 纠正记录（数据库存储）
 */
export interface CorrectionRecord {
  /** 记录 ID */
  id: string;
  /** 用户 ID */
  userId: string;
  /** 原始输入 */
  originalInput: string;
  /** 原始输入的嵌入向量 */
  originalInputEmbedding?: number[];
  /** 错误意图 */
  wrongIntent: IntentType;
  /** 正确意图 */
  correctIntent: IntentType;
  /** 纠正信号类型 */
  signal: CorrectionSignalType;
  /** 置信度 */
  confidence: number;
  /** 应用次数 */
  appliedCount: number;
  /** 最后应用时间 */
  lastAppliedAt?: Date;
  /** 创建时间 */
  createdAt: Date;
}

/**
 * 相似纠正匹配结果
 */
export interface SimilarCorrection {
  /** 纠正记录 ID */
  id: string;
  /** 原始输入 */
  originalInput: string;
  /** 正确意图 */
  correctIntent: IntentType;
  /** 相似度分数 (0-1) */
  similarity: number;
}

// =============================================================================
// 学习结果
// =============================================================================

/**
 * 学习应用结果
 */
export interface LearningResult {
  /** 是否应用了学习 */
  applied: boolean;
  /** 来源纠正记录 ID */
  correctionId?: string;
  /** 调整后的意图 */
  adjustedIntent?: IntentType;
  /** 调整置信度 */
  adjustmentConfidence?: number;
  /** 原始分类置信度 */
  originalConfidence?: number;
}

/**
 * 分类请求（含学习上下文）
 */
export interface ClassificationRequest {
  /** 用户输入 */
  input: string;
  /** 用户 ID */
  userId: string;
  /** 会话状态 */
  conversationState?: ConversationState;
  /** 是否启用学习 */
  enableLearning?: boolean;
}

/**
 * 分类响应（含学习信息）
 */
export interface ClassificationResponse {
  /** 最终意图 */
  intent: IntentType;
  /** 置信度 */
  confidence: number;
  /** 学习应用结果 */
  learning?: LearningResult;
  /** 原始分类结果（学习调整前） */
  originalIntent?: IntentType;
}

// =============================================================================
// 服务响应
// =============================================================================

/**
 * 服务操作结果
 */
export interface LearningServiceResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * 纠正检测结果
 */
export interface DetectionResult {
  /** 是否检测到纠正 */
  isCorrection: boolean;
  /** 纠正信号（如果检测到） */
  signal?: CorrectionSignal;
}

/**
 * 学习统计
 */
export interface LearningStats {
  /** 用户 ID */
  userId: string;
  /** 总纠正次数 */
  totalCorrections: number;
  /** 学习应用次数 */
  totalApplications: number;
  /** 按意图统计 */
  byIntent: Record<
    IntentType,
    {
      corrections: number;
      applications: number;
    }
  >;
  /** 最近纠正时间 */
  lastCorrectionAt?: Date;
}
