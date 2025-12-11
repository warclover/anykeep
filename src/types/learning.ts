/**
 * 学习系统类型定义
 * V4.2 负样本学习与持续优化
 *
 * @description 定义从用户行为中学习的数据结构
 * - 负样本学习：从用户纠正中学习"什么不应该在某文件夹"
 * - 正样本学习：从用户确认中强化"什么应该在某文件夹"
 * - 置信度校准：基于历史准确率调整置信度
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

// ============================================================================
// 反馈类型
// ============================================================================

/**
 * 用户反馈类型
 */
export type FeedbackType =
  | "correct" // AI 分类正确，用户确认
  | "incorrect" // AI 分类错误，用户拒绝
  | "manual_move" // 用户手动移动（隐式反馈）
  | "manual_delete" // 用户删除书签（可能表示不感兴趣）
  | "manual_archive"; // 用户归档（可能表示已处理）

/**
 * 学习信号强度
 */
export type SignalStrength =
  | "strong" // 强信号：明确的用户反馈
  | "medium" // 中等信号：手动操作
  | "weak"; // 弱信号：推断行为

// ============================================================================
// 负样本学习
// ============================================================================

/**
 * 负样本记录
 * @description 记录"什么不应该属于某文件夹"
 */
export interface NegativeSample {
  /** 文件夹 ID */
  folderId: number;

  /** 书签 ID（被移出的书签） */
  bookmarkId: number;

  /** 原因 */
  reason: FeedbackType;

  /** 书签的特征快照（用于匹配相似内容） */
  featureSnapshot: {
    /** 标题关键词 */
    titleKeywords?: string[];
    /** 标签 */
    tags?: string[];
    /** 来源 ID */
    sourceId?: string;
    /** 向量 ID（如果有） */
    embeddingId?: string;
  };

  /** 信号强度 */
  signalStrength: SignalStrength;

  /** 创建时间 */
  createdAt: string;
}

/**
 * 文件夹排除规则
 * @description 聚合的负样本形成的排除规则
 */
export interface FolderExclusion {
  /** 文件夹 ID */
  folderId: number;

  /** 排除的标签（出现这些标签的内容不应分到此文件夹） */
  excludedTags: string[];

  /** 排除的来源（这些来源的内容不应分到此文件夹） */
  excludedSources: string[];

  /** 排除的关键词 */
  excludedKeywords: string[];

  /** 样本数量（形成此规则的负样本数） */
  sampleCount: number;

  /** 最后更新时间 */
  lastUpdatedAt: string;
}

/**
 * 文件夹排除规则数据库记录
 */
export interface FolderExclusionRecord {
  id: number;
  user_id: string;
  folder_id: number;

  /** 排除的标签（数组） */
  excluded_tags: string[];

  /** 排除的来源（数组） */
  excluded_sources: string[];

  /** 排除的关键词（数组） */
  excluded_keywords: string[];

  /** 排除的向量 ID（用于语义排除） */
  excluded_embedding_ids: string[];

  /** 样本数量 */
  sample_count: number;

  created_at: string;
  updated_at: string;
}

// ============================================================================
// 学习事件
// ============================================================================

/**
 * 学习事件（用于追踪和分析）
 */
export interface LearningEvent {
  /** 事件 ID */
  id: string;

  /** 用户 ID */
  userId: string;

  /** 事件类型 */
  eventType: FeedbackType;

  /** 关联书签 ID */
  bookmarkId: number;

  /** 原文件夹 ID（移动前） */
  fromFolderId: number | null;

  /** 目标文件夹 ID（移动后） */
  toFolderId: number | null;

  /** AI 原始预测（如果有） */
  aiPrediction?: {
    folderId: number | null;
    confidence: number;
  };

  /** 是否产生了学习效果 */
  learningApplied: boolean;

  /** 学习效果描述 */
  learningEffect?: string;

  /** 时间戳 */
  timestamp: string;
}

/**
 * 学习事件数据库记录
 */
export interface LearningEventRecord {
  id: number;
  user_id: string;
  event_type: FeedbackType;
  bookmark_id: number;
  from_folder_id: number | null;
  to_folder_id: number | null;
  ai_prediction: {
    folder_id: number | null;
    confidence: number;
  } | null;
  learning_applied: boolean;
  learning_effect: string | null;
  created_at: string;
}

// ============================================================================
// 置信度校准
// ============================================================================

/**
 * 文件夹历史准确率
 */
export interface FolderAccuracyStats {
  /** 文件夹 ID */
  folderId: number;

  /** 总分类次数 */
  totalClassifications: number;

  /** 用户确认次数（正确） */
  confirmedCount: number;

  /** 用户纠正次数（错误） */
  correctedCount: number;

  /** 历史准确率 (0-1) */
  accuracyRate: number;

  /** 建议的置信度调整因子 */
  confidenceAdjustment: number;

  /** 最后更新时间 */
  lastUpdatedAt: string;
}

/**
 * 置信度校准参数
 */
export interface ConfidenceCalibration {
  /** 基础置信度 */
  baseConfidence: number;

  /** 历史准确率调整 */
  historyAdjustment: number;

  /** 匹配器一致性调整 */
  matcherAgreementAdjustment: number;

