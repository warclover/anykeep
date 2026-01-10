/**
 * Phase 3: 个性化学习模块 - 类型定义
 *
 * @version 1.0.0
 * @since 2026-01-10
 */

import type { IntentType } from "../router/types";

// ============================================
// 用户反馈类型
// ============================================

/**
 * 用户行为类型
 */
export type UserBehavior = "accepted" | "corrected" | "abandoned";

/**
 * 用户行为动作
 */
export interface UserAction {
  /** 会话 ID */
  sessionId: string;
  /** 轮次 ID */
  turnId: string;
  /** 原始用户输入 */
  originalInput: string;
  /** 动作类型 */
  type:
    | "execute_success"
    | "cancel"
    | "retry_different"
    | "manual_correction"
    | "undo";
  /** 纠正后的意图（如果是手动纠正） */
  correctedIntent?: string;
  /** 动作时间戳 */
  timestamp: Date;
}

/**
 * 意图匹配结果（简化版，用于反馈记录）
 */
export interface IntentMatchForFeedback {
  /** 意图类型 */
  type: IntentType;
  /** 子类型 */
  subType?: string;
  /** 置信度 */
  confidence: number;
}

/**
 * 用户反馈记录
 */
export interface UserFeedback {
  /** 用户 ID */
  userId: string;
  /** 会话 ID */
  sessionId: string;
  /** 轮次 ID */
  turnId: string;
  /** 原始用户输入 */
  originalInput: string;
  /** 预测的意图 */
  predictedIntent: IntentMatchForFeedback;
  /** 实际行为 */
  actualBehavior: UserBehavior;
  /** 纠正后的意图类型 */
  correctedType?: string;
  /** 纠正后的子类型 */
  correctedSubType?: string;
  /** 元数据 */
  metadata?: Record<string, unknown>;
  /** 时间戳 */
  timestamp: Date;
}

/**
 * 显式反馈评分
 */
export type ExplicitRating = "helpful" | "not_helpful";

/**
 * 显式反馈数据
 */
export interface ExplicitFeedback {
  /** 用户 ID */
  userId: string;
  /** 会话 ID */
  sessionId: string;
  /** 轮次 ID */
  turnId: string;
  /** 评分 */
  rating: ExplicitRating;
  /** 评论 */
  comment?: string;
  /** 时间戳 */
  timestamp: Date;
}

// ============================================
// 意图模式发现类型
// ============================================

/**
 * 模式发现方法
 */
export type DiscoveryMethod = "clustering" | "llm" | "manual";

/**
 * 模式状态
 */
export type PatternStatus = "pending" | "approved" | "rejected" | "merged";

/**
 * 建议的新模式
 */
export interface SuggestedPattern {
  /** 意图类型 */
  type: IntentType;
  /** 子类型 */
  subType: string;
  /** 模式（正则表达式字符串） */
  pattern: string;
  /** 权重 */
  weight: number;
  /** 样本输入 */
  sampleInputs: string[];
  /** 发现置信度 */
  discoveryConfidence: number;
  /** 发现方法 */
  discoveryMethod: DiscoveryMethod;
  /** 出现次数 */
  occurrenceCount: number;
}

/**
 * 模式聚类结果
 */
export interface PatternCluster {
  /** 聚类 ID */
  id: string;
  /** 聚类中的输入 */
  inputs: string[];
  /** 聚类大小 */
  size: number;
  /** 代表性输入 */
  representative: string;
  /** 相似度分数 */
  similarityScore: number;
}

// ============================================
// 个性化快捷指令类型
// ============================================

/**
 * 用户快捷指令
 */
export interface UserShortcut {
  /** 快捷指令 ID */
  id?: number;
  /** 用户 ID */
  userId: string;
  /** 快捷短语 */
  shortcutPhrase: string;
  /** 映射的意图类型 */
  intentType: IntentType;
  /** 映射的子类型 */
  intentSubType?: string;
  /** 默认槽位值 */
  defaultSlots: Record<string, unknown>;
  /** 使用次数 */
  usageCount: number;
  /** 最后使用时间 */
  lastUsedAt?: Date;
  /** 是否激活 */
  isActive: boolean;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

/**
 * 快捷指令学习候选
 */
export interface ShortcutCandidate {
  /** 短语 */
  phrase: string;
  /** 意图类型 */
  intentType: IntentType;
  /** 子类型 */
  intentSubType?: string;
  /** 出现频率 */
  frequency: number;
  /** 学习置信度 */
  confidence: number;
  /** 样本上下文 */
  sampleContexts: string[];
}

// ============================================
// 反馈统计类型
// ============================================

/**
 * 用户反馈统计
 */
export interface UserFeedbackStats {
  /** 总反馈数 */
  totalCount: number;
  /** 接受数 */
  acceptedCount: number;
  /** 纠正数 */
  correctedCount: number;
  /** 放弃数 */
  abandonedCount: number;
  /** 接受率 */
  acceptanceRate: number;
  /** 最常纠正的意图类型 */
  topCorrectedTypes: Array<{
    type: string;
    subtype: string | null;
    count: number;
  }>;
}

// ============================================
// 配置类型
// ============================================

/**
 * FeedbackCollector 配置
 */
export interface FeedbackCollectorConfig {
  /** 是否启用隐式反馈收集 */
  enableImplicitFeedback?: boolean;
  /** 是否启用显式反馈收集 */
  enableExplicitFeedback?: boolean;
  /** 反馈批量写入阈值 */
  batchWriteThreshold?: number;
  /** 反馈写入间隔（毫秒） */
  writeIntervalMs?: number;
  /** 是否启用调试模式 */
  debug?: boolean;
}

/**
 * IntentPatternDiscoverer 配置
 */
export interface PatternDiscovererConfig {
  /** 聚类最小样本数 */
  minClusterSize?: number;
  /** 相似度阈值 */
  similarityThreshold?: number;
  /** 最大建议模式数 */
  maxSuggestions?: number;
  /** 是否使用 LLM 辅助发现 */
  useLLMDiscovery?: boolean;
  /** 是否启用调试模式 */
  debug?: boolean;
}

/**
 * ShortcutLearner 配置
 */
export interface ShortcutLearnerConfig {
  /** 学习最小频率阈值 */
  minFrequencyThreshold?: number;
  /** 学习置信度阈值 */
  confidenceThreshold?: number;
  /** 每用户最大快捷指令数 */
  maxShortcutsPerUser?: number;
  /** 是否自动激活学习到的快捷指令 */
  autoActivate?: boolean;
  /** 是否启用调试模式 */
  debug?: boolean;
}
