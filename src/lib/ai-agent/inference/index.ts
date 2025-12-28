/**
 * 画像推断引擎模块导出
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

// 类型导出
export type {
  InferenceSignalType,
  InferenceSignal,
  PersonaInferenceResult,
  PersonaInferenceConfig,
  UserBookmarkStats,
  PlatformPersonaRule,
  TagPersonaRule,
} from "./types";

export { DEFAULT_INFERENCE_CONFIG, SIGNAL_TYPE_WEIGHTS } from "./types";

// 平台匹配器
export {
  PlatformMatcher,
  platformMatcher,
  PLATFORM_PERSONA_RULES,
} from "./platform-matcher";

// 标签匹配器
export { TagMatcher, tagMatcher, TAG_PERSONA_RULES } from "./tag-matcher";

// 信号融合器
export {
  SignalFusion,
  signalFusion,
  calculateSignalCoverage,
  calculateSignalDiversity,
  calculateResultStability,
} from "./signal-fusion";

// 画像缓存
export { personaCache, createPersonaCache } from "./persona-cache";

// 推断引擎（主入口）
export {
  PersonaInferrer,
  personaInferrer,
  createPersonaInferrer,
} from "./persona-inferrer";

// 统计数据适配器
export type { ExtendedQuickStats } from "./stats-adapter";

export {
  adaptQuickStatsToInference,
  convertPlatformStatsToDistribution,
  hasEnoughDataForInference,
  getSupportedPlatformCodes,
  isPlatformSupported,
} from "./stats-adapter";