  /** 来源可信度调整 */
  sourceReliabilityAdjustment: number;

  /** 最终校准后的置信度 */
  calibratedConfidence: number;
}

// ============================================================================
// 学习服务输入
// ============================================================================

/**
 * 记录学习事件输入
 */
export interface RecordLearningEventInput {
  userId: string;
  eventType: FeedbackType;
  bookmarkId: number;
  fromFolderId?: number | null;
  toFolderId?: number | null;
  aiPrediction?: {
    folderId: number | null;
    confidence: number;
  };
}

/**
 * 更新排除规则输入
 */
export interface UpdateExclusionInput {
  userId: string;
  folderId: number;
  bookmarkId: number;
  reason: FeedbackType;
  bookmarkTags?: string[];
  bookmarkSource?: string;
  bookmarkKeywords?: string[];
}

// ============================================================================
// 常量与工具函数
// ============================================================================

/**
 * 信号强度权重
 */
export const SIGNAL_STRENGTH_WEIGHTS: Record<SignalStrength, number> = {
  strong: 1.0,
  medium: 0.6,
  weak: 0.3,
};

/**
 * 反馈类型到信号强度的映射
 */
export const FEEDBACK_SIGNAL_MAP: Record<FeedbackType, SignalStrength> = {
  correct: "strong",
  incorrect: "strong",
  manual_move: "medium",
  manual_delete: "weak",
  manual_archive: "weak",
};

/**
 * 最小样本数量阈值（形成排除规则的最小负样本数）
 */
export const MIN_NEGATIVE_SAMPLES_FOR_RULE = 2;

/**
 * 排除规则衰减周期（天）
 * 超过此时间未更新的规则权重降低
 */
export const EXCLUSION_DECAY_DAYS = 30;

/**
 * 置信度校准参数
 */
export const CALIBRATION_PARAMS = {
  /** 历史准确率影响权重 */
  historyWeight: 0.3,
  /** 匹配器一致性影响权重 */
  matcherAgreementWeight: 0.2,
  /** 来源可信度影响权重 */
  sourceReliabilityWeight: 0.2,
  /** 最小校准置信度 */
  minConfidence: 20,
  /** 最大校准置信度 */
  maxConfidence: 95,
};

/**
 * 验证反馈类型
 */
export function isValidFeedbackType(type: unknown): type is FeedbackType {
  return (
    type === "correct" ||
    type === "incorrect" ||
    type === "manual_move" ||
    type === "manual_delete" ||
    type === "manual_archive"
  );
}

/**
 * 获取信号强度
 */
export function getSignalStrength(feedbackType: FeedbackType): SignalStrength {
  return FEEDBACK_SIGNAL_MAP[feedbackType];
}

/**
 * 计算校准后的置信度
 */
export function calculateCalibratedConfidence(params: {
  baseConfidence: number;
  folderAccuracyRate?: number;
  matcherAgreement?: number; // 多个匹配器的一致性 (0-1)
  sourceReliability?: number; // 来源可信度 (0-1)
}): ConfidenceCalibration {
  const {
    baseConfidence,
    folderAccuracyRate = 0.7, // 默认准确率
    matcherAgreement = 0.5, // 默认一致性
    sourceReliability = 0.5, // 默认来源可信度
  } = params;

  // 历史准确率调整：准确率越高，置信度提升越多
  const historyAdjustment =
    (folderAccuracyRate - 0.5) * 20 * CALIBRATION_PARAMS.historyWeight;

  // 匹配器一致性调整：一致性越高，置信度提升越多
  const matcherAgreementAdjustment =
    (matcherAgreement - 0.5) * 20 * CALIBRATION_PARAMS.matcherAgreementWeight;

  // 来源可信度调整
  const sourceReliabilityAdjustment =
    (sourceReliability - 0.5) * 20 * CALIBRATION_PARAMS.sourceReliabilityWeight;

  // 计算最终置信度
  let calibratedConfidence =
    baseConfidence +
    historyAdjustment +
    matcherAgreementAdjustment +
    sourceReliabilityAdjustment;

  // 限制范围
  calibratedConfidence = Math.max(
    CALIBRATION_PARAMS.minConfidence,
    Math.min(CALIBRATION_PARAMS.maxConfidence, calibratedConfidence),
  );

  return {
    baseConfidence,
    historyAdjustment,
    matcherAgreementAdjustment,
    sourceReliabilityAdjustment,
    calibratedConfidence: Math.round(calibratedConfidence),
  };
}

/**
 * 反馈类型显示信息
 */
export const FEEDBACK_TYPE_INFO: Record<
  FeedbackType,
  { label: string; icon: string; color: string }
> = {
  correct: {
    label: "分类正确",
    icon: "check-circle",
    color: "green",
  },
  incorrect: {
    label: "分类错误",
    icon: "x-circle",
    color: "red",
  },
  manual_move: {
    label: "手动移动",
    icon: "move",
    color: "blue",
  },
  manual_delete: {
    label: "手动删除",
    icon: "trash-2",
    color: "gray",
  },
  manual_archive: {
    label: "手动归档",
    icon: "archive",
    color: "gray",
  },
};
