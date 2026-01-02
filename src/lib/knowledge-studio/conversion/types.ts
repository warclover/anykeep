/**
 * Knowledge Studio - 7天转化自动化类型定义
 * @module knowledge-studio/conversion
 * @description Phase 3 存根 - 试用期转化自动化类型
 * @version 0.1.0 (Stub)
 * @since 2025-01-02
 *
 * TODO Phase 3: 完整实现
 * - 试用期状态追踪
 * - 转化漏斗分析
 * - 自动升级提示
 * - A/B 测试支持
 */

// ============================================================================
// 试用期状态
// ============================================================================

/**
 * 试用期状态
 */
export type TrialStatus =
  | "active" // 试用中
  | "expired" // 已过期
  | "converted" // 已转化
  | "cancelled"; // 已取消

/**
 * 转化触发类型
 */
export type ConversionTrigger =
  | "quota_exhausted" // 配额耗尽
  | "feature_locked" // 功能受限
  | "trial_ending" // 试用即将结束
  | "trial_expired" // 试用已过期
  | "manual_upgrade" // 主动升级
  | "promo_offer"; // 优惠活动

/**
 * 用户转化阶段
 */
export type ConversionStage =
  | "awareness" // 认知阶段（刚注册）
  | "activation" // 激活阶段（首次使用核心功能）
  | "engagement" // 参与阶段（持续使用）
  | "consideration" // 考虑阶段（接触付费功能）
  | "conversion" // 转化阶段（升级）
  | "retention"; // 留存阶段（持续付费）

// ============================================================================
// 试用期配置
// ============================================================================

/**
 * 试用期配置
 */
export interface TrialConfig {
  /** 试用天数 */
  durationDays: number;
  /** 试用配额（生成次数） */
  generationQuota: number;
  /** 可体验的 Pro 功能 */
  unlockedFeatures: string[];
  /** 转化提醒时间点（剩余天数） */
  reminderDays: number[];
  /** 是否启用功能限制 */
  enableFeatureGating: boolean;
}

/**
 * 默认试用期配置
 */
export const DEFAULT_TRIAL_CONFIG: TrialConfig = {
  durationDays: 7,
  generationQuota: 5,
  unlockedFeatures: ["blueprint_blogger", "chat_to_edit"],
  reminderDays: [3, 1, 0],
  enableFeatureGating: true,
};

// ============================================================================
// 用户试用状态
// ============================================================================

/**
 * 用户试用状态
 */
export interface UserTrialState {
  /** 用户 ID */
  userId: string;
  /** 试用状态 */
  status: TrialStatus;
  /** 试用开始时间 */
  startedAt: Date;
  /** 试用结束时间 */
  expiresAt: Date;
  /** 已使用生成次数 */
  generationsUsed: number;
  /** 已体验的 Pro 功能 */
  featuresExperienced: string[];
  /** 转化阶段 */
  conversionStage: ConversionStage;
  /** 最后活跃时间 */
  lastActiveAt: Date;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// 转化事件
// ============================================================================

/**
 * 转化事件
 */
export interface ConversionEvent {
  /** 事件 ID */
  id: string;
  /** 用户 ID */
  userId: string;
  /** 触发类型 */
  trigger: ConversionTrigger;
  /** 事件时间 */
  timestamp: Date;
  /** 事件上下文 */
  context: {
    /** 触发来源页面 */
    sourcePage?: string;
    /** 触发功能 */
    featureId?: string;
    /** 剩余试用天数 */
    remainingDays?: number;
    /** 剩余配额 */
    remainingQuota?: number;
  };
  /** 用户响应 */
  userResponse?: "dismissed" | "clicked" | "converted" | "delayed";
}

// ============================================================================
// 升级提示配置
// ============================================================================

/**
 * 升级提示类型
 */
export type UpgradePromptType =
  | "modal" // 弹窗
  | "banner" // 横幅
  | "inline" // 内联
  | "tooltip"; // 工具提示

/**
 * 升级提示配置
 */
export interface UpgradePromptConfig {
  /** 提示类型 */
  type: UpgradePromptType;
  /** 触发条件 */
  trigger: ConversionTrigger;
  /** 标题 */
  title: string;
  /** 描述 */
  description: string;
  /** 主要 CTA */
  primaryCta: string;
  /** 次要 CTA */
  secondaryCta?: string;
  /** 是否可关闭 */
  dismissible: boolean;
  /** 关闭后冷却时间（小时） */
  cooldownHours: number;
  /** 优先级（数值越大优先级越高） */
  priority: number;
}

// ============================================================================
// 转化分析
// ============================================================================

/**
 * 转化漏斗指标
 */
export interface ConversionFunnelMetrics {
  /** 时间范围 */
  period: {
    start: Date;
    end: Date;
  };
  /** 各阶段用户数 */
  stageCounts: Record<ConversionStage, number>;
  /** 各阶段转化率 */
  stageConversionRates: Record<ConversionStage, number>;
  /** 总体转化率（试用→付费） */
  overallConversionRate: number;
  /** 平均转化天数 */
  averageConversionDays: number;
  /** 触发类型分布 */
  triggerDistribution: Record<ConversionTrigger, number>;
}

/**
 * 用户转化洞察
 */
export interface UserConversionInsight {
  /** 用户 ID */
  userId: string;
  /** 转化概率 */
  conversionProbability: number;
  /** 建议触发类型 */
  recommendedTrigger: ConversionTrigger;
  /** 建议提示类型 */
  recommendedPromptType: UpgradePromptType;
  /** 最佳触发时机 */
  optimalTriggerTime?: Date;
  /** 用户价值评分 */
  valueScore: number;
  /** 流失风险 */
  churnRisk: "low" | "medium" | "high";
}

// ============================================================================
// 服务接口 (Phase 3 存根)
// ============================================================================

/**
 * 转化追踪服务接口
 * @stub Phase 3 实现
 */
export interface IConversionTracker {
  /** 获取用户试用状态 */
  getTrialState(userId: string): Promise<UserTrialState | null>;
  /** 开始试用 */
  startTrial(userId: string): Promise<UserTrialState>;
  /** 记录转化事件 */
  trackEvent(event: Omit<ConversionEvent, "id">): Promise<void>;
  /** 更新转化阶段 */
  updateStage(userId: string, stage: ConversionStage): Promise<void>;
  /** 检查是否应显示升级提示 */
  shouldShowUpgradePrompt(userId: string): Promise<UpgradePromptConfig | null>;
  /** 记录提示响应 */
  recordPromptResponse(
    userId: string,
    promptType: UpgradePromptType,
    response: ConversionEvent["userResponse"],
  ): Promise<void>;
}

/**
 * 转化分析服务接口
 * @stub Phase 3 实现
 */
export interface IConversionAnalytics {
  /** 获取转化漏斗指标 */
  getFunnelMetrics(
    startDate: Date,
    endDate: Date,
  ): Promise<ConversionFunnelMetrics>;
  /** 获取用户转化洞察 */
  getUserInsight(userId: string): Promise<UserConversionInsight>;
  /** 获取即将过期的试用用户 */
  getExpiringTrials(withinDays: number): Promise<UserTrialState[]>;
  /** 获取高价值待转化用户 */
  getHighValueProspects(limit: number): Promise<UserConversionInsight[]>;
}
