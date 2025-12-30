/**
 * 意图预测模块类型定义
 *
 * 基于用户历史行为预测下一步意图
 *
 * @module ai-skills/router/intent-predictor
 * @version 1.0.0
 * @since 2025-12-30
 * @description Phase 3 - 智能预测核心类型
 */

import type { IntentType } from "../types";

// =============================================================================
// 预测结果类型
// =============================================================================

/**
 * 预测的意图
 */
export interface PredictedIntent {
  /** 意图类型 */
  intent: IntentType;
  /** 子类型 */
  subType?: string;
  /** 预测概率 (0-1) */
  probability: number;
  /** 触发条件描述 */
  triggerCondition: string;
  /** 建议的主动行为 */
  suggestedAction: string;
  /** 是否建议主动推送 */
  shouldPush: boolean;
}

/**
 * 快捷操作按钮
 */
export interface QuickAction {
  /** 唯一标识 */
  id: string;
  /** 显示标签 */
  label: string;
  /** 图标名称 */
  icon: string;
  /** 关联意图 */
  intent: IntentType;
  /** 关联子类型 */
  subType?: string;
  /** 预设参数 */
  params?: Record<string, unknown>;
  /** 显示优先级 (越高越靠前) */
  priority: number;
  /** 预测置信度 */
  confidence: number;
}

// =============================================================================
// 历史记录类型
// =============================================================================

/**
 * 意图历史记录条目
 */
export interface IntentHistoryEntry {
  /** 意图类型 */
  intent: IntentType;
  /** 子类型 */
  subType?: string;
  /** 时间戳 */
  timestamp: number;
  /** 执行是否成功 */
  success: boolean;
  /** 用户满意度（如有反馈，1-5） */
  satisfaction?: number;
  /** 是否被用户纠正 */
  wasCorrected?: boolean;
  /** 纠正后的意图（如有） */
  correctedTo?: {
    intent: IntentType;
    subType?: string;
  };
}

/**
 * 用户纠正记录
 */
export interface CorrectionRecord {
  /** 记录 ID */
  id: string;
  /** 用户 ID */
  userId: string;
  /** 原始意图 */
  originalIntent: IntentType;
  /** 原始子类型 */
  originalSubType?: string;
  /** 纠正后意图 */
  correctedIntent: IntentType;
  /** 纠正后子类型 */
  correctedSubType?: string;
  /** 原始用户消息 */
  originalMessage: string;
  /** 纠正时间 */
  timestamp: number;
  /** 纠正原因（用户提供的描述） */
  reason?: string;
}

// =============================================================================
// 配置类型
// =============================================================================

/**
 * 意图预测器配置
 */
export interface IntentPredictorConfig {
  /** 历史记录保留天数 */
  historyRetentionDays: number;
  /** 最小历史样本数（低于此值使用默认预测） */
  minHistorySamples: number;
  /** 预测阈值（低于此概率不返回） */
  predictionThreshold: number;
  /** 最大预测数量 */
  maxPredictions: number;
  /** 是否启用上下文调整 */
  enableContextAdjustment: boolean;
  /** 推送阈值（高于此概率建议推送） */
  pushThreshold: number;
}

// =============================================================================
// 转移矩阵类型
// =============================================================================

/**
 * 意图转移概率
 */
export interface TransitionProbability {
  /** 目标意图 */
  toIntent: IntentType;
  /** 目标子类型 */
  toSubType?: string;
  /** 转移概率 */
  probability: number;
  /** 观测次数 */
  observedCount: number;
}

/**
 * 转移矩阵行
 */
export interface TransitionMatrixRow {
  /** 源意图 */
  fromIntent: IntentType;
  /** 源子类型 */
  fromSubType?: string;
  /** 转移概率列表 */
  transitions: TransitionProbability[];
  /** 总观测次数 */
  totalObservations: number;
}

// =============================================================================
// 服务接口
// =============================================================================

/**
 * 意图预测服务接口
 */
export interface IIntentPredictor {
  /** 服务配置 */
  readonly config: IntentPredictorConfig;

