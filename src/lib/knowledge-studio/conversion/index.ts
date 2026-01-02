/**
 * Knowledge Studio - 转化自动化模块
 * @module knowledge-studio/conversion
 * @description Phase 3 存根 - 7天试用期转化自动化
 * @version 0.1.0 (Stub)
 * @since 2025-01-02
 *
 * Phase 3 功能规划:
 * - 试用期状态管理
 * - 转化事件追踪
 * - 智能升级提示
 * - 转化漏斗分析
 * - ML 转化预测
 * - A/B 测试框架
 */

// ============================================================================
// 类型导出
// ============================================================================

export type {
  // 状态类型
  TrialStatus,
  ConversionTrigger,
  ConversionStage,
  UpgradePromptType,
  // 配置接口
  TrialConfig,
  UpgradePromptConfig,
  // 状态接口
  UserTrialState,
  ConversionEvent,
  // 分析接口
  ConversionFunnelMetrics,
  UserConversionInsight,
  // 服务接口
  IConversionTracker,
  IConversionAnalytics,
} from "./types";

export { DEFAULT_TRIAL_CONFIG } from "./types";

// ============================================================================
// 服务导出
// ============================================================================

export {
  ConversionTrackerStub,
  createConversionTracker,
  // 辅助函数
  calculateRemainingDays,
  isTrialExpiring,
  isTrialExpired,
  getNextReminderDay,
} from "./conversion-tracker";

export {
  ConversionAnalyticsStub,
  createConversionAnalytics,
  // 预留算法
  calculateConversionProbability,
  evaluateChurnRisk,
} from "./conversion-analytics";

export type { ConversionProbabilityFactors } from "./conversion-analytics";
