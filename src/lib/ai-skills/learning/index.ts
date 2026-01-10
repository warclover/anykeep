/**
 * Phase 3: 个性化学习模块
 *
 * 核心组件：
 * - FeedbackCollector: 用户反馈收集（隐式 + 显式）
 * - IntentPatternDiscoverer: 意图模式自动发现
 * - PersonalizedShortcutLearner: 个性化快捷指令学习
 * - PersonalizedLearningIntegration: UnifiedEngine 集成服务
 *
 * @version 1.0.0
 * @since 2026-01-10
 */

// ============================================
// 类型导出
// ============================================

export type {
  // 用户反馈类型
  UserBehavior,
  UserAction,
  IntentMatchForFeedback,
  UserFeedback,
  ExplicitRating,
  ExplicitFeedback,
  UserFeedbackStats,

  // 模式发现类型
  DiscoveryMethod,
  PatternStatus,
  SuggestedPattern,
  PatternCluster,

  // 快捷指令类型
  UserShortcut,
  ShortcutCandidate,

  // 配置类型
  FeedbackCollectorConfig,
  PatternDiscovererConfig,
  ShortcutLearnerConfig,
} from "./types";

// ============================================
// 类导出
// ============================================

export {
  FeedbackCollector,
  createFeedbackCollector,
} from "./feedback-collector";

export {
  IntentPatternDiscoverer,
  createPatternDiscoverer,
} from "./pattern-discoverer";

export {
  PersonalizedShortcutLearner,
  createShortcutLearner,
} from "./shortcut-learner";

// ============================================
// 集成模块导出
// ============================================

export {
  PersonalizedLearningIntegration,
  createPersonalizedLearningIntegration,
  getPersonalizedLearningIntegration,
  resetPersonalizedLearningIntegration,
  type PersonalizedLearningConfig,
  type ShortcutMatchResult,
  type FeedbackContext,
} from "./integration";
