/**
 * 画像系统模块导出
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

// 类型导出
export type { PersonaType, PersonaGroup, PersonaMetadata } from "./types";

export {
  PERSONA_GROUP_MAP,
  PHASE1_ENABLED_PERSONAS,
  PERSONA_METADATA,
  isPhase1Enabled,
  getPersonaMetadata,
  getPersonasByGroup,
  getEnabledPersonas,
} from "./types";

// Prompts
export {
  getPersonaPrompt,
  hasPersonaPrompt,
  getPersonasWithPrompts,
  PM_PERSONA_PROMPT,
  CONSULTANT_PERSONA_PROMPT,
  TEACHER_PERSONA_PROMPT,
  GENERAL_PERSONA_PROMPT,
} from "./persona-prompts";

// 意图权重
export type { PersonaIntentSubType } from "./persona-intent-boosts";

/** @deprecated 使用 PersonaIntentSubType 替代 */
export type { PersonaIntentSubType as IntentType } from "./persona-intent-boosts";

export {
  PERSONA_INTENT_BOOSTS,
  PHASE1_NEW_INTENT_BOOSTS,
  getIntentBoost,
  getPersonaIntentBoosts,
  getMaxIntentBoost,
  isIntentBoosted,
} from "./persona-intent-boosts";

// Analytics (Phase 4)
export {
  PersonaEvents,
  trackPersonaInferred,
  trackPersonaSettingsChanged,
  trackPersonaIntentRouted,
  trackPersonaError,
  trackPersonaRolloutCheck,
  createInferenceMetrics,
  inferenceMetrics,
  hashUserIdForAnalytics,
} from "./analytics";

export type {
  PersonaInferredEvent,
  PersonaSettingsChangedEvent,
  PersonaIntentRoutedEvent,
  PersonaErrorEvent,
  PersonaRolloutCheckEvent,
  PersonaEventTypes,
  PersonaEventName,
  PersonaEventPayload,
  PersonaDistributionStats,
  PersonaInferenceStats,
  PersonaBoostStats,
} from "./analytics";
