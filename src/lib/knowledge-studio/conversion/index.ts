/**
 * Knowledge Studio - 转化自动化模块
 * @module knowledge-studio/conversion
 * @description P4 实现 - 7天试用期转化自动化
 * @version 1.0.0
 * @since 2026-01-02
 *
 * 已实现功能:
 * - 试用期状态管理 (ConversionTracker)
 * - 转化事件追踪 (trackEvent, recordPromptResponse)
 * - 智能升级提示 (shouldShowUpgradePrompt)
 * - 转化漏斗分析 (ConversionAnalytics)
 * - 转化概率预测 (calculateConversionProbability)
 * - 流失风险评估 (evaluateChurnRisk)
 *
 * API 端点:
 * - GET/POST /api/knowledge-studio/conversion/trial
 * - POST /api/knowledge-studio/conversion/events
 * - GET/POST /api/knowledge-studio/conversion/prompts
 * - GET /api/knowledge-studio/conversion/analytics
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
  ConversionTracker,
  ConversionTrackerStub, // 兼容别名
  createConversionTracker,
  // 辅助函数
  calculateRemainingDays,
  isTrialExpiring,
  isTrialExpired,
  getNextReminderDay,
} from "./conversion-tracker";

export {
  ConversionAnalytics,
  ConversionAnalyticsStub, // 兼容别名
  createConversionAnalytics,
  // 预测算法
  calculateConversionProbability,
  evaluateChurnRisk,
} from "./conversion-analytics";

export type { ConversionProbabilityFactors } from "./conversion-analytics";
