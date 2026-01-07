/**
 * Knowledge Studio Hooks
 * @module hooks/knowledge-studio
 * @description React Hooks for Knowledge Studio features
 */

export { useGeneration } from "./use-generation";
export type {
  GenerationStatus,
  GenerationStage,
  GenerationProgress,
  GenerationConfig,
  GenerationResult,
  UseGenerationReturn,
} from "./use-generation";

export { useChatEdit } from "./use-chat-edit";
export type {
  EditStatus,
  EditInstruction,
  ChatMessage,
  EditResult,
  UseChatEditReturn,
} from "./use-chat-edit";

export { useQuota } from "./use-quota";
export type { QuotaInfo, UseQuotaReturn } from "./use-quota";

export { useUsageTracking, recordBlueprintUsage } from "./use-usage-tracking";
export type { UsageRecordParams } from "./use-usage-tracking";

// P0-3: TTS 播放器
export { useKSTTSPlayer } from "./use-ks-tts-player";
export type {
  KSTTSPlayerState,
  KSTTSPlayerStateValue,
} from "./use-ks-tts-player";

// P1-1: 一稿多发风格适配
export { useAdaptStyle } from "./use-adapt-style";
export type { AdaptStyleStatus, AdaptStyleState } from "./use-adapt-style";
