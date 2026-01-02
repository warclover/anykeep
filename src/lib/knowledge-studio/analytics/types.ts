/**
 * Knowledge Studio Analytics - 使用分析类型
 * @module knowledge-studio/analytics
 */

import type { BlueprintType, QuotaOperationType } from "../types";

// ============================================================================
// 使用统计类型
// ============================================================================

/**
 * 操作统计项
 */
export interface OperationStat {
  /** 操作类型 */
  operationType: QuotaOperationType;
  /** 总次数 */
  totalCount: number;
  /** 成功次数（已确认） */
  successCount: number;
  /** 失败/退还次数 */
  refundedCount: number;
  /** 待确认次数 */
  pendingCount: number;
  /** 总消耗配额 */
  totalCost: number;
  /** 成功消耗配额 */
  confirmedCost: number;
}

/**
 * 蓝图类型统计
 */
export interface BlueprintTypeStat {
  /** 蓝图类型 */
  blueprintType: BlueprintType;
  /** 生成次数 */
  count: number;
  /** 平均生成时间（毫秒） */
  avgDurationMs: number;
  /** 平均 Token 消耗 */
  avgTokens: number;
}

/**
 * 每日使用趋势
 */
export interface DailyUsageTrend {
  /** 日期 (YYYY-MM-DD) */
  date: string;
  /** 蓝图生成次数 */
  blueprintCount: number;
  /** 聊天编辑次数 */
  chatEditCount: number;
  /** 素材分析次数 */
  materialAnalysisCount: number;
  /** 总消耗配额 */
  totalCost: number;
}

/**
 * Knowledge Studio 使用统计
 */
export interface KSUsageStats {
  /** 统计周期（天） */
  periodDays: number;
  /** 周期开始时间 */
  periodStart: string;
  /** 周期结束时间 */
  periodEnd: string;

  /** 汇总统计 */
  summary: {
    /** 总操作次数 */
    totalOperations: number;
    /** 总消耗配额 */
    totalCostConsumed: number;
    /** 总退还配额 */
    totalCostRefunded: number;
    /** 成功率 (%) */
    successRate: number;
    /** 生成报告数 */
    reportsGenerated: number;
    /** 平均每日操作数 */
    avgDailyOperations: number;
  };

  /** 按操作类型统计 */
  byOperation: OperationStat[];

  /** 按蓝图类型统计 */
  byBlueprint: BlueprintTypeStat[];

  /** 每日趋势 */
  dailyTrend: DailyUsageTrend[];

  /** 生成时间 */
  generatedAt: string;
}

// ============================================================================
// 转化追踪类型 (Phase 3)
// ============================================================================

/**
 * 试用状态
 */
export type TrialStatus = "not_started" | "active" | "expired" | "converted";

/**
 * 用户试用信息
 */
export interface UserTrialInfo {
  /** 用户 ID */
  userId: string;
  /** 试用状态 */
  status: TrialStatus;
  /** 试用开始时间 */
  trialStartedAt?: string;
  /** 试用过期时间 */
  trialExpiresAt?: string;
  /** 是否使用过 Pro 功能 */
  hasUsedProFeature: boolean;
  /** 转化时间 */
  convertedAt?: string;
}

/**
 * 转化漏斗数据
 */
export interface ConversionFunnel {
  /** 访问知识工坊用户数 */
  visited: number;
  /** 开始试用用户数 */
  trialStarted: number;
  /** 完成一次生成用户数 */
  generationCompleted: number;
  /** 转化为 Pro 用户数 */
  converted: number;
  /** 各阶段转化率 */
  conversionRates: {
    visitToTrial: number;
    trialToGeneration: number;
    generationToConversion: number;
    overallConversion: number;
  };
}

// ============================================================================
// 配置类型
// ============================================================================

/**
 * Analytics 服务配置
 */
export interface KSAnalyticsConfig {
  /** 统计周期（天） */
  periodDays: number;
  /** 是否包含每日趋势 */
  includeDailyTrend: boolean;
  /** 是否包含蓝图类型统计 */
  includeBlueprintStats: boolean;
}

/**
 * 默认配置
 */
export const DEFAULT_KS_ANALYTICS_CONFIG: KSAnalyticsConfig = {
  periodDays: 30,
  includeDailyTrend: true,
  includeBlueprintStats: true,
};
