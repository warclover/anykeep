/**
 * Persona Analytics 模块导出
 *
 * @module ai-agent/personas/analytics
 * @version 1.0.0
 * @since 2025-12-28
 */

// 事件名称常量
export { PersonaEvents } from "./persona-analytics";

// 埋点函数
export {
  trackPersonaInferred,
  trackPersonaSettingsChanged,
  trackPersonaIntentRouted,
  trackPersonaError,
  trackPersonaRolloutCheck,
} from "./persona-analytics";

// 指标工具
export {
  createInferenceMetrics,
  inferenceMetrics,
  hashUserIdForAnalytics,
} from "./persona-analytics";

// 类型导出
export type {
  // 事件类型
  PersonaInferredEvent,
  PersonaSettingsChangedEvent,
  PersonaIntentRoutedEvent,
  PersonaErrorEvent,
  PersonaRolloutCheckEvent,
  // 事件类型映射
  PersonaEventTypes,
  PersonaEventName,
  PersonaEventPayload,
  // 统计类型
  PersonaDistributionStats,
  PersonaInferenceStats,
  PersonaBoostStats,
} from "./types";