  /**
   * 预测下一步意图
   * @param userId - 用户 ID
   * @param currentMessage - 当前消息
   * @param currentIntent - 当前意图分类
   * @returns 预测的意图列表
   */
  predict(
    userId: string,
    currentMessage: string,
    currentIntent: { type: IntentType; subType?: string },
  ): Promise<PredictedIntent[]>;

  /**
   * 获取快捷操作按钮
   * @param userId - 用户 ID
   * @param currentIntent - 当前意图分类
   * @returns 快捷操作列表
   */
  getQuickActions(
    userId: string,
    currentIntent?: { type: IntentType; subType?: string },
  ): Promise<QuickAction[]>;

  /**
   * 记录意图执行
   * @param userId - 用户 ID
   * @param entry - 历史记录条目
   */
  recordIntent(
    userId: string,
    entry: Omit<IntentHistoryEntry, "timestamp">,
  ): Promise<void>;

  /**
   * 记录用户纠正
   * @param userId - 用户 ID
   * @param correction - 纠正记录
   */
  recordCorrection(
    userId: string,
    correction: Omit<CorrectionRecord, "id" | "userId" | "timestamp">,
  ): Promise<void>;
}

// =============================================================================
// 常量
// =============================================================================

/**
 * 默认配置
 */
export const DEFAULT_PREDICTOR_CONFIG: IntentPredictorConfig = {
  historyRetentionDays: 30,
  minHistorySamples: 10,
  predictionThreshold: 0.3,
  maxPredictions: 3,
  enableContextAdjustment: true,
  pushThreshold: 0.6,
};

/**
 * 日志模块名称
 */
export const LOG_MODULE = "intent-predictor";

/**
 * 默认预测（历史数据不足时使用）
 *
 * 基于常见使用模式的启发式规则
 */
export const DEFAULT_PREDICTIONS: Record<IntentType, PredictedIntent[]> = {
  query: [
    {
      intent: "action",
      subType: "tag",
      probability: 0.4,
      triggerCondition: "查询后可能需要管理",
      suggestedAction: "给搜索结果添加标签",
      shouldPush: false,
    },
  ],
  action: [
    {
      intent: "query",
      subType: "search",
      probability: 0.5,
      triggerCondition: "操作后可能需要验证",
      suggestedAction: "搜索验证操作结果",
      shouldPush: false,
    },
  ],
  organize: [
    {
      intent: "query",
      subType: "stats",
      probability: 0.4,
      triggerCondition: "整理后查看统计",
      suggestedAction: "查看整理后的统计",
      shouldPush: false,
    },
  ],
  analyze: [
    {
      intent: "action",
      probability: 0.35,
      triggerCondition: "分析后可能需要导出",
      suggestedAction: "导出分析报告",
      shouldPush: false,
    },
  ],
  learn: [
    {
      intent: "query",
      subType: "search",
      probability: 0.45,
      triggerCondition: "学习后查找相关内容",
      suggestedAction: "搜索相关主题",
      shouldPush: false,
    },
  ],
  create: [
    {
      intent: "action",
      subType: "tag",
      probability: 0.5,
      triggerCondition: "创建后添加标签",
      suggestedAction: "为新内容添加标签",
      shouldPush: false,
    },
  ],
  refine: [
    {
      intent: "query",
      subType: "search",
      probability: 0.6,
      triggerCondition: "细化后继续搜索",
      suggestedAction: "继续搜索",
      shouldPush: false,
    },
  ],
  chitchat: [
    {
      intent: "query",
      subType: "search",
      probability: 0.5,
      triggerCondition: "闲聊后可能需要搜索",
      suggestedAction: "搜索收藏内容",
      shouldPush: false,
    },
  ],
};

/**
 * 快捷操作图标映射
 */
export const QUICK_ACTION_ICONS: Record<IntentType, string> = {
  query: "Search",
  action: "Settings",
  organize: "FolderTree",
  analyze: "BarChart",
  learn: "BookOpen",
  create: "Plus",
  refine: "Filter",
  chitchat: "MessageCircle",
};
